import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { decryptToken } from "@/lib/crypto";
import { fetchInstagramMetrics, fetchFacebookMetrics } from "@/lib/meta";
import { daysAgo } from "@/lib/dates";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Kept small and sequential for the same rate-limit reason as
// /api/cron/publish. Only refreshes posts published in the last
// LOOKBACK_DAYS — older posts' engagement has effectively settled and
// isn't worth spending API calls (or cron time) on.
const BATCH_SIZE = 30;
const LOOKBACK_DAYS = 30;

function isAuthorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true; // no secret configured (e.g. local dev)
  const header = req.headers.get("authorization");
  return header === `Bearer ${secret}`;
}

export async function GET(req: Request) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const since = daysAgo(LOOKBACK_DAYS);

  const targets = await prisma.postTarget.findMany({
    where: {
      publishStatus: "SUCCESS",
      platformPostId: { not: null },
      publishedAt: { gte: since },
      platform: { in: ["INSTAGRAM", "FACEBOOK"] },
    },
    orderBy: { publishedAt: "desc" },
    take: BATCH_SIZE,
    include: { socialAccount: true },
  });

  let updated = 0;
  for (const target of targets) {
    try {
      const accessToken = decryptToken(target.socialAccount.accessTokenCipher);
      const metrics =
        target.platform === "INSTAGRAM"
          ? await fetchInstagramMetrics(target.platformPostId!, accessToken)
          : await fetchFacebookMetrics(target.platformPostId!, accessToken);

      await prisma.postTarget.update({
        where: { id: target.id },
        data: { ...metrics, metricsFetchedAt: new Date() },
      });
      updated++;
    } catch {
      // Best-effort refresh — leave the stale snapshot and move on.
    }
  }

  return NextResponse.json({ checked: targets.length, updated });
}
