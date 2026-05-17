// app/api/analytics/qoq/route.ts
// GET — Quarter-over-Quarter achievement trends by department
// COST: Full checkin table scan with employee join on every request.
// Cached 120s — trend data is historical and changes only after each check-in
// submission. 2-minute TTL is imperceptible to analytics consumers.

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { withCache } from "@/lib/cache";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  if (!session || !["ADMIN", "HR", "MANAGER"].includes(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const activeCycle = await prisma.cycle.findFirst({ where: { isActive: true } });
  if (!activeCycle) return NextResponse.json([]);

  const data = await withCache(`analytics:qoq:${activeCycle.id}`, 120, async () => {
    const checkins = await prisma.checkin.findMany({
      where: { cycleId: activeCycle.id, scorePercentage: { not: null } },
      include: { employee: { select: { department: true } } },
    });

    const map: Record<string, Record<string, number[]>> = {};
    for (const c of checkins) {
      const dept = c.employee.department || "Unknown";
      if (!map[dept]) map[dept] = {};
      if (!map[dept][c.quarter]) map[dept][c.quarter] = [];
      map[dept][c.quarter].push(c.scorePercentage!);
    }

    const quarters = ["Q1", "Q2", "Q3", "Q4"];
    const result = Object.entries(map).map(([dept, qMap]) => {
      const entry: Record<string, string | number> = { department: dept };
      for (const q of quarters) {
        const scores = qMap[q] || [];
        entry[q] = scores.length > 0
          ? Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 10) / 10
          : 0;
      }
      return entry;
    });

    return { data: result, cycleName: activeCycle.name };
  });

  return NextResponse.json(data, {
    headers: { "Cache-Control": "private, max-age=120, stale-while-revalidate=60" },
  });
}
