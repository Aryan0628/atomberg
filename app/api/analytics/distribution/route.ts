// app/api/analytics/distribution/route.ts
// GET — Goal distribution by thrust area and UoM type
// COST: Single broad goal select (all goals in cycle). Cached 120s —
// distribution data shifts only when new goals are created or approved,
// which happens rarely compared to how often this chart is viewed.

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { withCache } from "@/lib/cache";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  if (!session || !["ADMIN", "HR"].includes(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const activeCycle = await prisma.cycle.findFirst({ where: { isActive: true } });
  if (!activeCycle) return NextResponse.json({ byThrustArea: [], byUoM: [], byStatus: [] });

  const data = await withCache(`analytics:distribution:${activeCycle.id}`, 120, async () => {
    const goals = await prisma.goal.findMany({
      where: { cycleId: activeCycle.id },
      select: { thrustArea: true, uomType: true, status: true, latestScore: true },
    });

    const thrustMap: Record<string, number> = {};
    const uomMap: Record<string, number> = {};
    const statusMap: Record<string, number> = {};
    for (const g of goals) {
      thrustMap[g.thrustArea] = (thrustMap[g.thrustArea] || 0) + 1;
      uomMap[g.uomType] = (uomMap[g.uomType] || 0) + 1;
      statusMap[g.status] = (statusMap[g.status] || 0) + 1;
    }

    const byThrustArea = Object.entries(thrustMap).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
    const byUoM = Object.entries(uomMap).map(([name, count]) => ({ name, count }));
    const byStatus = Object.entries(statusMap).map(([name, value]) => ({ name, value }));

    const scored = goals.filter((g) => g.latestScore !== null);
    const buckets = [
      { range: "0-49", min: 0, max: 49, count: 0 },
      { range: "50-69", min: 50, max: 69, count: 0 },
      { range: "70-89", min: 70, max: 89, count: 0 },
      { range: "90-100", min: 90, max: 100, count: 0 },
      { range: "100+", min: 101, max: Infinity, count: 0 },
    ];
    for (const g of scored) {
      const score = g.latestScore!;
      const bucket = buckets.find((b) => score >= b.min && score <= b.max);
      if (bucket) bucket.count++;
    }

    return { byThrustArea, byUoM, byStatus, scoreDistribution: buckets };
  });

  return NextResponse.json(data, {
    headers: { "Cache-Control": "private, max-age=120, stale-while-revalidate=60" },
  });
}
