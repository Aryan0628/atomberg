// app/api/cycles/[id]/clone/route.ts
// POST — clone an existing cycle, shifting all dates 1 year forward
// Also clones escalation rules. Sets isActive: false — admin activates manually.
// COST: Pure DB operation — no external API calls.

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import { NextResponse } from "next/server";

function shiftOneYear(date: Date): Date {
  const d = new Date(date);
  d.setFullYear(d.getFullYear() + 1);
  return d;
}

export async function POST(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session || !["ADMIN", "HR"].includes(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const source = await prisma.cycle.findUnique({
    where: { id },
    include: { escalationRules: true },
  });
  if (!source) return NextResponse.json({ error: "Cycle not found" }, { status: 404 });

  // Parse fiscal year and bump by 1: "FY 2026-27" → "FY 2027-28"
  const nextFY = source.fiscalYear.replace(/(\d{4})-(\d{2,4})/g, (_: string, y1: string, y2: string) => {
    const n1 = parseInt(y1) + 1;
    const n2 = parseInt(y2) + 1;
    return `${n1}-${n2 > 99 ? n2 : String(n2).padStart(2, "0")}`;
  });

  const newCycle = await prisma.cycle.create({
    data: {
      name: `${source.name.replace(/\(Clone\)\s?/g, "")} (Clone)`,
      fiscalYear: nextFY,
      isActive: false,
      createdBy: session.user.id,
      goalSettingOpen: shiftOneYear(source.goalSettingOpen),
      goalSettingClose: shiftOneYear(source.goalSettingClose),
      q1Open: shiftOneYear(source.q1Open),
      q1Close: shiftOneYear(source.q1Close),
      q2Open: shiftOneYear(source.q2Open),
      q2Close: shiftOneYear(source.q2Close),
      q3Open: shiftOneYear(source.q3Open),
      q3Close: shiftOneYear(source.q3Close),
      q4Open: shiftOneYear(source.q4Open),
      q4Close: shiftOneYear(source.q4Close),
    },
  });

  // Clone escalation rules
  if (source.escalationRules.length > 0) {
    await prisma.escalationRule.createMany({
      data: source.escalationRules.map((r) => ({
        cycleId: newCycle.id,
        trigger: r.trigger,
        daysAfterTrigger: r.daysAfterTrigger,
        escalateTo: r.escalateTo,
        isActive: r.isActive,
      })),
    });
  }

  await writeAudit({
    userId: session.user.id,
    action: "CYCLE_CLONED",
    entityType: "Cycle",
    entityId: newCycle.id,
    newValue: { sourceCycleId: id, newCycleId: newCycle.id, fiscalYear: nextFY },
  });

  return NextResponse.json({ success: true, cycle: newCycle });
}
