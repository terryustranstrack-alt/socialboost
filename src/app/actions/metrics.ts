"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { requireRole, CAN_CREATE } from "@/lib/rbac";
import { decryptToken } from "@/lib/crypto";
import { fetchInstagramMetrics, fetchFacebookMetrics } from "@/lib/meta";

export async function refreshPostMetrics(postId: string) {
  const session = await auth();
  if (!session) throw new Error("UNAUTHENTICATED");

  const post = await prisma.post.findUniqueOrThrow({
    where: { id: postId },
    include: { targets: { include: { socialAccount: true } } },
  });
  requireRole(session.user.memberships, post.brandId, CAN_CREATE);

  for (const target of post.targets) {
    if (target.publishStatus !== "SUCCESS" || !target.platformPostId) continue;

    try {
      const accessToken = decryptToken(target.socialAccount.accessTokenCipher);
      const metrics =
        target.platform === "INSTAGRAM"
          ? await fetchInstagramMetrics(target.platformPostId, accessToken)
          : target.platform === "FACEBOOK"
            ? await fetchFacebookMetrics(target.platformPostId, accessToken)
            : null;
      if (!metrics) continue;

      await prisma.postTarget.update({
        where: { id: target.id },
        data: { ...metrics, metricsFetchedAt: new Date() },
      });
    } catch {
      // Best-effort: leave the previous snapshot in place and keep going.
    }
  }

  revalidatePath(`/posts/${postId}`);
}
