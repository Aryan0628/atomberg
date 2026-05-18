// app/api/goals/[id]/route.ts
// GET, PUT, DELETE single goal
// CACHE: full goal (including all comments) cached 30s at key `goal:{id}`.
// Role-based comment filtering is applied after cache read — never stored filtered.

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { GoalUpdateSchema } from "@/lib/validations";
import { writeAudit } from "@/lib/audit";
import { withCache, invalidateCache } from "@/lib/cache";
import { parseJson } from "@/lib/utils";
import { NextResponse } from "next/server";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const goal = await withCache(`goal:${id}`, 30, () =>
    prisma.goal.findUnique({
      where: { id },
      include: {
        owner: { select: { id: true, name: true, email: true, department: true, avatarUrl: true, managerId: true } },
        approver: { select: { id: true, name: true } },
        cycle: true,
        checkins: { orderBy: { quarter: "asc" } },
        comments: {
          include: { author: { select: { id: true, name: true, role: true } } },
          orderBy: { createdAt: "asc" },
        },
        sharedWith: { select: { id: true, name: true } },
      },
    })
  );

  if (!goal) return NextResponse.json({ error: "Goal not found" }, { status: 404 });

  // Access control — manager check uses owner.managerId already in the fetched object.
  // No extra DB trip needed.
  if (session.user.role === "EMPLOYEE" && goal.ownerId !== session.user.id) {
    const isRecipient = goal.sharedWith.some((u) => u.id === session.user.id);
    if (!isRecipient) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (session.user.role === "MANAGER" && goal.owner.id !== session.user.id) {
    if ((goal.owner as { managerId?: string | null }).managerId !== session.user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  // Filter internal comments for employees — applied after cache read, not stored back
  const visible = session.user.role === "EMPLOYEE"
    ? { ...goal, comments: goal.comments.filter((c) => !c.isInternal) }
    : goal;

  return NextResponse.json(visible);
}

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const goal = await prisma.goal.findUnique({ where: { id } });
  if (!goal) return NextResponse.json({ error: "Goal not found" }, { status: 404 });

  const bodyResult = await parseJson(req);
  if (!bodyResult.ok) return bodyResult.error;
  const body = bodyResult.data as Record<string, unknown>;

  if (goal.isShared && goal.primaryOwnerId !== null && goal.primaryOwnerId !== session.user.id) {
    const fullGoal = await prisma.goal.findUnique({
      where: { id },
      select: { sharedWith: { select: { id: true } } },
    });
    const isRecipient = fullGoal?.sharedWith.some((u) => u.id === session.user.id) ?? false;
    if (!isRecipient) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

    const weightage = Number(body.weightage);
    if (!body.weightage || isNaN(weightage) || weightage < 10 || weightage > 100) {
      return NextResponse.json({ error: "Shared goal recipients can only edit weightage (10–100)" }, { status: 400 });
    }
    // Validate recipient's total weightage (all their goals) stays at 100%
    const otherGoalsWeight = await prisma.goal.aggregate({
      where: {
        ownerId: session.user.id,
        cycleId: goal.cycleId,
        id: { not: id },
        status: { notIn: ["REJECTED"] },
      },
      _sum: { weightage: true },
    });
    const newTotal = (otherGoalsWeight._sum.weightage ?? 0) + weightage;
    if (Math.abs(newTotal - 100) > 0.01 && newTotal > 100) {
      return NextResponse.json(
        { error: `This weightage would set your total to ${newTotal.toFixed(1)}% (must not exceed 100%)` },
        { status: 422 }
      );
    }
    const updated = await prisma.goal.update({ where: { id }, data: { weightage } });
    void Promise.all([
      invalidateCache(`goal:${id}`),
      invalidateCache(`goals:${session.user.id}:${goal.cycleId}`),
      invalidateCache(`action-items:${session.user.id}`),
    ]);
    await writeAudit({
      userId: session.user.id, action: "WEIGHTAGE_EDITED", entityType: "Goal", entityId: id,
      goalId: id, oldValue: { weightage: goal.weightage }, newValue: { weightage },
    });
    return NextResponse.json(updated);
  }

  if (goal.ownerId !== session.user.id) {
    return NextResponse.json({ error: "Only goal owner can edit" }, { status: 403 });
  }
  if (!["DRAFT", "RETURNED"].includes(goal.status)) {
    return NextResponse.json({ error: "Goal can only be edited in DRAFT or RETURNED status" }, { status: 400 });
  }
  if (goal.isLocked) {
    return NextResponse.json({ error: "Goal is locked" }, { status: 400 });
  }

  const parsed = GoalUpdateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  const oldValue = { title: goal.title, target: goal.target, weightage: goal.weightage };
  const updated = await prisma.goal.update({
    where: { id },
    data: {
      ...parsed.data,
      status: goal.status === "RETURNED" ? "DRAFT" : goal.status,
    },
  });

  // Invalidate goal + list caches
  void Promise.all([
    invalidateCache(`goal:${id}`),
    invalidateCache(`goals:${goal.ownerId}:${goal.cycleId}`),
    invalidateCache(`goals:${goal.ownerId}:all`),
    invalidateCache(`action-items:${goal.ownerId}`),
  ]);

  // Merge both edits into a single audit entry — avoids 2× findFirst+create when
  // both fields change at once (e.g. from the edit form).
  const changedWeightage = parsed.data.weightage !== undefined && parsed.data.weightage !== goal.weightage;
  const changedTarget = parsed.data.target !== undefined && parsed.data.target !== goal.target;
  if (changedWeightage || changedTarget) {
    const action = changedTarget ? "TARGET_EDITED" : "WEIGHTAGE_EDITED";
    await writeAudit({
      userId: session.user.id, action, entityType: "Goal", entityId: id,
      goalId: id, oldValue,
      newValue: {
        ...(changedWeightage ? { weightage: parsed.data.weightage } : {}),
        ...(changedTarget ? { target: parsed.data.target } : {}),
      },
    });
  }

  return NextResponse.json(updated);
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const goal = await prisma.goal.findUnique({ where: { id } });
  if (!goal) return NextResponse.json({ error: "Goal not found" }, { status: 404 });

  if (goal.ownerId !== session.user.id && !["ADMIN"].includes(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (goal.status !== "DRAFT") {
    return NextResponse.json({ error: "Only draft goals can be deleted" }, { status: 400 });
  }

  await prisma.goal.delete({ where: { id } });

  void Promise.all([
    invalidateCache(`goal:${id}`),
    invalidateCache(`goals:${goal.ownerId}:${goal.cycleId}`),
    invalidateCache(`goals:${goal.ownerId}:all`),
    invalidateCache(`action-items:${goal.ownerId}`),
  ]);

  return NextResponse.json({ success: true });
}
