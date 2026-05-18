import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { parseJson } from "@/lib/utils";
import { NextResponse } from "next/server";
import { z } from "zod";

const CreateSurveySchema = z.object({
  name: z.string().min(2).max(100),
  startDate: z.coerce.date(),
  endDate: z.coerce.date(),
});

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (["ADMIN", "HR"].includes(session.user.role as string)) {
    const surveys = await prisma.eNPSSurvey.findMany({
      include: { _count: { select: { responses: true } } },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json(surveys);
  }

  // Employees: get active survey + their response status
  const active = await prisma.eNPSSurvey.findFirst({
    where: { status: "ACTIVE", startDate: { lte: new Date() }, endDate: { gte: new Date() } },
  });
  if (!active) return NextResponse.json(null);

  const response = await prisma.eNPSResponse.findUnique({
    where: { surveyId_userId: { surveyId: active.id, userId: session.user.id } },
  });
  return NextResponse.json({ survey: active, responded: !!response });
}

export async function POST(req: Request) {
  const session = await auth();
  if (!session || !["ADMIN", "HR"].includes(session.user.role as string)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await parseJson(req);
  if (!body.ok) return body.error;
  const parsed = CreateSurveySchema.safeParse(body.data);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });

  // Close any currently active survey first
  await prisma.eNPSSurvey.updateMany({ where: { status: "ACTIVE" }, data: { status: "CLOSED" } });

  const survey = await prisma.eNPSSurvey.create({ data: { ...parsed.data, status: "ACTIVE" } });
  return NextResponse.json(survey, { status: 201 });
}
