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

  // Fetch all active-cycle goals except the current user's drafts and the excluded goal
  const existingGoals = await prisma.goal.findMany({
    where: {
      cycleId,
      status: { in: ["SUBMITTED", "APPROVED", "LOCKED"] },
      // Exclude the goal being edited (so you don't flag it against itself)
      ...(excludeGoalId ? { id: { not: excludeGoalId } } : {}),
    },
    select: {
      id: true,
      title: true,
      description: true,
      thrustArea: true,
      owner: { select: { name: true, department: true } },
    },
    take: 100, // Safety cap — cosine similarity is O(n), keep it bounded
  });

  if (!existingGoals.length) {
    return NextResponse.json({ has_redundancy: false, matches: [] });
  }

  const payload: RedundancyRequest = {
    new_goal: { title, description: description ?? "", thrust_area: thrustArea },
    existing_goals: existingGoals.map((g) => ({
      id: g.id,
      title: g.title,
      description: g.description ?? "",
      thrust_area: g.thrustArea,
      owner_name: g.owner.name,
      owner_department: g.owner.department ?? "",
    })),
  };

  try {
    const result = await checkRedundancy(payload);
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: "Redundancy check unavailable" }, { status: 503 });
  }
}
