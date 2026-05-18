import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import { createNotification } from "@/lib/notifications";
import { parseJson } from "@/lib/utils";
import { NextResponse } from "next/server";
import { z } from "zod";

const FeedbackSchema = z.object({
  receiverId: z.string().cuid(),
  type: z.enum(["PEER", "UPWARD", "SELF", "MANAGER"]).default("PEER"),
  message: z.string().max(1000).optional(),
  isAnonymous: z.boolean().default(false),
  answers: z.array(z.object({
    question: z.string(),
    answer: z.string(),
    rating: z.number().min(1).max(5).optional(),
  })).default([]),
  reviewCycleId: z.string().cuid().optional(),
});

export async function GET(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const direction = searchParams.get("direction") ?? "received";
  const cycleId = searchParams.get("reviewCycleId");

  const where: Record<string, unknown> = direction === "given"
    ? { giverId: session.user.id }
    : { receiverId: session.user.id };

  if (cycleId) where.reviewCycleId = cycleId;

  const feedbacks = await prisma.peerFeedback.findMany({
    where,
    include: {
      giver: { select: { id: true, name: true, avatarUrl: true, department: true } },
      receiver: { select: { id: true, name: true, avatarUrl: true, department: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  // Anonymise giver info for anonymous feedback (unless requester is admin/hr)
  const isPrivileged = ["ADMIN", "HR"].includes(session.user.role as string);
  return NextResponse.json(feedbacks.map((f) => ({
    ...f,
    giver: f.isAnonymous && !isPrivileged ? null : f.giver,
  })));
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await parseJson(req);
  if (!body.ok) return body.error;
  const parsed = FeedbackSchema.safeParse(body.data);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });

  if (parsed.data.receiverId === session.user.id && parsed.data.type !== "SELF") {
    return NextResponse.json({ error: "Cannot give PEER feedback to yourself" }, { status: 400 });
  }

  const feedback = await prisma.peerFeedback.create({
    data: {
      giverId: session.user.id,
      receiverId: parsed.data.receiverId,
      type: parsed.data.type,
      message: parsed.data.message,
      isAnonymous: parsed.data.isAnonymous,
      answers: parsed.data.answers,
      status: "COMPLETED",
      reviewCycleId: parsed.data.reviewCycleId,
    },
  });

  await writeAudit({
    userId: session.user.id, action: "FEEDBACK_SUBMITTED", entityType: "PeerFeedback",
    entityId: feedback.id, newValue: { receiverId: feedback.receiverId, type: feedback.type },
  });

  if (!parsed.data.isAnonymous) {
    void createNotification({
      userId: parsed.data.receiverId,
      type: "FEEDBACK_SUBMITTED",
      title: "You received peer feedback",
      message: "Someone submitted feedback on your performance.",
      link: "/dashboard/employee/feedback",
    });
  }

  return NextResponse.json(feedback, { status: 201 });
}
