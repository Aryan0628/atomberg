import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import { parseJson } from "@/lib/utils";
import { NextResponse } from "next/server";
import { z } from "zod";

const ReviewCycleSchema = z.object({
  name: z.string().min(2).max(100),
  cadence: z.enum(["ANNUAL", "SEMI_ANNUAL", "QUARTERLY", "CUSTOM"]).default("ANNUAL"),
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
  departments: z.array(z.string()).default([]),
  includeSelf: z.boolean().default(true),
  includePeer: z.boolean().default(false),
  includeManager: z.boolean().default(true),
  includeSkip: z.boolean().default(false),
  includeUpward: z.boolean().default(false),
  questions: z.array(z.object({
    text: z.string().min(1).max(500),
    type: z.enum(["TEXT", "RATING", "YES_NO"]).default("TEXT"),
    ratingLabels: z.array(z.string()).default([]),
    required: z.boolean().default(true),
    order: z.number().int().default(0),
  })).min(1, "At least one question required"),
});

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const cycles = await prisma.reviewCycle.findMany({
    include: {
      questions: { orderBy: { order: "asc" } },
      _count: { select: { responses: true } },
    },
    orderBy: { createdAt: "desc" },
  });
  return NextResponse.json(cycles);
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session || !["ADMIN", "HR"].includes(session.user.role as string)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await parseJson(req);
  if (!body.ok) return body.error;
  const parsed = ReviewCycleSchema.safeParse(body.data);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });

  const { questions, ...rest } = parsed.data;
  const cycle = await prisma.reviewCycle.create({
    data: {
      ...rest,
      createdById: session.user.id,
      status: "DRAFT",
      questions: {
        create: questions.map((q, i) => ({ ...q, order: q.order ?? i })),
      },
    },
    include: { questions: { orderBy: { order: "asc" } } },
  });

  await writeAudit({
    userId: session.user.id, action: "CYCLE_CREATED", entityType: "ReviewCycle",
    entityId: cycle.id, newValue: { name: cycle.name, cadence: cycle.cadence },
  });

  return NextResponse.json(cycle, { status: 201 });
}
