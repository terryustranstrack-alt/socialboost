import type { Role } from "@prisma/client";
import type { SessionMembership } from "@/auth";

// Approval is intentionally single-level (PRD 6.3): Admin and Approver can
// approve/reject; Admin and Creator can author drafts; everyone with a
// membership can view.
export const CAN_CREATE: Role[] = ["ADMIN", "CREATOR"];
export const CAN_APPROVE: Role[] = ["ADMIN", "APPROVER"];
export const CAN_MANAGE_BRAND: Role[] = ["ADMIN"];

export function membershipFor(
  memberships: SessionMembership[],
  brandId: string,
): SessionMembership | undefined {
  return memberships.find((m) => m.brandId === brandId);
}

export function hasRole(
  memberships: SessionMembership[],
  brandId: string,
  allowed: Role[],
): boolean {
  const m = membershipFor(memberships, brandId);
  return !!m && allowed.includes(m.role);
}

export function requireRole(
  memberships: SessionMembership[],
  brandId: string,
  allowed: Role[],
): void {
  if (!hasRole(memberships, brandId, allowed)) {
    throw new Error("FORBIDDEN");
  }
}
