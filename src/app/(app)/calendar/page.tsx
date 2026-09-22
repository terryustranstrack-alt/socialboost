import Link from "next/link";
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  addMonths,
  subMonths,
  format,
  isSameMonth,
  isToday,
} from "date-fns";
import type { Platform, PostStatus } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { requireActiveBrand } from "@/lib/require-brand";
import StatusBadge from "@/components/status-badge";

export default async function CalendarPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; platform?: string; status?: string }>;
}) {
  const { brand } = await requireActiveBrand();
  const params = await searchParams;

  const anchor = params.month ? new Date(`${params.month}-01T00:00:00`) : new Date();
  const monthStart = startOfMonth(anchor);
  const monthEnd = endOfMonth(anchor);
  const gridStart = startOfWeek(monthStart);
  const gridEnd = endOfWeek(monthEnd);
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd });

  const [accounts, posts] = await Promise.all([
    prisma.socialAccount.findMany({
      where: { brandId: brand.brandId },
      select: { id: true, platform: true, displayName: true },
    }),
    prisma.post.findMany({
      where: {
        brandId: brand.brandId,
        scheduledAt: { gte: gridStart, lte: gridEnd },
        ...(params.status ? { status: params.status as PostStatus } : {}),
        ...(params.platform
          ? { targets: { some: { platform: params.platform as Platform } } }
          : {}),
      },
      include: { targets: true },
      orderBy: { scheduledAt: "asc" },
    }),
  ]);

  const postsByDay = new Map<string, typeof posts>();
  for (const post of posts) {
    if (!post.scheduledAt) continue;
    const key = format(post.scheduledAt, "yyyy-MM-dd");
    postsByDay.set(key, [...(postsByDay.get(key) ?? []), post]);
  }

  const prevMonth = format(subMonths(monthStart, 1), "yyyy-MM");
  const nextMonth = format(addMonths(monthStart, 1), "yyyy-MM");
  const monthParam = format(monthStart, "yyyy-MM");

  function withParams(overrides: Record<string, string | undefined>) {
    const p = new URLSearchParams();
    p.set("month", overrides.month ?? monthParam);
    const platform = "platform" in overrides ? overrides.platform : params.platform;
    const status = "status" in overrides ? overrides.status : params.status;
    if (platform) p.set("platform", platform);
    if (status) p.set("status", status);
    return `/calendar?${p.toString()}`;
  }

  const platforms = Array.from(new Set(accounts.map((a) => a.platform)));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-lg font-semibold text-slate-900">
          {format(monthStart, "MMMM yyyy")} — {brand.brandName}
        </h1>
        <div className="flex items-center gap-2">
          <Link href={withParams({ month: prevMonth })} className="rounded-md border border-slate-300 px-3 py-1.5 text-sm">
            ← Prev
          </Link>
          <Link href={withParams({ month: format(new Date(), "yyyy-MM") })} className="rounded-md border border-slate-300 px-3 py-1.5 text-sm">
            Today
          </Link>
          <Link href={withParams({ month: nextMonth })} className="rounded-md border border-slate-300 px-3 py-1.5 text-sm">
            Next →
          </Link>
        </div>
      </div>

      <div className="flex flex-wrap gap-2">
        <Link
          href={withParams({ platform: undefined })}
          className={`rounded-full px-3 py-1 text-xs font-medium ${!params.platform ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600"}`}
        >
          All platforms
        </Link>
        {platforms.map((p) => (
          <Link
            key={p}
            href={withParams({ platform: p })}
            className={`rounded-full px-3 py-1 text-xs font-medium ${params.platform === p ? "bg-slate-900 text-white" : "bg-slate-100 text-slate-600"}`}
          >
            {p}
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-px overflow-hidden rounded-lg border border-slate-200 bg-slate-200 text-xs">
        {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
          <div key={d} className="bg-slate-50 px-2 py-1.5 text-center font-medium text-slate-500">
            {d}
          </div>
        ))}
        {days.map((day) => {
          const key = format(day, "yyyy-MM-dd");
          const dayPosts = postsByDay.get(key) ?? [];
          return (
            <div
              key={key}
              className={`min-h-[100px] bg-white p-1.5 ${!isSameMonth(day, monthStart) ? "opacity-40" : ""}`}
            >
              <p className={`mb-1 text-right text-xs ${isToday(day) ? "font-bold text-slate-900" : "text-slate-500"}`}>
                {format(day, "d")}
              </p>
              <div className="space-y-1">
                {dayPosts.slice(0, 3).map((post) => (
                  <Link
                    key={post.id}
                    href={`/posts/${post.id}`}
                    className="block truncate rounded bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-700 hover:bg-slate-200"
                    title={post.caption}
                  >
                    {post.caption}
                  </Link>
                ))}
                {dayPosts.length > 3 && (
                  <p className="text-[11px] text-slate-400">+{dayPosts.length - 3} more</p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-2 pt-2 text-xs text-slate-500">
        Legend:
        {(["SCHEDULED", "PUBLISHED", "FAILED"] as PostStatus[]).map((s) => (
          <StatusBadge key={s} status={s} />
        ))}
      </div>
    </div>
  );
}
