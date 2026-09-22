import { cookies } from "next/headers";
import type { SessionMembership } from "@/auth";

export const ACTIVE_BRAND_COOKIE = "activeBrandId";

// The signed-in user's "current" brand (transtrack.co vs transtrack.academy)
// is stored in a cookie rather than the DB — it's a UI convenience, not
// state other users need to see, and it avoids a write on every page view.
export async function getActiveBrand(
  memberships: SessionMembership[],
): Promise<SessionMembership | undefined> {
  if (memberships.length === 0) return undefined;

  const cookieStore = await cookies();
  const cookieBrandId = cookieStore.get(ACTIVE_BRAND_COOKIE)?.value;

  const fromCookie = memberships.find((m) => m.brandId === cookieBrandId);
  return fromCookie ?? memberships[0];
}
