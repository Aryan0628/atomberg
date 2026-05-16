// app/api/goals/route.ts
// GET (filtered list), POST (create)

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { GoalCreateSchema } from "@/lib/validations";
import { writeAudit } from "@/lib/audit";
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
    // If ownerId param is provided, validate it's within team scope
    if (ownerId && !allowedIds.includes(ownerId)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    where.ownerId = ownerId ? ownerId : { in: allowedIds };
  } else if (ownerId) {
    // ADMIN/HR can filter by any ownerId
    where.ownerId = ownerId;
  }
  // ADMIN/HR with no ownerId see all

  if (search) {
    where.OR = [
      { title: { contains: search, mode: "insensitive" } },
      { thrustArea: { contains: search, mode: "insensitive" } },
    ];
  }

  const goals = await prisma.goal.findMany({
    where,
    include: {
      owner: { select: { id: true, name: true, email: true, department: true, avatarUrl: true } },
      approver: { select: { id: true, name: true } },
      checkins: { orderBy: { quarter: "asc" } },
    },
    orderBy: { createdAt: "desc" },
  });

  return NextResponse.json(goals);
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const parsed = GoalCreateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  // Get active cycle
  const activeCycle = await prisma.cycle.findFirst({ where: { isActive: true } });
  if (!activeCycle) {
    return NextResponse.json({ error: "No active cycle found" }, { status: 400 });
  }

  // Check goal-setting window
  const now = new Date();
  if (now < activeCycle.goalSettingOpen || now > activeCycle.goalSettingClose) {
    return NextResponse.json({ error: "Goal setting window is closed" }, { status: 403 });
  }

  // Check max 8 goals per employee per cycle
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
