import type { PostStatus } from "@prisma/client";

const STYLES: Record<PostStatus, string> = {
  DRAFT: "bg-slate-100 text-slate-700",
  PENDING_APPROVAL: "bg-amber-100 text-amber-800",
  APPROVED: "bg-blue-100 text-blue-800",
  SCHEDULED: "bg-blue-100 text-blue-800",
  PUBLISHING: "bg-indigo-100 text-indigo-800",
  PUBLISHED: "bg-green-100 text-green-800",
  FAILED: "bg-red-100 text-red-800",
  REJECTED: "bg-red-100 text-red-800",
};

const LABELS: Record<PostStatus, string> = {
  DRAFT: "Draft",
  PENDING_APPROVAL: "Pending approval",
  APPROVED: "Approved",
  SCHEDULED: "Scheduled",
  PUBLISHING: "Publishing",
  PUBLISHED: "Published",
  FAILED: "Failed",
  REJECTED: "Rejected",
};

export default function StatusBadge({ status }: { status: PostStatus }) {
  return (
    <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ${STYLES[status]}`}>
      {LABELS[status]}
    </span>
  );
}
