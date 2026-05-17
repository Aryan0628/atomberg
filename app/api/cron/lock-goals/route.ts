// app/api/cron/lock-goals/route.ts
// CRITICAL: Auto-locks APPROVED goals when goal-setting window closes.
// Runs hourly via Vercel cron.

import { prisma } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || req.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const cycle = await prisma.cycle.findFirst({ where: { isActive: true } });
  if (!cycle) return NextResponse.json({ skipped: "no active cycle" });

  if (now < cycle.goalSettingClose) {
    return NextResponse.json({ skipped: "window still open", closesAt: cycle.goalSettingClose });
  }

  const result = await prisma.goal.updateMany({
    where: { cycleId: cycle.id, status: "APPROVED", isLocked: false },
    data: { isLocked: true, lockedAt: now, status: "LOCKED" },
  });

  if (result.count > 0) {
    // Use first admin user as actor for system-triggered audit entries
    const systemActor = await prisma.user.findFirst({
      where: { role: "ADMIN", isActive: true },
      select: { id: true },
    });
    if (systemActor) {
      await writeAudit({
        userId: systemActor.id,
        action: "GOALS_AUTO_LOCKED",
        entityType: "Cycle",
        entityId: cycle.id,
        newValue: { lockedCount: result.count, triggeredBy: "cron", at: now },
      });
    }
  }

  return NextResponse.json({ locked: result.count, cycleId: cycle.id });
}
