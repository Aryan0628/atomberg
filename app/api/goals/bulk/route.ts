// app/api/goals/bulk/route.ts
// POST — bulk submit all draft goals

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import { createNotification, sendGoalSubmittedEmail } from "@/lib/notifications";
import { sendTeamsCard } from "@/lib/teams";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { cycleId } = await req.json();

  const goals = await prisma.goal.findMany({
    where: { ownerId: session.user.id, cycleId, status: "DRAFT" },
  });

  if (goals.length === 0) {
    return NextResponse.json({ error: "No draft goals to submit" }, { status: 400 });
  }
  if (goals.length > 8) {
    return NextResponse.json({ error: "Maximum 8 goals per employee per cycle" }, { status: 400 });
  }

  const totalWeightage = goals.reduce((sum, g) => sum + g.weightage, 0);
  if (Math.abs(totalWeightage - 100) > 0.01) {
    return NextResponse.json(
      { error: `Total weightage must be exactly 100%. Currently: ${totalWeightage.toFixed(1)}%`, current: totalWeightage },
      { status: 422 }
    );
  }

  await prisma.goal.updateMany({
    where: { ownerId: session.user.id, cycleId, status: "DRAFT" },
    data: { status: "SUBMITTED", submittedAt: new Date() },
  });

  const employee = await prisma.user.findUnique({
    where: { id: session.user.id },
    include: { manager: true },
  });

  if (employee?.manager) {
    await createNotification({
      userId: employee.manager.id,
      type: "GOAL_SUBMITTED_FOR_APPROVAL",
      title: `${employee.name} submitted goals for review`,
      message: `${goals.length} goal(s) submitted — total weightage 100%`,
      link: `/dashboard/manager/approvals`,
    });
    await sendGoalSubmittedEmail(employee.manager, employee, goals.length);
    await sendTeamsCard({
      title: "Goals Submitted for Review",
      text: `${employee.name} submitted ${goals.length} goals for your review.`,
      actions: [{ type: "OpenUrl", title: "Review Goals", url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/manager/approvals` }],
    });
  }

  await writeAudit({
    userId: session.user.id,
    action: "GOAL_SUBMITTED",
    entityType: "Goal",
    entityId: cycleId,
    newValue: { count: goals.length, cycleId },
    request: req,
  });

  return NextResponse.json({ success: true, submitted: goals.length });
}
