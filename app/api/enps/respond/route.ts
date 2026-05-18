import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { writeAudit } from "@/lib/audit";
import { parseJson } from "@/lib/utils";
import { NextResponse } from "next/server";
import { z } from "zod";

const RespondSchema = z.object({
  surveyId: z.string().cuid(),
  score: z.number().int().min(0).max(10),
  comment: z.string().max(500).optional(),
});

export async function POST(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await parseJson(req);
  if (!body.ok) return body.error;
  const parsed = RespondSchema.safeParse(body.data);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });

  const survey = await prisma.eNPSSurvey.findUnique({ where: { id: parsed.data.surveyId } });
  if (!survey || survey.status !== "ACTIVE") return NextResponse.json({ error: "Survey not active" }, { status: 400 });

  const response = await prisma.eNPSResponse.upsert({
    where: { surveyId_userId: { surveyId: parsed.data.surveyId, userId: session.user.id } },
    create: { surveyId: parsed.data.surveyId, userId: session.user.id, score: parsed.data.score, comment: parsed.data.comment },
    update: { score: parsed.data.score, comment: parsed.data.comment },
  });

  await writeAudit({
    userId: session.user.id, action: "ENPS_SUBMITTED", entityType: "ENPSResponse",
    entityId: response.id, newValue: { surveyId: parsed.data.surveyId, score: parsed.data.score },
  });

  return NextResponse.json({ success: true });
}

// Admin: get full results with NPS breakdown
export async function GET(req: Request) {
  const session = await auth();
  if (!session || !["ADMIN", "HR"].includes(session.user.role as string)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const surveyId = searchParams.get("surveyId");
  if (!surveyId) return NextResponse.json({ error: "surveyId required" }, { status: 400 });

  const responses = await prisma.eNPSResponse.findMany({
    where: { surveyId },
    select: { score: true, comment: true, submittedAt: true },
  });

  const total = responses.length;
  const promoters = responses.filter((r) => r.score >= 9).length;
  const detractors = responses.filter((r) => r.score <= 6).length;
  const nps = total > 0 ? Math.round(((promoters - detractors) / total) * 100) : 0;

  return NextResponse.json({ responses, total, promoters, detractors, passives: total - promoters - detractors, nps });
}
