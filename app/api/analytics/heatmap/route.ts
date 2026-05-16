// app/api/analytics/heatmap/route.ts
// GET — Employee x Quarter achievement grid (for D3 heatmap)

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  if (!session || !["ADMIN", "HR", "MANAGER"].includes(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const activeCycle = await prisma.cycle.findFirst({ where: { isActive: true } });
  if (!activeCycle) return NextResponse.json({ employees: [], quarters: [] });

  const checkins = await prisma.checkin.findMany({
    where: { cycleId: activeCycle.id },
    include: { employee: { select: { id: true, name: true, department: true } } },
  });

  // Build map: employeeId → quarter → avg score
  const empMap: Record<string, { name: string; department: string; scores: Record<string, number[]> }> = {};

  for (const c of checkins) {
    const { id, name, department } = c.employee;
    if (!empMap[id]) empMap[id] = { name, department: department || "Unknown", scores: {} };
    if (!empMap[id].scores[c.quarter]) empMap[id].scores[c.quarter] = [];
    if (c.scorePercentage !== null) empMap[id].scores[c.quarter].push(c.scorePercentage);
  }

  const quarters = ["Q1", "Q2", "Q3", "Q4"];

  const cells: { employeeId: string; employeeName: string; department: string; quarter: string; score: number }[] = [];
  for (const [empId, data] of Object.entries(empMap)) {
    for (const q of quarters) {
      const scores = data.scores[q] || [];
      const avg = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : null;
      cells.push({
        employeeId: empId,
        employeeName: data.name,
        department: data.department,
        quarter: q,
        score: avg !== null ? Math.round(avg * 10) / 10 : -1, // -1 = no data
      });
    }
  }

  return NextResponse.json({ cells, cycleName: activeCycle.name });
}
