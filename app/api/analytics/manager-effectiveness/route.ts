// app/api/analytics/manager-effectiveness/route.ts
// GET — Manager effectiveness: check-in completion rate + avg team score

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  if (!session || !["ADMIN", "HR"].includes(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const activeCycle = await prisma.cycle.findFirst({ where: { isActive: true } });
  if (!activeCycle) return NextResponse.json([]);

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

  const result = managers.map((mgr) => {
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

    const checkinCompletionRate = totalExpectedCheckins > 0
      ? Math.round((totalActualCheckins / totalExpectedCheckins) * 1000) / 10
      : 0;
    const reviewCompletionRate = totalActualCheckins > 0
      ? Math.round((totalManagerReviewed / totalActualCheckins) * 1000) / 10
      : 0;

    return {
      managerId: mgr.id,
      managerName: mgr.name,
      department: mgr.department || "Unknown",
      totalReports,
      checkinCompletionRate,
      reviewCompletionRate,
      avgTeamScore,
    };
  }).filter(Boolean);

  return NextResponse.json(result);
}
