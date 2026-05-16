// app/api/ai/evaluate/route.ts
// Next.js proxy to the Python LangGraph AI service.
// Handles HMAC signing, circuit breaker fallback, and rate limiting.

import { auth } from "@/lib/auth";
import { evaluateGoal } from "@/lib/ai-client";
import { NextResponse } from "next/server";
import { z } from "zod";

const EvalSchema = z.object({
  title: z.string().min(3).max(200),
  description: z.string().max(1000).optional(),
  uom_type: z.enum(["NUMERIC_MIN", "NUMERIC_MAX", "TIMELINE", "ZERO", "PERCENTAGE"]),
  target: z.number().positive().optional().nullable(),
  weightage: z.number().min(10).max(100),
  thrust_area: z.string().min(1),
});

export async function POST(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json();
  const parsed = EvalSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  try {
    const result = await evaluateGoal(parsed.data);
    return NextResponse.json(result);
  } catch {
    return NextResponse.json({ error: "AI evaluation unavailable" }, { status: 503 });
  }
}
