import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireActiveBrand } from "@/lib/require-brand";
import { hasRole, CAN_CREATE } from "@/lib/rbac";
import PostComposer from "@/components/post-composer";

export default async function NewPostPage() {
  const { brand, memberships } = await requireActiveBrand();
  if (!hasRole(memberships, brand.brandId, CAN_CREATE)) redirect("/posts");

  const accounts = await prisma.socialAccount.findMany({
    where: { brandId: brand.brandId, isActive: true },
    orderBy: { platform: "asc" },
    select: { id: true, platform: true, displayName: true },
  });

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold text-slate-900">New post — {brand.brandName}</h1>
      <PostComposer brandId={brand.brandId} accounts={accounts} />
    </div>
  );
}
