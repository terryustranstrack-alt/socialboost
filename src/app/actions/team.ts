"use server";

import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { requireRole, CAN_MANAGE_BRAND } from "@/lib/rbac";
import type { Role } from "@prisma/client";

async function requireSession() {
  const session = await auth();
  if (!session) throw new Error("UNAUTHENTICATED");
  return session;
}

export async function addTeamMember(formData: FormData) {
  const session = await requireSession();
  const brandId = String(formData.get("brandId") ?? "");
  requireRole(session.user.memberships, brandId, CAN_MANAGE_BRAND);

  const email = String(formData.get("email") ?? "").toLowerCase().trim();
  const name = String(formData.get("name") ?? "").trim();
  const role = String(formData.get("role") ?? "VIEWER") as Role;
  const password = String(formData.get("password") ?? "");

  if (!email) throw new Error("Email is required");

  const existing = await prisma.user.findUnique({ where: { email } });
  if (!existing && !password) {
    throw new Error("Set an initial password for new team members");
  }

  const passwordHash = password ? await bcrypt.hash(password, 10) : undefined;

  const user = await prisma.user.upsert({
    where: { email },
    update: passwordHash ? { passwordHash } : {},
    create: {
      email,
      name: name || email,
      passwordHash: passwordHash!,
    },
  });

  await prisma.membership.upsert({
    where: { userId_brandId: { userId: user.id, brandId } },
    update: { role },
    create: { userId: user.id, brandId, role },
  });

  revalidatePath("/settings/team");
}

export async function removeTeamMember(membershipId: string) {
  const session = await requireSession();
  const membership = await prisma.membership.findUniqueOrThrow({ where: { id: membershipId } });
  requireRole(session.user.memberships, membership.brandId, CAN_MANAGE_BRAND);

  await prisma.membership.delete({ where: { id: membershipId } });
  revalidatePath("/settings/team");
}
