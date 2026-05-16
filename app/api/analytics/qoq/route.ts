// app/api/analytics/qoq/route.ts
// GET — Quarter-over-Quarter achievement trends by department

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  if (!session || !["ADMIN", "HR", "MANAGER"].includes(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const activeCycle = await prisma.cycle.findFirst({ where: { isActive: true } });
  if (!activeCycle) return NextResponse.json([]);

  const checkins = await prisma.checkin.findMany({
    where: { cycleId: activeCycle.id, scorePercentage: { not: null } },
    include: { employee: { select: { department: true } } },
  });

  // Group by department and quarter
  const map: Record<string, Record<string, number[]>> = {};
  for (const c of checkins) {
    const dept = c.employee.department || "Unknown";
    if (!map[dept]) map[dept] = {};
    if (!map[dept][c.quarter]) map[dept][c.quarter] = [];
    map[dept][c.quarter].push(c.scorePercentage!);
  }

  // Build chart-friendly structure: [{dept, Q1, Q2, Q3, Q4}]
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

  return NextResponse.json({ data: result, cycleName: activeCycle.name });
}
