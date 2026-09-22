"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { requireRole, CAN_MANAGE_BRAND } from "@/lib/rbac";
import { encryptToken } from "@/lib/crypto";
import type { Platform } from "@prisma/client";

async function requireSession() {
  const session = await auth();
  if (!session) throw new Error("UNAUTHENTICATED");
  return session;
}

export async function connectSocialAccount(formData: FormData) {
  const session = await requireSession();
  const brandId = String(formData.get("brandId") ?? "");
  requireRole(session.user.memberships, brandId, CAN_MANAGE_BRAND);

  const platform = String(formData.get("platform") ?? "") as Platform;
  const displayName = String(formData.get("displayName") ?? "").trim();
  const externalAccountId = String(formData.get("externalAccountId") ?? "").trim();
  const accessToken = String(formData.get("accessToken") ?? "").trim();

  if (!displayName || !externalAccountId || !accessToken) {
    throw new Error("All fields are required");
  }

  await prisma.socialAccount.upsert({
    where: {
      brandId_platform_externalAccountId: { brandId, platform, externalAccountId },
    },
    update: {
      displayName,
      accessTokenCipher: encryptToken(accessToken),
      isActive: true,
    },
    create: {
      brandId,
      platform,
      displayName,
      externalAccountId,
      accessTokenCipher: encryptToken(accessToken),
    },
  });

  revalidatePath("/settings/accounts");
}

export async function toggleSocialAccount(accountId: string, isActive: boolean) {
  const session = await requireSession();
  const account = await prisma.socialAccount.findUniqueOrThrow({ where: { id: accountId } });
  requireRole(session.user.memberships, account.brandId, CAN_MANAGE_BRAND);

  await prisma.socialAccount.update({ where: { id: accountId }, data: { isActive } });
  revalidatePath("/settings/accounts");
}
