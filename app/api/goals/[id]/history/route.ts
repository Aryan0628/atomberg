// app/api/goals/[id]/history/route.ts
// GET — returns audit log entries for a specific goal (for GoalTimeline).
// Access rules mirror /api/goals/[id]:
//   EMPLOYEE  → only own goals
//   MANAGER   → direct reports' goals (managerId check on owner) or goals they approved
//   ADMIN/HR  → any goal

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const role = session.user.role as string;

  const goal = await prisma.goal.findUnique({
    where: { id },
    select: {
      ownerId:    true,
      approverId: true,
      owner:      { select: { managerId: true } },
    },
  });
  if (!goal) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const isOwner   = goal.ownerId === session.user.id;
  const isApprover = goal.approverId === session.user.id;
  const isDirectManager = goal.owner?.managerId === session.user.id;
  const isAdminHR = ["ADMIN", "HR"].includes(role);

  if (role === "EMPLOYEE" && !isOwner) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  if (role === "MANAGER" && !isApprover && !isDirectManager && !isAdminHR) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const logs = await prisma.auditLog.findMany({
    where: { goalId: id },
    include: { user: { select: { id: true, name: true, role: true } } },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json(logs);
}
