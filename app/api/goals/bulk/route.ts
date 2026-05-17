// app/api/goals/bulk/route.ts
// POST — atomically submit all draft goals for the active cycle.
// The updateMany + audit are wrapped in a single Prisma transaction to prevent
// partial state: if the audit write fails, the goal statuses roll back.
// Notifications/email are enqueued AFTER the transaction commits — never block commit.

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getActiveCycle } from "@/lib/cycle";
import { writeAudit } from "@/lib/audit";
import { createNotification, sendGoalSubmittedEmail } from "@/lib/notifications";
import { sendTeamsCard } from "@/lib/teams";
import { invalidateCache } from "@/lib/cache";
import { parseJson } from "@/lib/utils";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await parseJson(req);
  if (!body.ok) return body.error;

  const { cycleId } = body.data as { cycleId?: string };
  if (!cycleId) return NextResponse.json({ error: "cycleId is required" }, { status: 400 });

  // Verify this is the active cycle and goal-setting window is open
  const activeCycle = await getActiveCycle();
  if (!activeCycle || activeCycle.id !== cycleId) {
    return NextResponse.json({ error: "Can only submit goals for the active cycle" }, { status: 400 });
  }
  const now = new Date();
  if (now < activeCycle.goalSettingOpen || now > activeCycle.goalSettingClose) {
    return NextResponse.json({ error: "Goal setting window is closed" }, { status: 403 });
  }

  const allGoals = await prisma.goal.findMany({
    where: { ownerId: session.user.id, cycleId },
  });

  // REJECTED goals are excluded — their slot and weightage are freed up
  const activeGoals = allGoals.filter((g) => g.status !== "REJECTED");
  const goals = allGoals.filter((g) => g.status === "DRAFT");

  if (goals.length === 0) return NextResponse.json({ error: "No draft goals to submit" }, { status: 400 });
  if (activeGoals.length > 8) return NextResponse.json({ error: "Maximum 8 goals per employee per cycle" }, { status: 400 });

  // Total weightage must equal 100% across all active (non-rejected) goals
  const totalWeightage = activeGoals.reduce((sum, g) => sum + g.weightage, 0);
  if (Math.abs(totalWeightage - 100) > 0.01) {
    return NextResponse.json(
      { error: `Total weightage must be exactly 100%. Currently: ${totalWeightage.toFixed(1)}%`, current: totalWeightage },
      { status: 422 }
    );
  }

  // Atomic: update goals + write audit in one transaction via writeAudit(data, tx)
  await prisma.$transaction(async (tx) => {
    await tx.goal.updateMany({
      where: { ownerId: session.user.id, cycleId, status: "DRAFT" },
      data: { status: "SUBMITTED", submittedAt: new Date() },
    });
    await writeAudit({
      userId: session.user.id,
      action: "GOAL_SUBMITTED",
      entityType: "Goal",
      entityId: cycleId,
      newValue: { count: goals.length, cycleId },
    }, tx);
  });

  // Invalidate caches that the submission dirtied
  await Promise.all([
    invalidateCache(`goals:${session.user.id}:${cycleId}`),
    invalidateCache(`action-items:${session.user.id}`),
    invalidateCache(`analytics:overview:${activeCycle.id}`),
  ]);

  // Side-effects after commit — failures here don't roll back the submission
  const employee = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: { manager: true },
  });
  if (employee?.manager) {
    void invalidateCache(`action-items:${employee.manager.id}`);
    // Fire notifications in background — response does not wait
    Promise.allSettled([
      createNotification({
        userId: employee.manager.id, type: "GOAL_SUBMITTED_FOR_APPROVAL",
        title: `${employee.name} submitted goals for review`,
        message: `${goals.length} goal(s) submitted — total weightage 100%`,
        link: `/dashboard/manager/approvals`,
      }),
      sendGoalSubmittedEmail(employee.manager, employee, goals.length),
      sendTeamsCard({
        title: "Goals Submitted for Review",
        text: `${employee.name} submitted ${goals.length} goals for your review.`,
        actions: [{ type: "OpenUrl", title: "Review Goals", url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/manager/approvals` }],
      }),
    ]);
  }

  return NextResponse.json({ success: true, submitted: goals.length });
}
