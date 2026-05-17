// app/api/ai/redundancy/route.ts
// Semantic Goal Redundancy Detection — Next.js proxy to the Python LangGraph service.
//
// Flow:
//   1. Auth guard (any authenticated user — employees check their own draft goals)
//   2. Validate new goal fields
//   3. Fetch all OTHER approved/submitted goals in the same cycle from DB
//   4. Forward to Python service (or Gemini embedding fallback via checkRedundancy)
//   5. Return matches with recommendations

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { checkRedundancy, type RedundancyRequest } from "@/lib/ai-client";
import { NextResponse } from "next/server";
import { z } from "zod";

const RequestSchema = z.object({
  title: z.string().min(3).max(200),
  description: z.string().max(1000).optional().default(""),
  thrustArea: z.string().min(1),
  cycleId: z.string().cuid(),
  // Exclude this goal ID from comparison (used when editing an existing draft)
  excludeGoalId: z.string().cuid().optional(),
});

export async function POST(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const parsed = RequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  const { title, description, thrustArea, cycleId, excludeGoalId } = parsed.data;

  // Scope the comparison set by role:
  //   EMPLOYEE → their department's goals only (avoids cross-team PII exposure)
  //   MANAGER  → their reports' goals + own goals
  //   ADMIN/HR → org-wide (up to 100 cap)
  let ownerFilter: Record<string, unknown> = {};
  if (session.user.role === "EMPLOYEE") {
    const me = await prisma.user.findUnique({ where: { id: session.user.id }, select: { department: true } });
    ownerFilter = { owner: { department: me?.department ?? undefined } };
  } else if (session.user.role === "MANAGER") {
    const reportIds = await prisma.user.findMany({
      where: { managerId: session.user.id, isActive: true },
      select: { id: true },
    });
    ownerFilter = { ownerId: { in: [session.user.id, ...reportIds.map((r) => r.id)] } };
  }

  const existingGoals = await prisma.goal.findMany({
    where: {
      cycleId,
      status: { in: ["SUBMITTED", "APPROVED", "LOCKED"] },
      ...(excludeGoalId ? { id: { not: excludeGoalId } } : {}),
      ...ownerFilter,
    },
    select: { id: true, title: true, description: true, thrustArea: true },
    take: 100,
  });

  if (!existingGoals.length) {
    return NextResponse.json({ has_redundancy: false, matches: [] });
  }

  const payload: RedundancyRequest = {
    new_goal: { title, description: description ?? "", thrust_area: thrustArea },
    // Strip owner PII — the AI only needs goal content for semantic matching
    existing_goals: existingGoals.map((g) => ({
      id: g.id,
      title: g.title,
      description: g.description ?? "",
      thrust_area: g.thrustArea,
      owner_name: "",
      owner_department: "",
    })),
  };

  try {
    const result = await checkRedundancy(payload);
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: "Redundancy check unavailable" }, { status: 503 });
  }
}
