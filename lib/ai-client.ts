// lib/ai-client.ts
// HMAC-signed HTTP client for the Python AI microservice.
// Circuit breaker: after 3 consecutive failures, falls back to direct Gemini call for 60s.

import { createHmac } from "crypto";

export interface GoalEvalRequest {
  title: string;
  description?: string;
  uom_type: string;
  target?: number | null;
  weightage: number;
  thrust_area: string;
}

export interface GoalEvalResponse {
  overall_score: number;
  verdict: "strong" | "acceptable" | "needs_work";
  smart_scores: { specific: number; measurable: number; achievable: number; relevant: number; time_bound: number };
  suggestions: string[];
  improved_title: string;
  semantic_match: { title: string; similarity: number };
  brd_issues: string[];
}

// ── Circuit breaker state (module-level, survives request lifetime in serverless warm instances) ──
let _failures = 0;
let _openUntil = 0;
const FAILURE_THRESHOLD = 3;
const OPEN_DURATION_MS = 60_000;

function signRequest(body: string): { token: string; timestamp: string } {
  const secret = process.env.AI_SERVICE_SECRET;
  if (!secret) throw new Error("AI_SERVICE_SECRET is not configured — refusing to sign with empty key");
  const timestamp = String(Math.floor(Date.now() / 1000));
  const token = createHmac("sha256", secret)
    .update(timestamp + body)
    .digest("hex");
  return { token, timestamp };
}

async function callPythonService(payload: GoalEvalRequest): Promise<GoalEvalResponse> {
  const url = `${process.env.AI_SERVICE_URL}/evaluate`;
  const body = JSON.stringify(payload);
  const { token, timestamp } = signRequest(body);

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Service-Token": token,
      "X-Timestamp": timestamp,
    },
    body,
    signal: AbortSignal.timeout(8_000), // 8s hard timeout
  });

  if (!res.ok) throw new Error(`AI service returned ${res.status}`);
  return res.json();
}

async function callGeminiFallback(payload: GoalEvalRequest): Promise<GoalEvalResponse> {
  // Direct Gemini call — used when Python service circuit is open
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY not configured");

  const prompt = `You are an HR performance consultant. Evaluate this employee goal against SMART criteria.

Title: ${payload.title}
Description: ${payload.description || "Not provided"}
Thrust Area: ${payload.thrust_area}
UoM Type: ${payload.uom_type}
Target: ${payload.target ?? "Not specified"}
Weightage: ${payload.weightage}%

Respond with ONLY valid JSON:
{
  "overall_score": <1-10>,
  "verdict": "<strong|acceptable|needs_work>",
  "smart_scores": { "specific": <1-10>, "measurable": <1-10>, "achievable": <1-10>, "relevant": <1-10>, "time_bound": <1-10> },
  "suggestions": [<up to 3 strings>],
  "improved_title": "<better title>",
  "brd_issues": []
}`;

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
      signal: AbortSignal.timeout(10_000),
    }
  );

  if (!res.ok) throw new Error("Gemini fallback failed");
  const json = await res.json();
  const raw = json.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";
  const cleaned = raw.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
  const parsed = JSON.parse(cleaned);
  return { ...parsed, semantic_match: { title: "", similarity: 0 } };
}

export async function evaluateGoal(payload: GoalEvalRequest): Promise<GoalEvalResponse> {
  const serviceUrl = process.env.AI_SERVICE_URL;

  // Circuit open — skip Python service, go direct to Gemini fallback
  if (!serviceUrl || Date.now() < _openUntil) {
    return callGeminiFallback(payload);
  }

  try {
    const result = await callPythonService(payload);
    _failures = 0; // reset on success
    return result;
  } catch {
    _failures++;
    if (_failures >= FAILURE_THRESHOLD) {
      _openUntil = Date.now() + OPEN_DURATION_MS;
      _failures = 0;
    }
    // Fall back to direct Gemini call
    return callGeminiFallback(payload);
  }
}
