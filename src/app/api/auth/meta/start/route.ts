import { randomBytes } from "crypto";
import { NextResponse, type NextRequest } from "next/server";
import { auth } from "@/auth";
import { requireRole, CAN_MANAGE_BRAND } from "@/lib/rbac";
import { buildMetaLoginUrl } from "@/lib/meta";

// Step 1 of "Connect with Facebook": send the Admin to Facebook's own
// login + permissions screen. They pick which Page(s) to share with us
// there — we never see their Facebook password.
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session) return NextResponse.redirect(new URL("/login", req.url));

  const brandId = req.nextUrl.searchParams.get("brandId") ?? "";
  try {
    requireRole(session.user.memberships, brandId, CAN_MANAGE_BRAND);
  } catch {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  // A one-time code so we can tell, when Facebook redirects back, that
  // it's really this same visit continuing — and which brand it's for.
  const csrfToken = randomBytes(16).toString("hex");
  const redirectUri = new URL("/api/auth/meta/callback", req.url).toString();
  const loginUrl = buildMetaLoginUrl(redirectUri, csrfToken);

  const response = NextResponse.redirect(loginUrl);
  response.cookies.set("meta_oauth_state", `${csrfToken}:${brandId}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 600,
    path: "/",
  });
  return response;
}
