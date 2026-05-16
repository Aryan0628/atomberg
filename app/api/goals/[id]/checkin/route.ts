// app/api/goals/[id]/checkin/route.ts
// POST — employee check-in

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { CheckinSchema } from "@/lib/validations";
import { computeScore } from "@/lib/scoring";
import { writeAudit } from "@/lib/audit";
import { NextResponse } from "next/server";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const parsed = CheckinSchema.safeParse({ ...body, goalId: id });
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });

  const { quarter, actualValue, actualDate, progressStatus, employeeNote, selfRating, whatWentWell, blockers } = parsed.data;

  const activeCycle = await prisma.cycle.findFirst({ where: { isActive: true } });
  if (!activeCycle) return NextResponse.json({ error: "No active cycle" }, { status: 400 });
  if (!isWindowOpen(activeCycle, quarter)) {
    return NextResponse.json({ error: `${quarter} check-in window is not open` }, { status: 403 });
  }

  const goal = await prisma.goal.findUnique({ where: { id } });
  if (!goal || goal.ownerId !== session.user.id) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (!goal.isLocked) return NextResponse.json({ error: "Goal must be locked before check-in" }, { status: 400 });

  const score = computeScore({
    uomType: goal.uomType as "NUMERIC_MIN" | "NUMERIC_MAX" | "TIMELINE" | "ZERO" | "PERCENTAGE",
    target: goal.target,
    targetDate: goal.targetDate,
    actualValue: actualValue ?? null,
    actualDate: actualDate ? new Date(actualDate) : null,
  });

  const checkin = await prisma.checkin.upsert({
    where: { goalId_quarter_cycleId: { goalId: id, quarter, cycleId: activeCycle.id } },
    create: {
      goalId: id, quarter, cycleId: activeCycle.id, employeeId: session.user.id,
      actualValue, actualDate, progressStatus, employeeNote, selfRating, whatWentWell, blockers,
      progressScore: score / 100, scorePercentage: score, submittedAt: new Date(),
    },
    update: {
      actualValue, actualDate, progressStatus, employeeNote, selfRating, whatWentWell, blockers,
      progressScore: score / 100, scorePercentage: score, submittedAt: new Date(),
    },
  });

  await prisma.goal.update({ where: { id }, data: { latestScore: score, latestStatus: progressStatus } });

  if (goal.isShared) {
    await prisma.checkin.updateMany({
      where: { goalId: id, quarter, cycleId: activeCycle.id, employeeId: { not: session.user.id } },
      data: { actualValue, actualDate, progressScore: score / 100, scorePercentage: score },
    });
  }

  await writeAudit({
    userId: session.user.id, action: "CHECKIN_SUBMITTED", entityType: "Checkin",
    entityId: checkin.id, goalId: id,
    newValue: { quarter, score, progressStatus },
  });

  return NextResponse.json({ success: true, score, checkin });
}

function isWindowOpen(cycle: Record<string, unknown>, quarter: string): boolean {
  const now = new Date();
  const windows: Record<string, [Date, Date]> = {
    Q1: [cycle.q1Open as Date, cycle.q1Close as Date],
    Q2: [cycle.q2Open as Date, cycle.q2Close as Date],
    Q3: [cycle.q3Open as Date, cycle.q3Close as Date],
    Q4: [cycle.q4Open as Date, cycle.q4Close as Date],
  };
  const [open, close] = windows[quarter] ?? [];
  return open && close ? now >= open && now <= close : false;
}
