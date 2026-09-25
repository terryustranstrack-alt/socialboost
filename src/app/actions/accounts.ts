"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { requireRole, CAN_MANAGE_BRAND } from "@/lib/rbac";
import { encryptToken, DISCONNECTED_TOKEN, isDisconnectedToken } from "@/lib/crypto";
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
  // A disconnected account has no access token, so switching it back on
  // would only make its posts fail — it has to be connected again instead.
  if (isActive && isDisconnectedToken(account.accessTokenCipher)) {
    throw new Error("This account is disconnected. Connect it again to use it.");
  }

  await prisma.socialAccount.update({ where: { id: accountId }, data: { isActive } });
  revalidatePath("/settings/accounts");
}

// Stops SocialBoost from being able to post to this account. If it was never
// used for any post, it's removed completely. If it was, we keep the entry so
// past posts and their engagement numbers still show up — but we erase the
// saved access token, so nothing can be posted through it anymore.
// Connecting the same Page again (with the button or manually) restores it.
export async function disconnectSocialAccount(accountId: string) {
  const session = await requireSession();
  const account = await prisma.socialAccount.findUniqueOrThrow({ where: { id: accountId } });
  requireRole(session.user.memberships, account.brandId, CAN_MANAGE_BRAND);

  const postCount = await prisma.postTarget.count({ where: { socialAccountId: accountId } });
  if (postCount === 0) {
    await prisma.socialAccount.delete({ where: { id: accountId } });
  } else {
    await prisma.socialAccount.update({
      where: { id: accountId },
      data: { accessTokenCipher: DISCONNECTED_TOKEN, isActive: false },
    });
  }

  revalidatePath("/settings/accounts");
}
