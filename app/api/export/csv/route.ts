// app/api/export/csv/route.ts
// GET — download CSV of all goals for the active cycle

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { generateCSV } from "@/lib/export";
import { writeAudit } from "@/lib/audit";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  if (!session || !["ADMIN", "HR", "MANAGER"].includes(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const activeCycle = await prisma.cycle.findFirst({ where: { isActive: true } });
  if (!activeCycle) return NextResponse.json({ error: "No active cycle" }, { status: 400 });

  const goals = await prisma.goal.findMany({
    where: { cycleId: activeCycle.id },
    include: {
      owner: { select: { name: true, email: true, department: true } },
      approver: { select: { name: true } },
      checkins: { orderBy: { quarter: "asc" } },
    },
    orderBy: [{ owner: { name: "asc" } }, { thrustArea: "asc" }],
  });

  const rows = goals.map((g) => {
    const checkinMap = Object.fromEntries(g.checkins.map((c) => [c.quarter, c.scorePercentage]));
    return {
      Employee: g.owner.name,
      Email: g.owner.email,
      Department: g.owner.department || "",
      "Goal Title": g.title,
      "Thrust Area": g.thrustArea,
      "UoM Type": g.uomType,
      Target: g.target ?? "",
      "Target Date": g.targetDate ? new Date(g.targetDate).toISOString().slice(0, 10) : "",
      "Weightage %": g.weightage,
      Status: g.status,
      "Approved By": g.approver?.name || "",
      "Latest Score %": g.latestScore ?? "",
      "Q1 Score %": checkinMap.Q1 ?? "",
      "Q2 Score %": checkinMap.Q2 ?? "",
      "Q3 Score %": checkinMap.Q3 ?? "",
      "Q4 Score %": checkinMap.Q4 ?? "",
    };
  });

  const csv = generateCSV(rows);

  await writeAudit({
    userId: session.user.id,
    action: "EXPORT_GENERATED",
    entityType: "Cycle",
    entityId: activeCycle.id,
    newValue: { format: "csv", rowCount: rows.length },
  });

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="goals-${activeCycle.fiscalYear}.csv"`,
    },
  });
}
