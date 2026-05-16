// app/api/templates/route.ts
// GET — list active goal templates (all roles)
// POST — create template (admin/HR only)

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { GoalTemplateSchema } from "@/lib/validations";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const templates = await prisma.goalTemplate.findMany({
    where: { isActive: true },
    orderBy: [{ thrustArea: "asc" }, { usageCount: "desc" }],
  });

  return NextResponse.json(templates);
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session || !["ADMIN", "HR"].includes(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = GoalTemplateSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });

  const template = await prisma.goalTemplate.create({
    data: { ...parsed.data, createdById: session.user.id },
  });

  return NextResponse.json(template, { status: 201 });
}
