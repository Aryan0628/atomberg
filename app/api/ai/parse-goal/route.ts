// app/api/ai/parse-goal/route.ts
// Natural Language Goal Parser — thin proxy to the Python AI microservice (/nlp/parse-goal).
// Falls back to direct Gemini call via ai-client circuit breaker if service is down.

import { auth } from "@/lib/auth";
import { rateLimit } from "@/lib/rate-limit";
import { parseJson } from "@/lib/utils";
import { parseGoalNLP } from "@/lib/ai-client";
import { NextResponse } from "next/server";
import { z } from "zod";

const RequestSchema = z.object({
  text: z.string().min(5).max(500),
});

export async function POST(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const limit = await rateLimit(`nl-parse:${session.user.id}`, 20, 60);
  if (!limit.success) return NextResponse.json({ error: "Too many requests" }, { status: 429 });

  const bodyResult = await parseJson(req);
  if (!bodyResult.ok) return bodyResult.error;
  const parsed = RequestSchema.safeParse(bodyResult.data);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });

  try {
    const result = await parseGoalNLP(parsed.data.text);
    return NextResponse.json(result);
  } catch (err) {
    console.error("[NL-PARSE]", err);
    return NextResponse.json({ error: "Parsing failed — try again or fill manually" }, { status: 503 });
  }
}
