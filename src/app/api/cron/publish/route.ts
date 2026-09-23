import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { decryptToken } from "@/lib/crypto";
import { publishToInstagram, publishToFacebook, MetaPublishError } from "@/lib/meta";
import type { Post, PostTarget, SocialAccount } from "@prisma/client";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// How many due posts to publish per cron run. Kept small, and one at a
// time rather than all at once, so we don't send too many requests to
// Instagram/Facebook too quickly (the PRD requires respecting their rate
// limits).
const BATCH_SIZE = 10;

function isAuthorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true; // no secret configured (e.g. local dev)
  const header = req.headers.get("authorization");
  return header === `Bearer ${secret}`;
}

type TargetWithAccount = PostTarget & { socialAccount: SocialAccount };
type PostWithTargets = Post & { targets: TargetWithAccount[]; media: { url: string; type: "IMAGE" | "VIDEO" }[] };

export async function GET(req: Request) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const duePosts = await prisma.post.findMany({
    where: {
      status: "SCHEDULED",
      scheduledAt: { lte: new Date() },
    },
    orderBy: { scheduledAt: "asc" },
    take: BATCH_SIZE,
    include: {
      targets: { include: { socialAccount: true }, where: { publishStatus: "PENDING" } },
      media: { orderBy: { order: "asc" }, take: 1 },
    },
  });

  const results = [];
  for (const post of duePosts as unknown as PostWithTargets[]) {
    results.push(await publishPost(post));
  }

  return NextResponse.json({ processed: results.length, results });
}

async function publishPost(post: PostWithTargets) {
  await prisma.post.update({ where: { id: post.id }, data: { status: "PUBLISHING" } });

  const media = post.media[0];
  let anySuccess = false;
  let anyFailure = false;

  for (const target of post.targets) {
    if (!media) {
      await failTarget(target, "Post has no media attached.");
      anyFailure = true;
      continue;
    }

    try {
      const accessToken = decryptToken(target.socialAccount.accessTokenCipher);
      const publishFn =
        target.platform === "INSTAGRAM" ? publishToInstagram : publishToFacebook;

      const { platformPostId } = await publishFn({
        externalAccountId: target.socialAccount.externalAccountId,
        accessToken,
        caption: post.caption,
        mediaUrl: media.url,
        mediaType: media.type,
      });

      await prisma.postTarget.update({
        where: { id: target.id },
        data: {
          publishStatus: "SUCCESS",
          platformPostId,
          publishedAt: new Date(),
          attempts: { increment: 1 },
          errorMessage: null,
        },
      });
      anySuccess = true;
    } catch (err) {
      const message =
        err instanceof MetaPublishError ? err.message : "Unknown publish error";
      await failTarget(target, message);
      anyFailure = true;
    }
  }

  const finalStatus = anyFailure ? "FAILED" : "PUBLISHED";

  await prisma.$transaction(async (tx) => {
    await tx.post.update({ where: { id: post.id }, data: { status: finalStatus } });
    await tx.postActivity.create({
      data: {
        postId: post.id,
        action: finalStatus === "PUBLISHED" ? "PUBLISHED" : "PUBLISH_FAILED",
        note: anyFailure ? "One or more platforms failed to publish. See target details." : null,
      },
    });

    const notifyUserIds = new Set<string>([post.createdById]);
    if (anyFailure) {
      const admins = await tx.membership.findMany({
        where: { brandId: post.brandId, role: "ADMIN" },
        select: { userId: true },
      });
      for (const a of admins) notifyUserIds.add(a.userId);
    }
    await tx.notification.createMany({
      data: Array.from(notifyUserIds).map((userId) => ({
        userId,
        type: anyFailure ? ("PUBLISH_FAILED" as const) : ("PUBLISH_SUCCESS" as const),
        postId: post.id,
        message: anyFailure
          ? "A scheduled post failed to publish on one or more platforms."
          : "A scheduled post was published successfully.",
      })),
    });
  });

  return { postId: post.id, status: finalStatus, anySuccess, anyFailure };
}

async function failTarget(target: TargetWithAccount, message: string) {
  await prisma.postTarget.update({
    where: { id: target.id },
    data: {
      publishStatus: "FAILED",
      errorMessage: message,
      attempts: { increment: 1 },
    },
  });
}
