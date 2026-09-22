import { redirect } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireActiveBrand } from "@/lib/require-brand";
import { hasRole, CAN_APPROVE } from "@/lib/rbac";

export default async function ApprovalsPage() {
  const { brand, memberships } = await requireActiveBrand();
  if (!hasRole(memberships, brand.brandId, CAN_APPROVE)) redirect("/dashboard");

  const posts = await prisma.post.findMany({
    where: { brandId: brand.brandId, status: "PENDING_APPROVAL" },
    orderBy: { createdAt: "asc" },
    include: { targets: true, createdBy: true, media: true },
  });

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold text-slate-900">Approvals — {brand.brandName}</h1>
      <p className="text-sm text-slate-500">
        {posts.length} post{posts.length === 1 ? "" : "s"} waiting for a decision.
      </p>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {posts.map((post) => (
          <Link
            key={post.id}
            href={`/posts/${post.id}`}
            className="block overflow-hidden rounded-lg border border-slate-200 bg-white hover:border-slate-300"
          >
            {post.media[0] && (
              <div className="aspect-square bg-slate-100">
                {post.media[0].type === "VIDEO" ? (
                  <video src={post.media[0].url} className="h-full w-full object-cover" />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={post.media[0].url} alt="" className="h-full w-full object-cover" />
                )}
              </div>
            )}
            <div className="p-3">
              <p className="line-clamp-3 text-sm text-slate-800">{post.caption}</p>
              <p className="mt-2 text-xs text-slate-500">
                by {post.createdBy.name} · {post.targets.map((t) => t.platform).join(", ")}
              </p>
            </div>
          </Link>
        ))}
        {posts.length === 0 && (
          <p className="text-sm text-slate-500">Nothing pending — you&apos;re all caught up.</p>
        )}
      </div>
    </div>
  );
}
