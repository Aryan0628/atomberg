// app/api/export/excel/route.ts
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { generateExcel } from "@/lib/export";
import { writeAudit } from "@/lib/audit";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const session = await auth();
  if (!session || !["ADMIN", "HR"].includes(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const cycle = await prisma.cycle.findFirst({ where: { isActive: true } });
  if (!cycle) return NextResponse.json({ error: "No active cycle" }, { status: 404 });

  const goals = await prisma.goal.findMany({
    where: { cycleId: cycle.id },
    include: {
      owner: { select: { name: true, email: true, department: true } },
      approver: { select: { name: true } },
      checkins: true,
    },
  });

  const rows = goals.map((g) => ({
    "Employee Name": g.owner.name,
    "Email": g.owner.email,
    "Department": g.owner.department || "—",
    "Goal Title": g.title,
    "Thrust Area": g.thrustArea,
    "UoM Type": g.uomType,
    "Target": g.target || "—",
    "Weightage %": g.weightage,
    "Status": g.status,
    "Score": g.latestScore || "—",
    "Approved By": g.approver?.name || "—",
    "Q1 Score": g.checkins.find((c) => c.quarter === "Q1")?.scorePercentage || "—",
    "Q2 Score": g.checkins.find((c) => c.quarter === "Q2")?.scorePercentage || "—",
    "Q3 Score": g.checkins.find((c) => c.quarter === "Q3")?.scorePercentage || "—",
    "Q4 Score": g.checkins.find((c) => c.quarter === "Q4")?.scorePercentage || "—",
  }));

  const buffer = generateExcel(rows, `Goals_${cycle.fiscalYear}`);

  await writeAudit({
    userId: session.user.id,
    action: "EXPORT_GENERATED",
    entityType: "Export",
    entityId: cycle.id,
    newValue: { format: "xlsx", rowCount: rows.length },
  });

  return new Response(buffer as unknown as BodyInit, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="AtomQuest_Goals_${cycle.fiscalYear}.xlsx"`,
    },
  });
}
