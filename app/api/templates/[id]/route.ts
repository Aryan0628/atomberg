// app/api/templates/[id]/route.ts
// PUT — update template (admin/HR)
// DELETE — soft delete (admin/HR)
// POST /use — increment usage count when employee picks a template

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { GoalTemplateSchema } from "@/lib/validations";
import { NextResponse } from "next/server";

export async function PUT(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session || !["ADMIN", "HR"].includes(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  const body = await req.json();
  const parsed = GoalTemplateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });

  const template = await prisma.goalTemplate.update({ where: { id }, data: parsed.data });
  return NextResponse.json(template);
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session || !["ADMIN", "HR"].includes(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { id } = await params;
  await prisma.goalTemplate.update({ where: { id }, data: { isActive: false } });
  return NextResponse.json({ success: true });
}

// POST /api/templates/[id]/use — increment usageCount
export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  await prisma.goalTemplate.update({
    where: { id },
    data: { usageCount: { increment: 1 } },
  });

  return NextResponse.json({ success: true });
}
