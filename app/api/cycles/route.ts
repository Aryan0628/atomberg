// app/api/cycles/route.ts
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { CycleCreateSchema } from "@/lib/validations";
import { writeAudit } from "@/lib/audit";
import { parseJson } from "@/lib/utils";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const cycles = await prisma.cycle.findMany({
    orderBy: { createdAt: "desc" },
    include: { _count: { select: { goals: true } } },
  });
  return NextResponse.json(cycles);
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session || !["ADMIN", "HR"].includes(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const bodyResult = await parseJson(req);
  if (!bodyResult.ok) return bodyResult.error;
  const parsed = CycleCreateSchema.safeParse(bodyResult.data);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });

  const cycle = await prisma.cycle.create({
    data: { ...parsed.data, createdBy: session.user.id },
  });

  await writeAudit({
    userId: session.user.id, action: "CYCLE_CREATED", entityType: "Cycle",
    entityId: cycle.id, newValue: { name: cycle.name, fiscalYear: cycle.fiscalYear },
  });

  return NextResponse.json(cycle, { status: 201 });
}
