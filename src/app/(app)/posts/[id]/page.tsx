import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { requireActiveBrand } from "@/lib/require-brand";
import { hasRole, CAN_CREATE, CAN_APPROVE } from "@/lib/rbac";
import StatusBadge from "@/components/status-badge";
import PostActions from "@/components/post-actions";

export default async function PostDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const { brand, memberships, userId } = await requireActiveBrand();

  const post = await prisma.post.findUnique({
    where: { id },
    include: {
      media: true,
      targets: { include: { socialAccount: true } },
      createdBy: true,
      approvedBy: true,
      activities: { include: { user: true }, orderBy: { createdAt: "asc" } },
    },
  });

  if (!post || post.brandId !== brand.brandId) notFound();

  const canCreate = hasRole(memberships, brand.brandId, CAN_CREATE);
  const canApprove = hasRole(memberships, brand.brandId, CAN_APPROVE);
  const isOwner = post.createdById === userId;

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <div className="space-y-4 lg:col-span-2">
        <div className="flex items-center justify-between">
          <h1 className="text-lg font-semibold text-slate-900">Post</h1>
          <StatusBadge status={post.status} />
        </div>

        <div className="rounded-lg border border-slate-200 bg-white p-4">
          {post.media[0] && (
            <div className="mb-4 aspect-video overflow-hidden rounded-md bg-slate-100">
              {post.media[0].type === "VIDEO" ? (
                <video src={post.media[0].url} className="h-full w-full object-cover" controls />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={post.media[0].url} alt="" className="h-full w-full object-cover" />
              )}
            </div>
          )}
          <p className="whitespace-pre-wrap text-sm text-slate-800">{post.caption}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {post.targets.map((t) => (
              <span
                key={t.id}
                className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600"
              >
                {t.platform} · {t.socialAccount.displayName} · {t.publishStatus}
                {t.errorMessage ? `: ${t.errorMessage}` : ""}
              </span>
            ))}
          </div>
          <dl className="mt-4 grid grid-cols-2 gap-2 text-xs text-slate-500">
            <div>
              <dt className="font-medium text-slate-400">Created by</dt>
              <dd>{post.createdBy.name}</dd>
            </div>
            <div>
              <dt className="font-medium text-slate-400">Scheduled for</dt>
              <dd>{post.scheduledAt ? post.scheduledAt.toLocaleString() : "Not set"}</dd>
            </div>
            {post.approvedBy && (
              <div>
                <dt className="font-medium text-slate-400">Approved by</dt>
                <dd>{post.approvedBy.name}</dd>
              </div>
            )}
            {post.rejectedNote && (
              <div className="col-span-2">
                <dt className="font-medium text-slate-400">Rejection note</dt>
                <dd>{post.rejectedNote}</dd>
              </div>
            )}
          </dl>
        </div>

        <PostActions
          postId={post.id}
          status={post.status}
          canCreate={canCreate}
          canApprove={canApprove}
          isOwner={isOwner}
        />
      </div>

      <div>
        <h2 className="mb-2 text-sm font-medium text-slate-900">Activity</h2>
        <ol className="space-y-3 border-l border-slate-200 pl-4">
          {post.activities.map((a) => (
            <li key={a.id} className="text-xs text-slate-500">
              <p className="font-medium text-slate-700">{a.action.replace(/_/g, " ")}</p>
              <p>
                {a.user?.name ?? "System"} · {a.createdAt.toLocaleString()}
              </p>
              {a.note && <p className="mt-0.5 italic">{a.note}</p>}
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
