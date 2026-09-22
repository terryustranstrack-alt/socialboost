"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { PostStatus } from "@prisma/client";
import { submitForApproval, approvePost, rejectPost, deletePost } from "@/app/actions/posts";

export default function PostActions({
  postId,
  status,
  canCreate,
  canApprove,
  isOwner,
}: {
  postId: string;
  status: PostStatus;
  canCreate: boolean;
  canApprove: boolean;
  isOwner: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [rejectNote, setRejectNote] = useState("");
  const [showReject, setShowReject] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function run(action: () => Promise<void>) {
    setError(null);
    startTransition(async () => {
      try {
        await action();
        router.refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Something went wrong");
      }
    });
  }

  const buttons: React.ReactNode[] = [];

  if (status === "DRAFT" && (canCreate || isOwner)) {
    buttons.push(
      <button
        key="submit"
        disabled={isPending}
        onClick={() => run(() => submitForApproval(postId))}
        className="rounded-md bg-slate-900 px-4 py-2 text-sm font-medium text-white hover:bg-slate-700 disabled:opacity-50"
      >
        Submit for approval
      </button>,
    );
  }

  if ((status === "DRAFT" || status === "REJECTED") && (canCreate || isOwner)) {
    buttons.push(
      <button
        key="delete"
        disabled={isPending}
        onClick={() => run(() => deletePost(postId))}
        className="rounded-md border border-red-200 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
      >
        Delete
      </button>,
    );
  }

  if (status === "PENDING_APPROVAL" && canApprove) {
    buttons.push(
      <button
        key="approve"
        disabled={isPending}
        onClick={() => run(() => approvePost(postId))}
        className="rounded-md bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
      >
        Approve
      </button>,
    );
    buttons.push(
      <button
        key="reject"
        disabled={isPending}
        onClick={() => setShowReject((v) => !v)}
        className="rounded-md border border-red-200 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
      >
        Reject
      </button>,
    );
  }

  return (
    <div className="space-y-3">
      {error && (
        <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}
      <div className="flex flex-wrap gap-2">{buttons}</div>
      {showReject && (
        <div className="space-y-2 rounded-md border border-slate-200 bg-slate-50 p-3">
          <textarea
            value={rejectNote}
            onChange={(e) => setRejectNote(e.target.value)}
            placeholder="Why is this being rejected? (optional but helpful)"
            rows={2}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          />
          <button
            disabled={isPending}
            onClick={() => run(() => rejectPost(postId, rejectNote))}
            className="rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
          >
            Confirm rejection
          </button>
        </div>
      )}
    </div>
  );
}
