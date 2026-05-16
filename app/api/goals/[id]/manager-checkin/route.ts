// app/api/goals/[id]/manager-checkin/route.ts
// POST — manager reviews an employee's check-in (adds comment + rating)

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { ManagerCheckinReviewSchema } from "@/lib/validations";
import { writeAudit } from "@/lib/audit";
import { createNotification } from "@/lib/notifications";
import { NextResponse } from "next/server";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session || !["MANAGER", "ADMIN", "HR"].includes(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id: goalId } = await params;
  const body = await req.json();
  const { quarter, ...rest } = body;

  if (!quarter) return NextResponse.json({ error: "Quarter is required" }, { status: 400 });

  const parsed = ManagerCheckinReviewSchema.safeParse(rest);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });

  const goal = await prisma.goal.findUnique({
    where: { id: goalId },
    include: { owner: { select: { id: true, name: true, managerId: true } }, cycle: { select: { id: true } } },
  });
  if (!goal) return NextResponse.json({ error: "Goal not found" }, { status: 404 });

  // Managers can only review check-ins for their own reports
  if (session.user.role === "MANAGER" && goal.owner.managerId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden — goal owner is not your report" }, { status: 403 });
  }

  const checkin = await prisma.checkin.findFirst({
    where: { goalId, quarter, cycleId: goal.cycle.id, employeeId: goal.owner.id },
  });
  if (!checkin) return NextResponse.json({ error: "No check-in found for this quarter" }, { status: 404 });

  const updated = await prisma.checkin.update({
    where: { id: checkin.id },
    data: {
      managerComment: parsed.data.managerComment,
      managerRating: parsed.data.managerRating,
      managerCheckedIn: true,
      checkedInBy: session.user.id,
      checkedInAt: new Date(),
    },
  });

  await createNotification({
    userId: goal.ownerId,
    type: "MANAGER_CHECKIN_COMPLETE",
    title: `Manager reviewed your ${quarter} check-in`,
    message: `Rating: ${"⭐".repeat(parsed.data.managerRating)} — ${parsed.data.managerComment.slice(0, 80)}`,
    link: `/dashboard/employee/goals/${goalId}`,
  });

  await writeAudit({
    userId: session.user.id,
    action: "CHECKIN_MANAGER_REVIEWED",
    entityType: "Checkin",
    entityId: checkin.id,
    goalId,
    newValue: { quarter, managerRating: parsed.data.managerRating, managerComment: parsed.data.managerComment },
  });

  return NextResponse.json({ success: true, checkin: updated });
}
