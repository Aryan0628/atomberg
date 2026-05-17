// app/api/audit/route.ts
// GET audit trail (paginated, filtered)
// RULE: No DELETE endpoint. Return 405 if anyone tries.

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const session = await auth();
  if (!session || !["ADMIN", "HR", "MANAGER"].includes(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const page = Math.max(1, parseInt(searchParams.get("page") || "1") || 1);
  const pageSize = Math.min(100, Math.max(1, parseInt(searchParams.get("pageSize") || "20") || 20));
  const action = searchParams.get("action");
  const userId = searchParams.get("userId");
  const goalId = searchParams.get("goalId");

  const where: Record<string, unknown> = {};
  if (action) where.action = action;
  if (goalId) where.goalId = goalId;

  // Managers can only view audit entries for themselves and their direct reports.
  // JOIN instead of fetching all report IDs first — one query not two.
  if (session.user.role === "MANAGER") {
    if (userId) {
      const allowed = await prisma.user.findFirst({
        where: { id: userId, OR: [{ id: session.user.id }, { managerId: session.user.id }] },
        select: { id: true },
      });
      if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      where.userId = userId;
    } else {
      where.user = { OR: [{ id: session.user.id }, { managerId: session.user.id }] };
    }
  } else {
    if (userId) where.userId = userId;
  }

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      include: {
        user: { select: { id: true, name: true, email: true } },
        goal: { select: { id: true, title: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * pageSize,
      take: pageSize,
    }),
    prisma.auditLog.count({ where }),
  ]);

  return NextResponse.json({
    data: logs,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  });
}

export async function DELETE() {
  return NextResponse.json(
    { error: "Audit logs cannot be deleted" },
    { status: 405 }
  );
}
