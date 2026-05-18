import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import { parseJson } from "@/lib/utils";
import { NextResponse } from "next/server";
import { z } from "zod";

const ResponseSchema = z.object({
  subjectId: z.string().cuid(),
  feedbackType: z.enum(["PEER", "UPWARD", "SELF", "MANAGER"]),
  answers: z.array(z.object({
    questionId: z.string(),
    answer: z.string(),
    rating: z.number().min(1).max(10).optional(),
  })),
});

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const cycle = await prisma.reviewCycle.findUnique({ where: { id } });
  if (!cycle) return NextResponse.json({ error: "Review cycle not found" }, { status: 404 });
  if (cycle.status !== "ACTIVE") return NextResponse.json({ error: "Review cycle is not active" }, { status: 400 });

  const body = await parseJson(req);
  if (!body.ok) return body.error;
  const parsed = ResponseSchema.safeParse(body.data);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });

  const response = await prisma.reviewResponse.upsert({
    where: {
      reviewCycleId_reviewerId_subjectId_feedbackType: {
        reviewCycleId: id,
        reviewerId: session.user.id,
        subjectId: parsed.data.subjectId,
        feedbackType: parsed.data.feedbackType,
      },
    },
    create: {
      reviewCycleId: id,
      reviewerId: session.user.id,
      subjectId: parsed.data.subjectId,
      feedbackType: parsed.data.feedbackType,
      answers: parsed.data.answers,
      submittedAt: new Date(),
    },
    update: { answers: parsed.data.answers, submittedAt: new Date() },
  });

  await writeAudit({
    userId: session.user.id, action: "REVIEW_SUBMITTED", entityType: "ReviewResponse",
    entityId: response.id, newValue: { cycleId: id, feedbackType: parsed.data.feedbackType },
  });

  return NextResponse.json(response);
}
