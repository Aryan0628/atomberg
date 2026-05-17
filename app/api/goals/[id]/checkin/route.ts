// app/api/goals/[id]/checkin/route.ts
// POST — employee check-in

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { CheckinSchema } from "@/lib/validations";
import { computeScore } from "@/lib/scoring";
import { writeAudit } from "@/lib/audit";
import { invalidateCache } from "@/lib/cache";
import { getActiveCycle } from "@/lib/cycle";
import { parseJson } from "@/lib/utils";
import { NextResponse } from "next/server";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const bodyResult = await parseJson(req);
  if (!bodyResult.ok) return bodyResult.error;
  const parsed = CheckinSchema.safeParse({ ...(bodyResult.data as object), goalId: id });
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });

  const { quarter, actualValue, actualDate, progressStatus, employeeNote, selfRating, whatWentWell, blockers } = parsed.data;

  const activeCycle = await getActiveCycle();
  if (!activeCycle) return NextResponse.json({ error: "No active cycle" }, { status: 400 });
  if (!isWindowOpen(activeCycle, quarter)) {
    return NextResponse.json({ error: `${quarter} check-in window is not open` }, { status: 403 });
  }

  const goal = await prisma.goal.findUnique({
    where: { id },
    include: { sharedWith: { select: { id: true } } },
  });
  const isOwner = goal?.ownerId === session.user.id;
  const isRecipient = goal?.sharedWith?.some((u) => u.id === session.user.id) ?? false;
  if (!goal || (!isOwner && !isRecipient)) return NextResponse.json({ error: "Not found" }, { status: 404 });
  if (goal.cycleId !== activeCycle.id) return NextResponse.json({ error: "Goal does not belong to the active cycle" }, { status: 400 });
  if (!goal.isLocked) return NextResponse.json({ error: "Goal must be locked before check-in" }, { status: 400 });

  const score = computeScore({
    uomType: goal.uomType as "NUMERIC_MIN" | "NUMERIC_MAX" | "TIMELINE" | "ZERO" | "PERCENTAGE",
    target: goal.target,
    targetDate: goal.targetDate,
    actualValue: actualValue ?? null,
    actualDate: actualDate ? new Date(actualDate) : null,
  });

  // Atomic: checkin upsert + goal latestScore + shared sync + audit in one transaction
  const now = new Date();
  const checkin = await prisma.$transaction(async (tx) => {
    const c = await tx.checkin.upsert({
      where: { goalId_quarter_cycleId_employeeId: { goalId: id, quarter, cycleId: activeCycle.id, employeeId: session.user.id } },
      create: {
        goalId: id, quarter, cycleId: activeCycle.id, employeeId: session.user.id,
        actualValue, actualDate, progressStatus, employeeNote, selfRating, whatWentWell, blockers,
        progressScore: score / 100, scorePercentage: score, submittedAt: now,
      },
      update: {
        actualValue, actualDate, progressStatus, employeeNote, selfRating, whatWentWell, blockers,
        progressScore: score / 100, scorePercentage: score, submittedAt: now,
      },
    });

    await tx.goal.update({ where: { id }, data: { latestScore: score, latestStatus: progressStatus } });

    // Sync score to each other shared recipient's own checkin row.
    // Promise.all runs all upserts over the same tx connection — no sequential blocking.
    if (goal.isShared) {
      const recipients = goal.sharedWith.filter((u) => u.id !== session.user.id);
      await Promise.all(
        recipients.map((recipient) =>
          tx.checkin.upsert({
            where: { goalId_quarter_cycleId_employeeId: { goalId: id, quarter, cycleId: activeCycle.id, employeeId: recipient.id } },
            create: {
              goalId: id, quarter, cycleId: activeCycle.id, employeeId: recipient.id,
              actualValue, actualDate, progressStatus, progressScore: score / 100, scorePercentage: score,
              submittedAt: now,
            },
            update: { actualValue, actualDate, progressScore: score / 100, scorePercentage: score },
          })
        )
      );
    }

    await writeAudit({
      userId: session.user.id, action: "CHECKIN_SUBMITTED", entityType: "Checkin",
      entityId: c.id, goalId: id,
      newValue: { quarter, score, progressStatus },
    }, tx);

    return c;
  });

  // Invalidate goal detail + list + analytics — checkin changes latestScore
  void Promise.all([
    invalidateCache(`goal:${id}`),
    invalidateCache(`goals:${session.user.id}:${activeCycle.id}`),
    invalidateCache(`goals:${session.user.id}:all`),
    invalidateCache(`action-items:${session.user.id}`),
    invalidateCache(`analytics:overview:${activeCycle.id}`),
    invalidateCache(`analytics:heatmap:${activeCycle.id}`),
    invalidateCache(`analytics:qoq:${activeCycle.id}`),
  ]);

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
