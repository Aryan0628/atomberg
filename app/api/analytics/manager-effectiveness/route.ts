// app/api/analytics/manager-effectiveness/route.ts
// GET — Manager effectiveness: check-in completion rate + avg team score
// COST: Deep nested include (managers → reports → checkins + goals).
// Most expensive analytics query — O(managers × reports × checkins).
// Cached 60s: freshness matters here (manager review status changes intra-day)
// but sub-minute precision isn't needed for a trend chart.

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

  const activeCycle = await getActiveCycle();
  if (!activeCycle) return NextResponse.json([]);

  const result = await withCache(`analytics:manager-effectiveness:${activeCycle.id}`, 60, async () => {
    const managers = await prisma.user.findMany({
      where: { role: "MANAGER", isActive: true },
      include: {
        reports: {
          where: { isActive: true },
          include: {
            checkins: { where: { cycleId: activeCycle.id } },
            ownedGoals: {
              where: { cycleId: activeCycle.id, isLocked: true },
              select: { id: true },
            },
          },
        },
      },
    });

    return managers.map((mgr) => {
      const totalReports = mgr.reports.length;
      if (totalReports === 0) return null;

      const totalExpectedCheckins = mgr.reports.reduce((sum, r) => sum + r.ownedGoals.length * 4, 0);
      const totalActualCheckins = mgr.reports.reduce((sum, r) => sum + r.checkins.length, 0);
      const totalManagerReviewed = mgr.reports.reduce(
        (sum, r) => sum + r.checkins.filter((c) => c.managerCheckedIn).length,
        0
      );

      const allScores = mgr.reports.flatMap((r) =>
        r.checkins.filter((c) => c.scorePercentage !== null).map((c) => c.scorePercentage!)
      );
      const avgTeamScore = allScores.length > 0
        ? Math.round((allScores.reduce((a, b) => a + b, 0) / allScores.length) * 10) / 10
        : 0;

      return {
        managerId: mgr.id,
        managerName: mgr.name,
        department: mgr.department || "Unknown",
        totalReports,
        checkinCompletionRate: totalExpectedCheckins > 0
          ? Math.round((totalActualCheckins / totalExpectedCheckins) * 1000) / 10 : 0,
        reviewCompletionRate: totalActualCheckins > 0
          ? Math.round((totalManagerReviewed / totalActualCheckins) * 1000) / 10 : 0,
        avgTeamScore,
      };
    }).filter(Boolean);
  });

  return NextResponse.json(result, {
    headers: { "Cache-Control": "private, max-age=60, stale-while-revalidate=30" },
  });
}
