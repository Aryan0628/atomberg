// app/api/goals/[id]/history/route.ts
// GET — returns audit log entries for a specific goal (for GoalTimeline)

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const goal = await prisma.goal.findUnique({
    where: { id },
    select: { ownerId: true, approverId: true },
  });
  if (!goal) return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Employees can only see their own goal history
  if (session.user.role === "EMPLOYEE" && goal.ownerId !== session.user.id) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const logs = await prisma.auditLog.findMany({
    where: { goalId: id },
    include: { user: { select: { id: true, name: true, role: true } } },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json(logs);
}
