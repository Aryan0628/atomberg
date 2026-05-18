// app/api/analytics/leaderboard/route.ts
// GET — Department leaderboard: ranked by average weighted goal score.

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getActiveCycle } from "@/lib/cycle";
import { withCache } from "@/lib/cache";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  if (!session || !["ADMIN", "HR", "MANAGER"].includes(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const activeCycle = await getActiveCycle();
  if (!activeCycle) return NextResponse.json({ departments: [], employees: [] });

  const result = await withCache(`analytics:leaderboard:${activeCycle.id}`, 120, async () => {
    const goals = await prisma.goal.findMany({
      where: { cycleId: activeCycle.id, status: { in: ["APPROVED", "LOCKED"] } },
      include: { owner: { select: { id: true, name: true, department: true } } },
    });

    // Department leaderboard
    const deptMap: Record<string, { scores: number[]; total: number; filled: number }> = {};
    // Employee leaderboard
    const empMap: Record<string, { name: string; dept: string; scores: number[]; weightages: number[] }> = {};

    for (const g of goals) {
      const dept = g.owner.department || "Unknown";
      if (!deptMap[dept]) deptMap[dept] = { scores: [], total: 0, filled: 0 };
      deptMap[dept].total++;
      if (g.latestScore !== null) {
        deptMap[dept].scores.push(g.latestScore);
        deptMap[dept].filled++;
      }

      const { id, name } = g.owner;
      if (!empMap[id]) empMap[id] = { name, dept, scores: [], weightages: [] };
      if (g.latestScore !== null) {
        empMap[id].scores.push(g.latestScore);
        empMap[id].weightages.push(g.weightage);
      }
    }

    const departments = Object.entries(deptMap)
      .map(([name, d]) => ({
        name,
        avgScore: d.scores.length > 0 ? Math.round((d.scores.reduce((a, b) => a + b, 0) / d.scores.length) * 10) / 10 : 0,
        totalGoals: d.total,
        scoredGoals: d.filled,
        completionRate: d.total > 0 ? Math.round((d.filled / d.total) * 100) : 0,
      }))
      .sort((a, b) => b.avgScore - a.avgScore);

    const employees = Object.entries(empMap)
      .map(([, d]) => {
        const totalW = d.weightages.reduce((a, b) => a + b, 0);
        const weightedScore = totalW > 0
          ? d.scores.reduce((sum, s, i) => sum + (s * d.weightages[i]) / totalW, 0)
          : 0;
        return { name: d.name, dept: d.dept, weightedScore: Math.round(weightedScore * 10) / 10 };
      })
      .sort((a, b) => b.weightedScore - a.weightedScore)
      .slice(0, 15);

    return { departments, employees };
  });

  return NextResponse.json(result, {
    headers: { "Cache-Control": "private, max-age=120, stale-while-revalidate=60" },
  });
}
