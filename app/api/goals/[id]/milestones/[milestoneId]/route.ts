import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { parseJson } from "@/lib/utils";
import { NextResponse } from "next/server";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string; milestoneId: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id, milestoneId } = await params;

  const goal = await prisma.goal.findUnique({ where: { id } });
  if (!goal || goal.ownerId !== session.user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // Verify milestone belongs to this goal (prevents cross-goal manipulation)
  const milestone = await prisma.milestone.findUnique({ where: { id: milestoneId } });
  if (!milestone || milestone.goalId !== id) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const body = await parseJson(req);
  if (!body.ok) return body.error;
  const data = body.data as { completed?: boolean; toggle?: boolean; title?: string; dueDate?: string };
  const newCompleted = data.toggle ? !milestone.completed : data.completed;

  const updated = await prisma.milestone.update({
    where: { id: milestoneId },
    data: {
      ...(newCompleted !== undefined && {
        completed: newCompleted,
        completedAt: newCompleted ? new Date() : null,
      }),
      ...(data.title && { title: data.title }),
      ...(data.dueDate !== undefined && { dueDate: data.dueDate ? new Date(data.dueDate) : null }),
    },
  });

  // Auto-update goal latestScore from milestone completion %
  const all = await prisma.milestone.findMany({ where: { goalId: id } });
  const pct = all.length ? (all.filter((m) => m.completed).length / all.length) * 100 : 0;
  await prisma.goal.update({ where: { id }, data: { latestScore: pct } });

  return NextResponse.json(updated);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string; milestoneId: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id, milestoneId } = await params;

  const goal = await prisma.goal.findUnique({ where: { id } });
  if (!goal || goal.ownerId !== session.user.id) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  // Verify milestone belongs to this goal
  const milestoneToDelete = await prisma.milestone.findUnique({ where: { id: milestoneId } });
  if (!milestoneToDelete || milestoneToDelete.goalId !== id) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await prisma.milestone.delete({ where: { id: milestoneId } });
  return NextResponse.json({ success: true });
}
