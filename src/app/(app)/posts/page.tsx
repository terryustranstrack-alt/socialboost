import Link from "next/link";
import type { PostStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireActiveBrand } from "@/lib/require-brand";
import { hasRole, CAN_CREATE } from "@/lib/rbac";
import StatusBadge from "@/components/status-badge";

const STATUS_FILTERS: PostStatus[] = [
  "DRAFT",
  "PENDING_APPROVAL",
  "SCHEDULED",
  "PUBLISHED",
  "FAILED",
  "REJECTED",
];

export default async function PostsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { brand, memberships } = await requireActiveBrand();
  const { status } = await searchParams;
  const canCreate = hasRole(memberships, brand.brandId, CAN_CREATE);

  const posts = await prisma.post.findMany({
    where: {
      brandId: brand.brandId,
      ...(status && STATUS_FILTERS.includes(status as PostStatus)
        ? { status: status as PostStatus }
        : {}),
    },
    orderBy: { updatedAt: "desc" },
    include: { targets: true, createdBy: true },
    take: 100,
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-slate-900">Posts</h1>
        {canCreate && (
          <Link
            href="/posts/new"
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
          >
            New post
          </Link>
        )}
      </div>

      <div className="flex flex-wrap gap-2">
        <FilterLink label="All" active={!status} href="/posts" />
        {STATUS_FILTERS.map((s) => (
          <FilterLink key={s} label={s.replace("_", " ")} active={status === s} href={`/posts?status=${s}`} />
        ))}
      </div>

      <div className="rounded-lg border border-slate-200 bg-white">
        <ul className="divide-y divide-slate-100">
          {posts.length === 0 && (
            <li className="px-4 py-6 text-sm text-slate-500">No posts match this filter.</li>
          )}
          {posts.map((post) => (
            <li key={post.id} className="flex items-center justify-between gap-4 px-4 py-3">
              <Link href={`/posts/${post.id}`} className="min-w-0 flex-1">
                <p className="truncate text-sm text-slate-800">{post.caption}</p>
                <p className="text-xs text-slate-500">
                  by {post.createdBy.name} ·{" "}
                  {post.targets.map((t) => t.platform).join(", ") || "no platforms"}
                  {post.scheduledAt ? ` · ${post.scheduledAt.toLocaleString()}` : ""}
                </p>
              </Link>
              <StatusBadge status={post.status} />
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function FilterLink({ label, active, href }: { label: string; active: boolean; href: string }) {
  return (
    <Link
      href={href}
      className={`rounded-full px-3 py-1 text-xs font-medium capitalize ${
        active ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
      }`}
    >
      {label.toLowerCase()}
    </Link>
  );
}
