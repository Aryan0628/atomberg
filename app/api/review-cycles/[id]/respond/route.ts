import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import { parseJson } from "@/lib/utils";
import { NextResponse } from "next/server";
import { z } from "zod";

const ResponseSchema = z.object({
  subjectId:    z.string().cuid(),
  feedbackType: z.enum(["PEER", "UPWARD", "SELF", "MANAGER"]),
  answers: z.array(z.object({
    questionId: z.string(),
    answer:     z.string(),
    rating:     z.number().min(1).max(10).optional(),
  })),
});

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await params;

  const cycle = await prisma.reviewCycle.findUnique({
    where: { id },
    include: { questions: { select: { id: true } } },
  });
  if (!cycle) return NextResponse.json({ error: "Review cycle not found" }, { status: 404 });
  if (cycle.status !== "ACTIVE") return NextResponse.json({ error: "Review cycle is not active" }, { status: 400 });

  const body = await parseJson(req);
  if (!body.ok) return body.error;
  const parsed = ResponseSchema.safeParse(body.data);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });

  const { subjectId, feedbackType, answers } = parsed.data;

  // Validate all submitted questionIds belong to this review cycle
  const validQuestionIds = new Set(cycle.questions.map((q) => q.id));
  const invalidQ = answers.find((a) => !validQuestionIds.has(a.questionId));
  if (invalidQ) {
    return NextResponse.json({ error: `Question ${invalidQ.questionId} does not belong to this cycle` }, { status: 422 });
  }

  // Validate reviewer–subject relationship matches feedbackType
  if (feedbackType === "SELF") {
    if (subjectId !== session.user.id) {
      return NextResponse.json({ error: "Self-review subject must be yourself" }, { status: 403 });
    }
  } else if (feedbackType === "PEER") {
    if (subjectId === session.user.id) {
      return NextResponse.json({ error: "Cannot submit peer review for yourself" }, { status: 403 });
    }
  } else if (feedbackType === "MANAGER") {
    // Reviewer is the manager — subject must be a direct report
    const subject = await prisma.user.findUnique({ where: { id: subjectId }, select: { managerId: true } });
    if (!subject || subject.managerId !== session.user.id) {
      return NextResponse.json({ error: "Subject is not your direct report" }, { status: 403 });
    }
  } else if (feedbackType === "UPWARD") {
    // Reviewer is an employee — subject must be their manager
    const reviewer = await prisma.user.findUnique({ where: { id: session.user.id }, select: { managerId: true } });
    if (!reviewer || reviewer.managerId !== subjectId) {
      return NextResponse.json({ error: "Upward review subject must be your manager" }, { status: 403 });
    }
  }

  const response = await prisma.reviewResponse.upsert({
    where: {
      reviewCycleId_reviewerId_subjectId_feedbackType: {
        reviewCycleId: id,
        reviewerId:    session.user.id,
        subjectId,
        feedbackType,
      },
    },
    create: {
      reviewCycleId: id,
      reviewerId:    session.user.id,
      subjectId,
      feedbackType,
      answers,
      submittedAt: new Date(),
    },
    update: { answers, submittedAt: new Date() },
  });

  await writeAudit({
    userId: session.user.id, action: "REVIEW_SUBMITTED", entityType: "ReviewResponse",
    entityId: response.id, newValue: { cycleId: id, feedbackType },
  });

  return NextResponse.json(response);
}
