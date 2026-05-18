import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import { getActiveCycle } from "@/lib/cycle";
import { parseJson } from "@/lib/utils";
import { NextResponse } from "next/server";
import { z } from "zod";

const CompanyGoalSchema = z.object({
  title: z.string().min(3).max(200),
  description: z.string().max(1000).optional(),
  thrustArea: z.string().min(1),
  goalLevel: z.enum(["COMPANY", "DEPARTMENT"]),
  department: z.string().optional(),
  targetDate: z.coerce.date().optional(),
});

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const activeCycle = await getActiveCycle();
  if (!activeCycle) return NextResponse.json([]);

  const goals = await prisma.goal.findMany({
    where: {
      cycleId: activeCycle.id,
      goalLevel: { in: ["COMPANY", "DEPARTMENT"] },
    },
    include: {
      owner: { select: { id: true, name: true, department: true } },
      childGoals: {
        include: { owner: { select: { id: true, name: true, department: true } } },
        where: { goalLevel: "INDIVIDUAL" },
      },
    },
    orderBy: [{ goalLevel: "asc" }, { createdAt: "asc" }],
  });

  return NextResponse.json(goals);
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session || !["ADMIN", "HR", "MANAGER"].includes(session.user.role as string)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await parseJson(req);
  if (!body.ok) return body.error;
  const parsed = CompanyGoalSchema.safeParse(body.data);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });

  const activeCycle = await getActiveCycle();
  if (!activeCycle) return NextResponse.json({ error: "No active cycle" }, { status: 400 });

  const goal = await prisma.goal.create({
    data: {
      title: parsed.data.title,
      description: parsed.data.description,
      thrustArea: parsed.data.thrustArea,
      goalLevel: parsed.data.goalLevel,
      targetDate: parsed.data.targetDate,
      uomType: "PERCENTAGE",
      weightage: 0,
      ownerId: session.user.id,
      cycleId: activeCycle.id,
      status: "APPROVED",
    },
  });

  await writeAudit({
    userId: session.user.id, action: "GOAL_CREATED", entityType: "Goal",
    entityId: goal.id, goalId: goal.id,
    newValue: { title: goal.title, goalLevel: goal.goalLevel },
  });

  return NextResponse.json(goal, { status: 201 });
}
