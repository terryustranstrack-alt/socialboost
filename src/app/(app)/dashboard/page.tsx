import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireActiveBrand } from "@/lib/require-brand";
import { hasRole, CAN_CREATE, CAN_APPROVE } from "@/lib/rbac";
import { daysAgo } from "@/lib/dates";
import StatusBadge from "@/components/status-badge";

export default async function DashboardPage() {
  const { brand, memberships } = await requireActiveBrand();

  const since30d = daysAgo(30);

  const [pendingApproval, scheduled, recentFailures, recentPosts, engagement] = await Promise.all([
    prisma.post.count({ where: { brandId: brand.brandId, status: "PENDING_APPROVAL" } }),
    prisma.post.count({ where: { brandId: brand.brandId, status: "SCHEDULED" } }),
    prisma.post.count({ where: { brandId: brand.brandId, status: "FAILED" } }),
    prisma.post.findMany({
      where: { brandId: brand.brandId },
      orderBy: { updatedAt: "desc" },
      take: 8,
      include: { targets: true, createdBy: true },
    }),
    prisma.postTarget.aggregate({
      where: {
        post: { brandId: brand.brandId },
        publishStatus: "SUCCESS",
        publishedAt: { gte: since30d },
      },
      _sum: { likeCount: true, commentCount: true, shareCount: true },
    }),
  ]);

  const canCreate = hasRole(memberships, brand.brandId, CAN_CREATE);
  const canApprove = hasRole(memberships, brand.brandId, CAN_APPROVE);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">{brand.brandName}</h1>
          <p className="text-sm text-slate-500">Overview of scheduling activity</p>
        </div>
        {canCreate && (
          <Link
            href="/posts/new"
            className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700"
          >
            New post
          </Link>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label="Pending approval"
          value={pendingApproval}
          href={canApprove ? "/approvals" : "/posts"}
        />
        <StatCard label="Scheduled" value={scheduled} href="/calendar" />
        <StatCard label="Failed publishes" value={recentFailures} href="/posts" tone={recentFailures > 0 ? "danger" : "default"} />
      </div>

      <div className="rounded-lg border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-4 py-3">
          <h2 className="text-sm font-medium text-slate-900">Engagement (last 30 days)</h2>
        </div>
        <div className="grid grid-cols-3 divide-x divide-slate-100">
          <EngagementStat label="Likes" value={engagement._sum.likeCount} />
          <EngagementStat label="Comments" value={engagement._sum.commentCount} />
          <EngagementStat label="Shares" value={engagement._sum.shareCount} />
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-4 py-3">
          <h2 className="text-sm font-medium text-slate-900">Recent posts</h2>
        </div>
        <ul className="divide-y divide-slate-100">
          {recentPosts.length === 0 && (
            <li className="px-4 py-6 text-sm text-slate-500">No posts yet for this brand.</li>
          )}
          {recentPosts.map((post) => (
            <li key={post.id} className="flex items-center justify-between px-4 py-3">
              <Link href={`/posts/${post.id}`} className="min-w-0 flex-1">
                <p className="truncate text-sm text-slate-800">{post.caption}</p>
                <p className="text-xs text-slate-500">
                  by {post.createdBy.name} ·{" "}
                  {post.targets.map((t) => t.platform).join(", ") || "no platforms"}
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

function EngagementStat({ label, value }: { label: string; value: number | null }) {
  return (
    <div className="px-4 py-3 text-center">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 text-xl font-semibold text-slate-900">{value ?? 0}</p>
    </div>
  );
}

function StatCard({
  label,
  value,
  href,
  tone = "default",
}: {
  label: string;
  value: number;
  href: string;
  tone?: "default" | "danger";
}) {
  return (
    <Link
      href={href}
      className="block rounded-lg border border-slate-200 bg-white p-4 hover:border-slate-300"
    >
      <p className="text-sm text-slate-500">{label}</p>
      <p className={`mt-1 text-2xl font-semibold ${tone === "danger" && value > 0 ? "text-red-600" : "text-slate-900"}`}>
        {value}
      </p>
    </Link>
  );
}
