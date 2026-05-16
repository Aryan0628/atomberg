// app/api/goals/[id]/approve/route.ts
// POST — manager approve/reject/return

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ManagerApprovalSchema } from "@/lib/validations";
import { writeAudit } from "@/lib/audit";
import { createNotification, sendGoalApprovedEmail, sendGoalRejectedEmail } from "@/lib/notifications";
import { NextResponse } from "next/server";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session || !["MANAGER", "ADMIN"].includes(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json();
  const parsed = ManagerApprovalSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });

  const goal = await prisma.goal.findUnique({
    where: { id },
    include: { owner: true },
  });
  if (!goal) return NextResponse.json({ error: "Goal not found" }, { status: 404 });
  if (goal.status !== "SUBMITTED") {
    return NextResponse.json({ error: "Goal is not in submitted state" }, { status: 400 });
  }

  // Managers can only act on their own reports' goals
  if (session.user.role === "MANAGER" && goal.owner.managerId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden — goal owner is not your report" }, { status: 403 });
  }

  const { action, targetOverride, weightageOverride, rejectReason, returnReason } = parsed.data;
  const oldValue = { target: goal.target, weightage: goal.weightage, status: goal.status };

  if (action === "APPROVE") {
    await prisma.goal.update({
      where: { id },
      data: {
        status: "APPROVED",
        approverId: session.user.id,
        approvedAt: new Date(),
        target: targetOverride ?? goal.target,
        weightage: weightageOverride ?? goal.weightage,
      },
    });
    await createNotification({
      userId: goal.ownerId, type: "GOAL_APPROVED",
      title: "Goal approved!", message: `"${goal.title}" approved by your manager.`,
      link: `/dashboard/employee/goals/${goal.id}`,
    });
    await sendGoalApprovedEmail(goal.owner, goal.title);
    await writeAudit({
      userId: session.user.id, action: "GOAL_APPROVED", entityType: "Goal", entityId: goal.id,
      goalId: goal.id, oldValue, newValue: { status: "APPROVED", targetOverride, weightageOverride },
    });
  }

  if (action === "REJECT") {
    await prisma.goal.update({
      where: { id },
      data: { status: "REJECTED", rejectedAt: new Date(), rejectReason },
    });
    await createNotification({
      userId: goal.ownerId, type: "GOAL_REJECTED",
      title: "Goal rejected", message: `"${goal.title}" — Reason: ${rejectReason}`,
      link: `/dashboard/employee/goals/${goal.id}`,
    });
    await sendGoalRejectedEmail(goal.owner, goal.title, rejectReason!);
    await writeAudit({
      userId: session.user.id, action: "GOAL_REJECTED", entityType: "Goal", entityId: goal.id,
      goalId: goal.id, oldValue, newValue: { status: "REJECTED", rejectReason },
    });
  }

  if (action === "RETURN") {
    await prisma.goal.update({
      where: { id },
      data: { status: "RETURNED", returnedAt: new Date(), returnReason, reworkCount: { increment: 1 } },
    });
    await createNotification({
      userId: goal.ownerId, type: "GOAL_RETURNED",
      title: "Goal returned for rework", message: `"${goal.title}" — ${returnReason}`,
      link: `/dashboard/employee/goals/${goal.id}`,
    });
    await writeAudit({
      userId: session.user.id, action: "GOAL_RETURNED", entityType: "Goal", entityId: goal.id,
      goalId: goal.id, oldValue, newValue: { status: "RETURNED", returnReason },
    });
  }

  return NextResponse.json({ success: true, action });
}
