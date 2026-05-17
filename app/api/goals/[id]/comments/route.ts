// app/api/goals/[id]/comments/route.ts
// GET — list comments (role-aware: employees don't see isInternal notes)
// POST — create comment, notify other party

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { GoalCommentSchema } from "@/lib/validations";
import { writeAudit } from "@/lib/audit";
import { createNotification } from "@/lib/notifications";
import { NextResponse } from "next/server";

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const goal = await prisma.goal.findUnique({
    where: { id },
    select: { ownerId: true, approverId: true, sharedWith: { select: { id: true } } },
  });
  if (!goal) return NextResponse.json({ error: "Goal not found" }, { status: 404 });

  const isOwner = goal.ownerId === session.user.id;
  const isRecipient = goal.sharedWith.some((u) => u.id === session.user.id);
  const isAdminOrHr = ["ADMIN", "HR"].includes(session.user.role as string);

  if (session.user.role === "EMPLOYEE" && !isOwner && !isRecipient) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  if (session.user.role === "MANAGER") {
    // Managers may only read comments on goals belonging to their direct reports or themselves
    const ownsReport = await prisma.user.findFirst({
      where: { id: goal.ownerId, managerId: session.user.id },
      select: { id: true },
    });
    const isApprover = goal.approverId === session.user.id;
    if (!ownsReport && !isApprover && !isOwner) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
  }

  if (!isOwner && !isRecipient && !isAdminOrHr && session.user.role !== "MANAGER") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const where: Record<string, unknown> = { goalId: id };
  if (session.user.role === "EMPLOYEE") {
    where.isInternal = false;
  }

  const comments = await prisma.goalComment.findMany({
    where,
    include: { author: { select: { id: true, name: true, role: true, avatarUrl: true } } },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json(comments);
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await req.json();
  const parsed = GoalCommentSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });

  const goal = await prisma.goal.findUnique({
    where: { id },
    include: { owner: { select: { id: true, name: true } }, approver: { select: { id: true, name: true } } },
  });
  if (!goal) return NextResponse.json({ error: "Goal not found" }, { status: 404 });

  // Only owner or their manager/admin can comment
  const isOwner = goal.ownerId === session.user.id;
  const isAdminOrHr = ["ADMIN", "HR"].includes(session.user.role);
  let isAuthorisedManager = false;
  if (session.user.role === "MANAGER") {
    // Manager must manage the goal owner or be the assigned approver
    const ownsReport = await prisma.user.findFirst({
      where: { id: goal.ownerId, managerId: session.user.id },
    });
    isAuthorisedManager = !!(ownsReport || goal.approverId === session.user.id);
  }
  const isManager = isAdminOrHr || isAuthorisedManager;

  if (!isOwner && !isManager) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Employees cannot post internal notes
  if (parsed.data.isInternal && session.user.role === "EMPLOYEE") {
    return NextResponse.json({ error: "Employees cannot post internal notes" }, { status: 403 });
  }

  const comment = await prisma.goalComment.create({
    data: { goalId: id, authorId: session.user.id, content: parsed.data.content, isInternal: parsed.data.isInternal ?? false },
    include: { author: { select: { id: true, name: true, role: true, avatarUrl: true } } },
  });

  // Notify other party
  if (isOwner && goal.approverId) {
    await createNotification({
      userId: goal.approverId,
      type: "GOAL_COMMENT_FROM_EMPLOYEE",
      title: `New comment on "${goal.title}"`,
      message: `${session.user.name}: ${parsed.data.content.slice(0, 80)}`,
      link: `/dashboard/manager/approvals`,
    });
  } else if (isManager && !parsed.data.isInternal) {
    await createNotification({
      userId: goal.ownerId,
      type: "GOAL_COMMENT_FROM_MANAGER",
      title: `Manager commented on "${goal.title}"`,
      message: `${session.user.name}: ${parsed.data.content.slice(0, 80)}`,
      link: `/dashboard/employee/goals/${id}`,
    });
  }

  await writeAudit({
    userId: session.user.id,
    action: "GOAL_COMMENT_ADDED",
    entityType: "GoalComment",
    entityId: comment.id,
    goalId: id,
    newValue: { content: parsed.data.content, isInternal: parsed.data.isInternal },
  });

  return NextResponse.json(comment, { status: 201 });
}
