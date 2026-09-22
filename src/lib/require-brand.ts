import { redirect } from "next/navigation";
import { auth, type SessionMembership } from "@/auth";
import { getActiveBrand } from "@/lib/active-brand";

// Shared guard for (app) pages: resolves the signed-in session and their
// currently-selected brand membership, or redirects if either is missing.
export async function requireActiveBrand(): Promise<{
  userId: string;
  userEmail: string;
  memberships: SessionMembership[];
  brand: SessionMembership;
}> {
  const session = await auth();
  if (!session) redirect("/login");

  const brand = await getActiveBrand(session.user.memberships);
  if (!brand) redirect("/dashboard");

  return {
    userId: session.user.id,
    userEmail: session.user.email,
    memberships: session.user.memberships,
    brand,
  };
}
