// app/api/shared-goals/route.ts
// GET — list shared goals for the current manager's team
// POST — create a shared/departmental goal and assign it to team members

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { GoalCreateSchema } from "@/lib/validations";
import { writeAudit } from "@/lib/audit";
import { createNotification } from "@/lib/notifications";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let goals;

  if (["ADMIN", "HR"].includes(session.user.role)) {
    goals = await prisma.goal.findMany({
      where: { isShared: true },
      include: {
        owner: { select: { id: true, name: true, department: true } },
        sharedWith: { select: { id: true, name: true, department: true } },
        cycle: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
    });
  } else if (session.user.role === "MANAGER") {
    const reports = await prisma.user.findMany({
      where: { managerId: session.user.id },
      select: { id: true },
    });
    const reportIds = reports.map((r) => r.id);

    goals = await prisma.goal.findMany({
      where: {
        isShared: true,
        OR: [
          { ownerId: session.user.id },
          { sharedWith: { some: { id: { in: reportIds } } } },
        ],
      },
      include: {
        owner: { select: { id: true, name: true, department: true } },
        sharedWith: { select: { id: true, name: true, department: true } },
        cycle: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
    });
  } else {
    // Employee: see shared goals they are part of
    goals = await prisma.goal.findMany({
      where: { isShared: true, sharedWith: { some: { id: session.user.id } } },
      include: {
        owner: { select: { id: true, name: true } },
        sharedWith: { select: { id: true, name: true } },
        cycle: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: "desc" },
    });
  }

  return NextResponse.json(goals);
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session || !["MANAGER", "ADMIN", "HR"].includes(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const { recipientIds, ...goalData } = body;

  if (!recipientIds || !Array.isArray(recipientIds) || recipientIds.length === 0) {
    return NextResponse.json({ error: "At least one recipient is required" }, { status: 400 });
  }

  // Managers can only assign shared goals to their own direct reports
  if (session.user.role === "MANAGER") {
    const reports = await prisma.user.findMany({
      where: { managerId: session.user.id },
      select: { id: true },
    });
    const reportIds = new Set(reports.map((r) => r.id));
    const invalid = (recipientIds as string[]).filter((rid) => !reportIds.has(rid));
    if (invalid.length > 0) {
      return NextResponse.json(
        { error: "Managers can only assign shared goals to their direct reports" },
        { status: 403 }
      );
    }
  }

  const parsed = GoalCreateSchema.safeParse(goalData);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });

  const activeCycle = await prisma.cycle.findFirst({ where: { isActive: true } });
  if (!activeCycle) return NextResponse.json({ error: "No active cycle" }, { status: 400 });

  const goal = await prisma.goal.create({
    data: {
      ...parsed.data,
      ownerId: session.user.id,
      primaryOwnerId: session.user.id,
      cycleId: activeCycle.id,
      isShared: true,
      status: "APPROVED",
      approvedAt: new Date(),
      approverId: session.user.id,
      sharedWith: { connect: recipientIds.map((id: string) => ({ id })) },
    },
    include: {
      sharedWith: { select: { id: true, name: true } },
    },
  });

  // Notify all recipients
  for (const recipientId of recipientIds) {
    await createNotification({
      userId: recipientId,
      type: "GOAL_SHARED_WITH_YOU",
      title: `Shared goal assigned: "${parsed.data.title}"`,
      message: `${session.user.name} assigned a departmental goal to you. Adjust your weightage to include it.`,
      link: `/dashboard/employee/goals`,
    });
  }

  await writeAudit({
    userId: session.user.id,
    action: "SHARED_GOAL_ASSIGNED",
    entityType: "Goal",
    entityId: goal.id,
    newValue: { title: parsed.data.title, recipientCount: recipientIds.length },
  });

  return NextResponse.json(goal, { status: 201 });
}
