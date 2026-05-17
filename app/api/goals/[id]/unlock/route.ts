// app/api/goals/[id]/unlock/route.ts
// POST — admin unlocks a locked goal with mandatory reason + audit log

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import { createNotification } from "@/lib/notifications";
import { invalidateCache } from "@/lib/cache";
import { parseJson } from "@/lib/utils";
import { NextResponse } from "next/server";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session || !["ADMIN", "HR"].includes(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const bodyResult = await parseJson(req);
  if (!bodyResult.ok) return bodyResult.error;
  const { reason } = bodyResult.data as { reason?: string };

  if (!reason || String(reason).trim().length < 5) {
    return NextResponse.json({ error: "Unlock reason is required (min 5 chars)" }, { status: 422 });
  }

  const goal = await prisma.goal.findUnique({ where: { id } });
  if (!goal) return NextResponse.json({ error: "Goal not found" }, { status: 404 });
  if (!goal.isLocked) return NextResponse.json({ error: "Goal is not locked" }, { status: 400 });

  await prisma.goal.update({
    where: { id },
    data: { isLocked: false, lockedAt: null, status: "APPROVED" },
  });

  await createNotification({
    userId: goal.ownerId,
    type: "GOAL_APPROVED",
    title: "Goal unlocked by admin",
    message: `"${goal.title}" was unlocked. Reason: ${reason}`,
    link: `/dashboard/employee/goals/${goal.id}`,
  });

  await writeAudit({
    userId: session.user.id,
    action: "GOAL_UNLOCKED",
    entityType: "Goal",
    entityId: goal.id,
    goalId: goal.id,
    oldValue: { isLocked: true, status: goal.status },
    newValue: { isLocked: false, status: "APPROVED", reason },
  });

  void Promise.all([
    invalidateCache(`goal:${id}`),
    invalidateCache(`goals:${goal.ownerId}:${goal.cycleId}`),
    invalidateCache(`goals:${goal.ownerId}:all`),
    invalidateCache(`action-items:${goal.ownerId}`),
  ]);

  return NextResponse.json({ success: true });
}
