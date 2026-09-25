"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { requireRole, CAN_CREATE, CAN_APPROVE } from "@/lib/rbac";
import type { MediaType } from "@prisma/client";

async function requireSession() {
  const session = await auth();
  if (!session) throw new Error("UNAUTHENTICATED");
  return session;
}

export async function createPost(formData: FormData) {
  const session = await requireSession();
  const brandId = String(formData.get("brandId") ?? "");
  requireRole(session.user.memberships, brandId, CAN_CREATE);

  const caption = String(formData.get("caption") ?? "").trim();
  if (!caption) throw new Error("Caption is required");

  const scheduledAtRaw = String(formData.get("scheduledAt") ?? "");
  const scheduledAt = scheduledAtRaw ? new Date(scheduledAtRaw) : null;

  const targetAccountIds = formData.getAll("targetAccountIds").map(String);
  const mediaUrl = String(formData.get("mediaUrl") ?? "");
  const mediaType = String(formData.get("mediaType") ?? "IMAGE") as MediaType;

  const accounts = await prisma.socialAccount.findMany({
    where: { id: { in: targetAccountIds }, brandId },
  });

  const post = await prisma.post.create({
    data: {
      brandId,
      createdById: session.user.id,
      caption,
      scheduledAt,
      media: mediaUrl ? { create: [{ url: mediaUrl, type: mediaType, order: 0 }] } : undefined,
      targets: {
        create: accounts.map((a) => ({
          socialAccountId: a.id,
          platform: a.platform,
        })),
      },
      activities: {
        create: { userId: session.user.id, action: "CREATED" },
      },
    },
  });

  revalidatePath("/posts");
  redirect(`/posts/${post.id}`);
}

export async function submitForApproval(postId: string) {
  const session = await requireSession();
  const post = await prisma.post.findUniqueOrThrow({ where: { id: postId } });
  requireRole(session.user.memberships, post.brandId, CAN_CREATE);
  if (post.status !== "DRAFT") throw new Error("Only drafts can be submitted");

  const targetCount = await prisma.postTarget.count({ where: { postId } });
  if (targetCount === 0) throw new Error("Select at least one platform before submitting");

  await prisma.$transaction(async (tx) => {
    await tx.post.update({
      where: { id: postId },
      data: { status: "PENDING_APPROVAL" },
    });
    await tx.postActivity.create({
      data: { postId, userId: session.user.id, action: "SUBMITTED_FOR_APPROVAL" },
    });

    const approvers = await tx.membership.findMany({
      where: { brandId: post.brandId, role: { in: ["ADMIN", "APPROVER"] } },
    });
    await tx.notification.createMany({
      data: approvers.map((a) => ({
        userId: a.userId,
        type: "APPROVAL_REQUESTED" as const,
        postId,
        message: `A post is waiting for your approval.`,
      })),
    });
  });

  revalidatePath("/posts");
  revalidatePath(`/posts/${postId}`);
  revalidatePath("/approvals");
}

export async function approvePost(postId: string) {
  const session = await requireSession();
  const post = await prisma.post.findUniqueOrThrow({ where: { id: postId } });
  requireRole(session.user.memberships, post.brandId, CAN_APPROVE);
  if (post.status !== "PENDING_APPROVAL") throw new Error("Post is not pending approval");

  await prisma.$transaction(async (tx) => {
    await tx.post.update({
      where: { id: postId },
      data: {
        status: "SCHEDULED",
        scheduledAt: post.scheduledAt ?? new Date(),
        approvedById: session.user.id,
        approvedAt: new Date(),
      },
    });
    await tx.postActivity.create({
      data: { postId, userId: session.user.id, action: "APPROVED" },
    });
    await tx.notification.create({
      data: {
        userId: post.createdById,
        type: "POST_APPROVED",
        postId,
        message: "Your post was approved and is now scheduled.",
      },
    });
  });

  revalidatePath("/approvals");
  revalidatePath(`/posts/${postId}`);
  revalidatePath("/calendar");
}

export async function rejectPost(postId: string, note: string) {
  const session = await requireSession();
  const post = await prisma.post.findUniqueOrThrow({ where: { id: postId } });
  requireRole(session.user.memberships, post.brandId, CAN_APPROVE);
  if (post.status !== "PENDING_APPROVAL") throw new Error("Post is not pending approval");

  await prisma.$transaction(async (tx) => {
    await tx.post.update({
      where: { id: postId },
      data: { status: "REJECTED", rejectedNote: note || null },
    });
    await tx.postActivity.create({
      data: { postId, userId: session.user.id, action: "REJECTED", note },
    });
    await tx.notification.create({
      data: {
        userId: post.createdById,
        type: "POST_REJECTED",
        postId,
        message: note ? `Your post was rejected: ${note}` : "Your post was rejected.",
      },
    });
  });

  revalidatePath("/approvals");
  revalidatePath(`/posts/${postId}`);
}

export async function deletePost(postId: string) {
  const session = await requireSession();
  const post = await prisma.post.findUniqueOrThrow({ where: { id: postId } });
  requireRole(session.user.memberships, post.brandId, CAN_CREATE);
  if (post.status !== "DRAFT" && post.status !== "REJECTED") {
    throw new Error("Only draft or rejected posts can be deleted");
  }

  await prisma.post.delete({ where: { id: postId } });
  revalidatePath("/posts");
  redirect("/posts");
}
