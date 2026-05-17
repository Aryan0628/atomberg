// app/api/goals/route.ts
// GET (filtered list), POST (create)
// CACHE: employee's unfiltered goal list cached 30s (most frequent page load).
// Filtered requests (status/search/thrustArea) bypass cache — results are dynamic.

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { GoalCreateSchema } from "@/lib/validations";
import { writeAudit } from "@/lib/audit";
import { withCache, invalidateCache } from "@/lib/cache";
import { parseJson } from "@/lib/utils";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const cycleId = searchParams.get("cycleId");
  const status = searchParams.get("status");
  const ownerId = searchParams.get("ownerId");
  const thrustArea = searchParams.get("thrustArea");
  const search = searchParams.get("search");

  const where: Record<string, unknown> = {};
  if (cycleId) where.cycleId = cycleId;
  if (status) where.status = status;
  if (thrustArea) where.thrustArea = thrustArea;

  // Role-based filtering — always enforced, ownerId param cannot bypass team scope
  if (session.user.role === "EMPLOYEE") {
    where.ownerId = session.user.id;
  } else if (session.user.role === "MANAGER") {
    const reports = await prisma.user.findMany({
      where: { managerId: session.user.id },
      select: { id: true },
    });
    const reportIds = reports.map((r) => r.id);
    const allowedIds = [...reportIds, session.user.id];
    if (ownerId && !allowedIds.includes(ownerId)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    where.ownerId = ownerId ? ownerId : { in: allowedIds };
  } else if (ownerId) {
    where.ownerId = ownerId;
  }

  if (search) {
    where.OR = [
      { title: { contains: search, mode: "insensitive" } },
      { thrustArea: { contains: search, mode: "insensitive" } },
    ];
  }

  const fetchGoals = () =>
    prisma.goal.findMany({
      where,
      include: {
        owner: { select: { id: true, name: true, email: true, department: true, avatarUrl: true } },
        approver: { select: { id: true, name: true } },
        checkins: { orderBy: { quarter: "asc" } },
        cycle: { select: { id: true, name: true, fiscalYear: true } },
      },
      orderBy: { createdAt: "desc" },
    });

  // Cache only the unfiltered employee page load (no status/search/thrustArea/ownerId filters)
  const hasFilters = !!(status || thrustArea || search || ownerId);
  if (!hasFilters && session.user.role === "EMPLOYEE") {
    const goals = await withCache(
      `goals:${session.user.id}:${cycleId || "all"}`,
      30,
      fetchGoals
    );
    return NextResponse.json(goals);
  }

  // Manager unfiltered team view — cache by manager scope
  if (!hasFilters && session.user.role === "MANAGER" && !ownerId) {
    const goals = await withCache(
      `goals:team:${session.user.id}:${cycleId || "all"}`,
      30,
      fetchGoals
    );
    return NextResponse.json(goals);
  }

  return NextResponse.json(await fetchGoals());
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const bodyResult = await parseJson(req);
  if (!bodyResult.ok) return bodyResult.error;
  const parsed = GoalCreateSchema.safeParse(bodyResult.data);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  const activeCycle = await prisma.cycle.findFirst({ where: { isActive: true } });
  if (!activeCycle) {
    return NextResponse.json({ error: "No active cycle found" }, { status: 400 });
  }

  const now = new Date();
  if (now < activeCycle.goalSettingOpen || now > activeCycle.goalSettingClose) {
    return NextResponse.json({ error: "Goal setting window is closed" }, { status: 403 });
  }

  const existingCount = await prisma.goal.count({
    where: { ownerId: session.user.id, cycleId: activeCycle.id },
  });
  if (existingCount >= 8) {
    return NextResponse.json({ error: "Maximum 8 goals per employee per cycle" }, { status: 400 });
  }

  const goal = await prisma.goal.create({
    data: {
      ...parsed.data,
      targetDate: parsed.data.targetDate || undefined,
      ownerId: session.user.id,
      cycleId: activeCycle.id,
      status: "DRAFT",
    },
  });

  // Invalidate the employee's goals list and action items
  void Promise.all([
    invalidateCache(`goals:${session.user.id}:${activeCycle.id}`),
    invalidateCache(`goals:${session.user.id}:all`),
    invalidateCache(`action-items:${session.user.id}`),
  ]);

  await writeAudit({
    userId: session.user.id,
    action: "GOAL_CREATED",
    entityType: "Goal",
    entityId: goal.id,
    goalId: goal.id,
    newValue: { title: goal.title, weightage: goal.weightage, uomType: goal.uomType },
    request: req,
  });

  return NextResponse.json(goal, { status: 201 });
}
