"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { refreshPostMetrics } from "@/app/actions/metrics";

export default function RefreshMetricsButton({ postId }: { postId: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  return (
    <button
      disabled={isPending}
      onClick={() =>
        startTransition(async () => {
          await refreshPostMetrics(postId);
          router.refresh();
        })
      }
      className="rounded-md border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
    >
      {isPending ? "Refreshing…" : "Refresh metrics"}
    </button>
  );
}
