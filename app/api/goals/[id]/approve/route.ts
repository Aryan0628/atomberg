// app/api/goals/[id]/approve/route.ts
// POST — manager approve / reject / return a submitted goal.
// All DB mutations run inside a Prisma transaction so partial failures roll back.
// Weightage override is revalidated against the employee's existing approved goals
// to ensure the 100% invariant is never violated by a manager edit.

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ManagerApprovalSchema } from "@/lib/validations";
import { writeAudit } from "@/lib/audit";
import { createNotification, sendGoalApprovedEmail, sendGoalRejectedEmail } from "@/lib/notifications";
import { invalidateCache } from "@/lib/cache";
import { parseJson } from "@/lib/utils";
import { NextResponse } from "next/server";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session || !["MANAGER", "ADMIN"].includes(session.user.role as string)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await parseJson(req);
  if (!body.ok) return body.error;

  const parsed = ManagerApprovalSchema.safeParse(body.data);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });

  const goal = await prisma.goal.findUnique({ where: { id }, include: { owner: true } });
  if (!goal) return NextResponse.json({ error: "Goal not found" }, { status: 404 });
  if (goal.status !== "SUBMITTED") {
    return NextResponse.json({ error: "Goal is not in submitted state" }, { status: 400 });
  }

  if (session.user.role === "MANAGER" && goal.owner.managerId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden — goal owner is not your report" }, { status: 403 });
  }

  const { action, targetOverride, weightageOverride, rejectReason, returnReason } = parsed.data;
  const oldValue = { target: goal.target, weightage: goal.weightage, status: goal.status };
  const now = new Date();

  // Validate weightage override won't break the 100% invariant
  if (action === "APPROVE" && weightageOverride !== undefined) {
    const otherApprovedWeight = await prisma.goal.aggregate({
      where: {
        ownerId: goal.ownerId,
        cycleId: goal.cycleId,
        status: { in: ["APPROVED", "LOCKED"] },
        id: { not: id },
      },
      _sum: { weightage: true },
    });
    const othersTotal = otherApprovedWeight._sum.weightage ?? 0;
    const newTotal = othersTotal + weightageOverride;
    if (Math.abs(newTotal - 100) > 0.01) {
      return NextResponse.json(
        { error: `Weightage override would set total to ${newTotal.toFixed(1)}% (must equal 100%)` },
        { status: 422 }
      );
    }
  }

  const auditAction = action === "APPROVE" ? "GOAL_APPROVED" : action === "REJECT" ? "GOAL_REJECTED" : "GOAL_RETURNED";
  const newValue = action === "APPROVE"
    ? { status: "APPROVED", targetOverride, weightageOverride }
    : action === "REJECT"
    ? { status: "REJECTED", rejectReason }
    : { status: "RETURNED", returnReason };

  // All DB writes + audit in one transaction so neither can succeed without the other
  await prisma.$transaction(async (tx) => {
    if (action === "APPROVE") {
      await tx.goal.update({
        where: { id },
        data: {
          status: "APPROVED", approverId: session.user.id, approvedAt: now,
          target: targetOverride ?? goal.target,
          weightage: weightageOverride ?? goal.weightage,
        },
      });
    } else if (action === "REJECT") {
      await tx.goal.update({
        where: { id },
        data: { status: "REJECTED", rejectedAt: now, rejectReason },
      });
    } else if (action === "RETURN") {
      await tx.goal.update({
        where: { id },
        data: { status: "RETURNED", returnedAt: now, returnReason, reworkCount: { increment: 1 } },
      });
    }
    await writeAudit({ userId: session.user.id, action: auditAction, entityType: "Goal", entityId: goal.id, goalId: goal.id, oldValue, newValue }, tx);
  });

  // Invalidate caches — synchronous so next request is fresh
  await Promise.all([
    invalidateCache(`goal:${id}`),
    invalidateCache(`goals:${goal.ownerId}:${goal.cycleId}`),
    invalidateCache(`goals:team:${session.user.id}:${goal.cycleId}`),
    invalidateCache(`action-items:${goal.ownerId}`),
    invalidateCache(`action-items:${session.user.id}`),
    invalidateCache(`analytics:overview:${goal.cycleId}`),
    invalidateCache(`analytics:manager-effectiveness:${goal.cycleId}`),
  ]);

  // Notifications fire in background after commit
  Promise.allSettled([
    action === "APPROVE"
      ? Promise.all([
          createNotification({ userId: goal.ownerId, type: "GOAL_APPROVED", title: "Goal approved!", message: `"${goal.title}" approved by your manager.`, link: `/dashboard/employee/goals/${goal.id}` }),
          sendGoalApprovedEmail(goal.owner, goal.title),
        ])
      : action === "REJECT"
      ? Promise.all([
          createNotification({ userId: goal.ownerId, type: "GOAL_REJECTED", title: "Goal rejected", message: `"${goal.title}" — Reason: ${rejectReason}`, link: `/dashboard/employee/goals/${goal.id}` }),
          sendGoalRejectedEmail(goal.owner, goal.title, rejectReason!),
        ])
      : createNotification({ userId: goal.ownerId, type: "GOAL_RETURNED", title: "Goal returned for rework", message: `"${goal.title}" — ${returnReason}`, link: `/dashboard/employee/goals/${goal.id}` }),
  ]);

  return NextResponse.json({ success: true, action });
}
