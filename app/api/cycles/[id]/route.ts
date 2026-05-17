// app/api/cycles/[id]/route.ts
// GET individual cycle, PATCH activate/deactivate/update

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import { parseJson } from "@/lib/utils";
import { NextResponse } from "next/server";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const cycle = await prisma.cycle.findUnique({
    where: { id },
    include: { _count: { select: { goals: true, checkins: true } } },
  });
  if (!cycle) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(cycle);
}

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session || !["ADMIN", "HR"].includes(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const bodyResult = await parseJson(req);
  if (!bodyResult.ok) return bodyResult.error;
  const body = bodyResult.data as Record<string, unknown>;

  // Activate: deactivate all other cycles + audit in one transaction to enforce
  // the single-active-cycle invariant — no window where two cycles are active.
  if (body.isActive === true) {
    await prisma.$transaction(async (tx) => {
      await tx.cycle.updateMany({ data: { isActive: false } });
      await tx.cycle.update({ where: { id }, data: { isActive: true } });
      await writeAudit({
        userId: session.user.id,
        action: "CYCLE_ACTIVATED",
        entityType: "Cycle",
        entityId: id,
        newValue: { isActive: true },
      }, tx);
    });
    return NextResponse.json({ success: true, action: "activated" });
  }

  // Deactivate
  if (body.isActive === false) {
    await prisma.cycle.update({ where: { id }, data: { isActive: false } });
    return NextResponse.json({ success: true, action: "deactivated" });
  }

  // Lock all APPROVED goals in this cycle (manual trigger)
  if (body.lockGoals === true) {
    const result = await prisma.goal.updateMany({
      where: { cycleId: id, status: "APPROVED", isLocked: false },
      data: { isLocked: true, lockedAt: new Date(), status: "LOCKED" },
    });
    await writeAudit({
      userId: session.user.id,
      action: "GOALS_AUTO_LOCKED",
      entityType: "Cycle",
      entityId: id,
      newValue: { lockedCount: result.count, triggeredBy: "admin_manual" },
    });
    return NextResponse.json({ success: true, locked: result.count });
  }

  return NextResponse.json({ error: "No valid operation specified" }, { status: 400 });
}
