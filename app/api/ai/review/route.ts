// app/api/ai/review/route.ts
// Annual Performance Review Synthesis — Next.js proxy to the Python LangGraph service.
//
// Flow:
//   1. Auth + role guard (MANAGER or ADMIN only)
//   2. Fetch employee's goals + all check-ins from DB
//   3. Package into ReviewRequest shape
//   4. Forward to Python service (or Gemini fallback via synthesizeReview)
//   5. Return structured review to client

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { synthesizeReview, type ReviewRequest } from "@/lib/ai-client";
import { NextResponse } from "next/server";
import { z } from "zod";

const RequestSchema = z.object({
  employeeId: z.string().cuid(),
  cycleId: z.string().cuid(),
});

export async function POST(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!["MANAGER", "ADMIN", "HR"].includes(session.user.role)) {
    return NextResponse.json({ error: "Forbidden — managers and HR only" }, { status: 403 });
  }

  const body = await req.json();
  const parsed = RequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  const { employeeId, cycleId } = parsed.data;

  // Fetch everything in parallel
  const [employee, cycle, goals] = await Promise.all([
    prisma.user.findUnique({
      where: { id: employeeId },
      select: { id: true, name: true, department: true, designation: true },
    }),
    prisma.cycle.findUnique({
      where: { id: cycleId },
      select: { id: true, name: true, fiscalYear: true },
    }),
    prisma.goal.findMany({
      where: { ownerId: employeeId, cycleId, status: { in: ["APPROVED", "LOCKED"] } },
      include: {
        checkins: {
          where: { employeeId },
          select: {
            quarter: true,
            actualValue: true,
            scorePercentage: true,
            progressStatus: true,
            employeeNote: true,
            selfRating: true,
            whatWentWell: true,
            blockers: true,
            managerComment: true,
            managerRating: true,
          },
        },
      },
    }),
  ]);

  if (!employee) return NextResponse.json({ error: "Employee not found" }, { status: 404 });
  if (!cycle) return NextResponse.json({ error: "Cycle not found" }, { status: 404 });
  if (!goals.length) {
    return NextResponse.json({ error: "No approved goals found for this employee in this cycle" }, { status: 404 });
  }

  const payload: ReviewRequest = {
    employee: {
      id: employee.id,
      name: employee.name,
      department: employee.department ?? "",
      designation: employee.designation ?? "",
    },
    cycle: {
      name: cycle.name,
      fiscalYear: cycle.fiscalYear,
    },
    goals: goals.map((g) => ({
      id: g.id,
      title: g.title,
      thrustArea: g.thrustArea,
      uomType: g.uomType,
      target: g.target,
      weightage: g.weightage,
      checkins: g.checkins.map((c) => ({
        quarter: c.quarter,
        actualValue: c.actualValue,
        scorePercentage: c.scorePercentage,
        progressStatus: c.progressStatus,
        employeeNote: c.employeeNote,
        selfRating: c.selfRating,
        whatWentWell: c.whatWentWell,
        blockers: c.blockers,
        managerComment: c.managerComment,
        managerRating: c.managerRating,
      })),
    })),
  };

  try {
    const result = await synthesizeReview(payload);
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: "Review synthesis unavailable — try again shortly" }, { status: 503 });
  }
}
