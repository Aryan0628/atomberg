// app/api/analytics/overview/route.ts
// COST: 6 parallel Prisma count queries per request without caching.
// Cached 60s via Redis/in-memory → ~90% fewer Neon compute-seconds for this
// endpoint. OrgPulseTicker polls every 30s — 60s TTL means at most 1 real DB
// hit per minute per active cycle instead of 2 per every connected admin tab.

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getActiveCycle } from "@/lib/cycle";
import { withCache } from "@/lib/cache";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  if (!session || !["ADMIN", "HR"].includes(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const cycle = await getActiveCycle();
  if (!cycle) return NextResponse.json({ error: "No active cycle" }, { status: 404 });

  const data = await withCache(`analytics:overview:${cycle.id}`, 60, async () => {
    const [totalEmployees, totalGoals, goalsSubmitted, goalsApproved, goalsLocked, checkins] = await Promise.all([
      prisma.user.count({ where: { role: "EMPLOYEE", isActive: true } }),
      prisma.goal.count({ where: { cycleId: cycle.id } }),
      prisma.goal.count({ where: { cycleId: cycle.id, status: { in: ["SUBMITTED", "APPROVED", "LOCKED"] } } }),
      prisma.goal.count({ where: { cycleId: cycle.id, status: { in: ["APPROVED", "LOCKED"] } } }),
      prisma.goal.count({ where: { cycleId: cycle.id, status: "LOCKED" } }),
      prisma.checkin.count({ where: { cycleId: cycle.id } }),
    ]);

    const goalsWithScores = await prisma.goal.findMany({
      where: { cycleId: cycle.id, latestScore: { not: null } },
      select: { latestScore: true },
    });

    const avgScore = goalsWithScores.length > 0
      ? goalsWithScores.reduce((sum, g) => sum + (g.latestScore || 0), 0) / goalsWithScores.length
      : 0;

    const checkinCompletionRate = goalsLocked > 0 ? checkins / (goalsLocked * 4) : 0;

    return {
      totalEmployees,
      totalGoals,
      goalsSubmitted,
      goalsApproved,
      goalsLocked,
      avgScore: Math.round(avgScore * 10) / 10,
      checkinCompletionRate: Math.round(checkinCompletionRate * 1000) / 10,
      cycleName: cycle.name,
    };
  });

  return NextResponse.json(data, {
    headers: { "Cache-Control": "private, max-age=60, stale-while-revalidate=30" },
  });
}
