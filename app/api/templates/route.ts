// app/api/templates/route.ts
// GET — list active goal templates (all roles) — cached 300s (admin-only mutations)
// POST — create template (admin/HR only)

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { GoalTemplateSchema } from "@/lib/validations";
import { withCache, invalidateCache } from "@/lib/cache";
import { parseJson } from "@/lib/utils";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const templates = await withCache("templates:list", 300, () =>
    prisma.goalTemplate.findMany({
      where: { isActive: true },
      orderBy: [{ thrustArea: "asc" }, { usageCount: "desc" }],
    })
  );

  return NextResponse.json(templates);
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session || !["ADMIN", "HR"].includes(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const bodyResult = await parseJson(req);
  if (!bodyResult.ok) return bodyResult.error;
  const parsed = GoalTemplateSchema.safeParse(bodyResult.data);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });

  const template = await prisma.goalTemplate.create({
    data: { ...parsed.data, createdById: session.user.id },
  });

  void invalidateCache("templates:list");

  return NextResponse.json(template, { status: 201 });
}
