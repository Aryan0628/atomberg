// app/api/shared-goals/route.ts
// GET — list shared goals for the current manager's team
// POST — create a shared/departmental goal and assign it to team members

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { GoalCreateSchema } from "@/lib/validations";
import { writeAudit } from "@/lib/audit";
import { getActiveCycle } from "@/lib/cycle";
import { parseJson } from "@/lib/utils";
import { createNotification } from "@/lib/notifications";
import { publishEvent, isEventBusConfigured } from "@/lib/events";
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
    // JOIN: goals owned by this manager OR shared with any of their direct reports.
    // Eliminates the separate report-ID fetch query.
    goals = await prisma.goal.findMany({
      where: {
        isShared: true,
        OR: [
          { ownerId: session.user.id },
          { sharedWith: { some: { managerId: session.user.id } } },
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

  const bodyResult = await parseJson(req);
  if (!bodyResult.ok) return bodyResult.error;
  const { recipientIds, ...goalData } = bodyResult.data as { recipientIds?: unknown; [key: string]: unknown };

  if (!recipientIds || !Array.isArray(recipientIds) || recipientIds.length === 0) {
    return NextResponse.json({ error: "At least one recipient is required" }, { status: 400 });
  }

  // Managers can only assign shared goals to their own direct reports.
  // Validate all recipientIds in one query instead of fetching all reports first.
  if (session.user.role === "MANAGER") {
    const validReports = await prisma.user.count({
      where: { id: { in: recipientIds as string[] }, managerId: session.user.id },
    });
    if (validReports !== (recipientIds as string[]).length) {
      return NextResponse.json(
        { error: "Managers can only assign shared goals to their direct reports" },
        { status: 403 }
      );
    }
  }

  const parsed = GoalCreateSchema.safeParse(goalData);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });

  const activeCycle = await getActiveCycle();
  if (!activeCycle) return NextResponse.json({ error: "No active cycle" }, { status: 400 });

  const now = new Date();
  if (now < activeCycle.goalSettingOpen || now > activeCycle.goalSettingClose) {
    return NextResponse.json({ error: "Goal setting window is closed" }, { status: 403 });
  }

  // Validate all recipients are active employees
  const recipientList = recipientIds as string[];
  const validRecipients = await prisma.user.findMany({
    where: { id: { in: recipientList }, isActive: true, role: { in: ["EMPLOYEE", "MANAGER"] } },
    select: { id: true },
  });
  if (validRecipients.length !== recipientList.length) {
    return NextResponse.json({ error: "One or more recipients are invalid or inactive" }, { status: 400 });
  }

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

  // Kafka: single event fans out to all recipient notifications in the consumer.
  // Fallback: direct parallel inserts if Kafka is not configured.
  if (isEventBusConfigured()) {
    void publishEvent({
      type: "goal.shared",
      recipientIds: recipientIds as string[],
      goalTitle: parsed.data.title,
      senderName: session.user.name ?? "Manager",
    });
  } else {
    void Promise.all(
      (recipientIds as string[]).map((recipientId) =>
        createNotification({
          userId: recipientId,
          type: "GOAL_SHARED_WITH_YOU",
          title: `Shared goal assigned: "${parsed.data.title}"`,
          message: `${session.user.name} assigned a departmental goal to you. Adjust your weightage to include it.`,
          link: `/dashboard/employee/goals`,
        })
      )
    );
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
