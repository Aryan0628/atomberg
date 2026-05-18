import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { z } from "zod";
import { parseJson } from "@/lib/utils";
import { NextResponse } from "next/server";

const MilestoneSchema = z.object({
  title:   z.string().min(1).max(200),
  dueDate: z.coerce.date().optional(),
  order:   z.number().int().optional(),
});

async function canAccessGoal(goalId: string, userId: string, role: string): Promise<boolean> {
  const goal = await prisma.goal.findUnique({
    where: { id: goalId },
    select: {
      ownerId:    true,
      approverId: true,
      owner:      { select: { managerId: true } },
      sharedWith: { select: { id: true } },
    },
  });
  if (!goal) return false;
  if (["ADMIN", "HR"].includes(role)) return true;
  if (goal.ownerId === userId) return true;
  if (goal.approverId === userId) return true;
  if (goal.owner?.managerId === userId) return true;
  if (goal.sharedWith.some((u) => u.id === userId)) return true;
  return false;
}

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const allowed = await canAccessGoal(id, session.user.id, session.user.role as string);
  if (!allowed) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const milestones = await prisma.milestone.findMany({
    where: { goalId: id },
    orderBy: { order: "asc" },
  });
  return NextResponse.json(milestones);
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const goal = await prisma.goal.findUnique({ where: { id } });
  if (!goal) return NextResponse.json({ error: "Goal not found" }, { status: 404 });
  if (goal.ownerId !== session.user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  if (goal.isLocked) return NextResponse.json({ error: "Cannot add milestones to a locked goal" }, { status: 400 });

  const count = await prisma.milestone.count({ where: { goalId: id } });
  if (count >= 10) return NextResponse.json({ error: "Maximum 10 milestones per goal" }, { status: 400 });

  const body = await parseJson(req);
  if (!body.ok) return body.error;
  const parsed = MilestoneSchema.safeParse(body.data);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });

  const milestone = await prisma.milestone.create({
    data: { goalId: id, ...parsed.data, order: parsed.data.order ?? count },
  });
  return NextResponse.json(milestone, { status: 201 });
}
