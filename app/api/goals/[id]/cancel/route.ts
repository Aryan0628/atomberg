import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import { invalidateCache } from "@/lib/cache";
import { parseJson } from "@/lib/utils";
import { NextResponse } from "next/server";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const goal = await prisma.goal.findUnique({ where: { id }, include: { owner: true } });
  if (!goal) return NextResponse.json({ error: "Goal not found" }, { status: 404 });

  const isOwner = goal.ownerId === session.user.id;
  const isAdmin = ["ADMIN"].includes(session.user.role as string);
  if (!isOwner && !isAdmin) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  if (goal.status === "CANCELLED") return NextResponse.json({ error: "Goal already cancelled" }, { status: 400 });
  if (goal.status === "LOCKED") return NextResponse.json({ error: "Locked goals cannot be cancelled — use Unlock first" }, { status: 400 });

  const body = await parseJson(req);
  if (!body.ok) return body.error;
  const reason = ((body.data as Record<string, unknown>).reason as string | undefined)?.trim();
  if (!reason || reason.length < 5) return NextResponse.json({ error: "Cancellation reason required (min 5 chars)" }, { status: 422 });

  await prisma.$transaction(async (tx) => {
    await tx.goal.update({
      where: { id },
      data: { status: "CANCELLED", cancelledAt: new Date(), cancelReason: reason },
    });
    await writeAudit({
      userId: session.user.id, action: "GOAL_CANCELLED", entityType: "Goal", entityId: id,
      goalId: id, oldValue: { status: goal.status }, newValue: { status: "CANCELLED", reason },
    }, tx);
  });

  void Promise.all([
    invalidateCache(`goal:${id}`),
    invalidateCache(`goals:${goal.ownerId}:${goal.cycleId}`),
    invalidateCache(`action-items:${goal.ownerId}`),
  ]);

  return NextResponse.json({ success: true });
}
