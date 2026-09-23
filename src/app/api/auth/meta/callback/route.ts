import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { requireRole, CAN_MANAGE_BRAND } from "@/lib/rbac";
import { encryptToken } from "@/lib/crypto";
import { resolvePagesFromOAuthCode, type ConnectedPage } from "@/lib/meta";

// Step 2 of "Connect with Facebook": Facebook sends the person back here
// after they've logged in and picked which Page(s) to share. We turn that
// into saved, ready-to-use connections for the brand they started from.
export async function GET(req: NextRequest) {
  function goToSettingsWith(params: Record<string, string>) {
    const url = new URL("/settings/accounts", req.url);
    for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
    const response = NextResponse.redirect(url);
    response.cookies.delete("meta_oauth_state");
    return response;
  }

  const code = req.nextUrl.searchParams.get("code");
  const returnedState = req.nextUrl.searchParams.get("state");
  const [savedCsrfToken, brandId] = (req.cookies.get("meta_oauth_state")?.value ?? "").split(":");

  if (!code || !returnedState || !savedCsrfToken || returnedState !== savedCsrfToken || !brandId) {
    return goToSettingsWith({ error: "invalid_request" });
  }

  const session = await auth();
  if (!session) return goToSettingsWith({ error: "not_signed_in" });

  try {
    requireRole(session.user.memberships, brandId, CAN_MANAGE_BRAND);
  } catch {
    return goToSettingsWith({ error: "forbidden" });
  }

  try {
    const redirectUri = new URL("/api/auth/meta/callback", req.url).toString();
    const pages = await resolvePagesFromOAuthCode(code, redirectUri);
    await saveConnectedPages(brandId, pages);
    return goToSettingsWith({ connected: String(pages.length) });
  } catch {
    return goToSettingsWith({ error: "meta_error" });
  }
}

async function saveConnectedPages(brandId: string, pages: ConnectedPage[]) {
  for (const page of pages) {
    await upsertFacebookAccount(brandId, page);
    await upsertInstagramAccount(brandId, page);
  }
}

async function upsertFacebookAccount(brandId: string, page: ConnectedPage) {
  await prisma.socialAccount.upsert({
    where: {
      brandId_platform_externalAccountId: {
        brandId,
        platform: "FACEBOOK",
        externalAccountId: page.pageId,
      },
    },
    update: {
      displayName: page.pageName,
      accessTokenCipher: encryptToken(page.pageAccessToken),
      isActive: true,
    },
    create: {
      brandId,
      platform: "FACEBOOK",
      displayName: page.pageName,
      externalAccountId: page.pageId,
      accessTokenCipher: encryptToken(page.pageAccessToken),
    },
  });
}

// Instagram Business accounts are published to using their linked Page's
// token, not a separate Instagram login — so we reuse page.pageAccessToken.
async function upsertInstagramAccount(brandId: string, page: ConnectedPage) {
  if (!page.instagramBusinessAccountId) return;

  await prisma.socialAccount.upsert({
    where: {
      brandId_platform_externalAccountId: {
        brandId,
        platform: "INSTAGRAM",
        externalAccountId: page.instagramBusinessAccountId,
      },
    },
    update: {
      displayName: `${page.pageName} (Instagram)`,
      accessTokenCipher: encryptToken(page.pageAccessToken),
      isActive: true,
    },
    create: {
      brandId,
      platform: "INSTAGRAM",
      displayName: `${page.pageName} (Instagram)`,
      externalAccountId: page.instagramBusinessAccountId,
      accessTokenCipher: encryptToken(page.pageAccessToken),
    },
  });
}
