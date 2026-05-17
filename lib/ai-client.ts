// lib/ai-client.ts
// HMAC-signed HTTP client for the Python AI microservice.
// Circuit breaker: after 3 consecutive failures, falls back to direct Gemini call for 60s.
// Supports: goal evaluation, annual review synthesis, semantic redundancy detection.

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
  const cleaned = raw.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "").trim();
  const parsed = JSON.parse(cleaned);

  const DEFAULT_SMART = { specific: 5, measurable: 5, achievable: 5, relevant: 5, time_bound: 5 };
  return {
    overall_score: typeof parsed.overall_score === "number" ? parsed.overall_score : 5,
    verdict: (["strong", "acceptable", "needs_work"] as const).includes(parsed.verdict)
      ? parsed.verdict as GoalEvalResponse["verdict"]
      : "acceptable",
    smart_scores: parsed.smart_scores && typeof parsed.smart_scores === "object"
      ? { ...DEFAULT_SMART, ...parsed.smart_scores }
      : DEFAULT_SMART,
    suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions : [],
    improved_title: typeof parsed.improved_title === "string" ? parsed.improved_title : "",
    brd_issues: Array.isArray(parsed.brd_issues) ? parsed.brd_issues : [],
    semantic_match: { title: "", similarity: 0 },
  };
}

// ─── Review Synthesis Types ──────────────────────────────────────────────────

export interface ReviewCheckin {
  quarter: string;
  actualValue?: number | null;
  scorePercentage?: number | null;
  progressStatus: string;
  employeeNote?: string | null;
  selfRating?: number | null;
  whatWentWell?: string | null;
  blockers?: string | null;
  managerComment?: string | null;
  managerRating?: number | null;
}

export interface ReviewGoal {
  id: string;
  title: string;
  thrustArea: string;
  uomType: string;
  target?: number | null;
  weightage: number;
  checkins: ReviewCheckin[];
}

export interface ReviewRequest {
  employee: { id: string; name: string; department: string; designation: string };
  cycle: { name: string; fiscalYear: string };
  goals: ReviewGoal[];
}

export interface ReviewResponse {
  annual_weighted_score: number;
  performance_grade: string;
  trend: string;
  recommended_rating: string;
  quarters_present: string[];
  checkin_completion_rate: number;
  goal_achievements: Array<{
    title: string; thrust_area: string; weightage: number;
    avg_score: number; check_in_count: number; status_summary: string;
  }>;
  sentiment_profile: {
    overall: string; confidence_level: string;
    recurring_strengths_themes: string[]; recurring_blocker_themes: string[];
    self_awareness_score: string;
  };
  quarterly_narratives: Record<string, string | null>;
  strengths: string[];
  development_areas: string[];
  draft_review: string;
}

// ─── Redundancy Detection Types ──────────────────────────────────────────────

export interface RedundancyRequest {
  new_goal: { title: string; description: string; thrust_area: string };
  existing_goals: Array<{
    id: string; title: string; description: string;
    thrust_area: string; owner_name: string; owner_department: string;
  }>;
}

export interface RedundancyMatch {
  goal_id: string;
  goal_title: string;
  owner_name: string;
  owner_department: string;
  thrust_area: string;
  similarity: number;
  match_level: "near_duplicate" | "highly_similar";
  recommendation: string;
}

export interface RedundancyResponse {
  has_redundancy: boolean;
  matches: RedundancyMatch[];
}

// ─── Shared helpers ───────────────────────────────────────────────────────────

async function geminiGenerate(prompt: string): Promise<string> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY not configured");
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] }),
      signal: AbortSignal.timeout(30_000),
    }
  );
  if (!res.ok) throw new Error(`Gemini ${res.status}`);
  const json = await res.json();
  const raw: string = json.candidates?.[0]?.content?.parts?.[0]?.text ?? "{}";
  return raw.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
}

async function geminiEmbed(texts: string[]): Promise<number[][]> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY not configured");
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-embedding-001:batchEmbedContents?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        requests: texts.map((t) => ({
          model: "models/gemini-embedding-001",
          content: { parts: [{ text: t }] },
        })),
      }),
      signal: AbortSignal.timeout(60_000),
    }
  );
  if (!res.ok) throw new Error(`Gemini embed ${res.status}`);
  const json = await res.json();
  return json.embeddings.map((e: { values: number[] }) => e.values);
}

function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denom = Math.sqrt(normA) * Math.sqrt(normB);
  return denom === 0 ? 0 : dot / denom;
}

// ─── Gemini fallbacks (used when AI_SERVICE_URL is empty or circuit is open) ──

async function reviewSynthesisFallback(payload: ReviewRequest): Promise<ReviewResponse> {
  const { employee, cycle, goals } = payload;

  // Compute weighted score deterministically in TS — same logic as review_scorer.py
  const goalAchievements = goals.map((g) => {
    const scores = g.checkins.map((c) => c.scorePercentage ?? 0).filter((s) => s > 0);
    const avgScore = scores.length ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
    return { title: g.title, thrust_area: g.thrustArea, weightage: g.weightage, avg_score: Math.round(avgScore * 10) / 10, check_in_count: scores.length, status_summary: avgScore >= 80 ? "on_track" : avgScore >= 50 ? "at_risk" : "not_started" };
  });

  const withScores = goalAchievements.filter((g) => g.avg_score > 0);
  const totalWeight = withScores.reduce((s, g) => s + g.weightage, 0);
  const annualScore = totalWeight > 0
    ? Math.round(withScores.reduce((s, g) => s + (g.avg_score * g.weightage) / totalWeight, 0) * 10) / 10
    : 0;

  const grade = annualScore >= 90 ? "A" : annualScore >= 80 ? "B+" : annualScore >= 70 ? "B" : annualScore >= 60 ? "C" : "D";
  const rating = annualScore >= 90 ? "Exceptional" : annualScore >= 80 ? "Exceeds Expectations" : annualScore >= 70 ? "Meets Expectations" : "Needs Improvement";

  const allCheckins = goals.flatMap((g) => g.checkins);
  const quarters = [...new Set(allCheckins.map((c) => c.quarter))].sort();

  const goalSummary = goalAchievements
    .map((g) => `${g.title} (${g.weightage}% weight): ${g.avg_score}% avg score`)
    .join("\n");

  const checkinText = goals.flatMap((g) =>
    g.checkins.map((c) =>
      `[${c.quarter}] ${g.title}: score ${c.scorePercentage ?? 0}%` +
      (c.whatWentWell ? ` | Went well: ${c.whatWentWell}` : "") +
      (c.blockers ? ` | Blockers: ${c.blockers}` : "") +
      (c.selfRating ? ` | Self-rating: ${c.selfRating}/5` : "")
    )
  ).join("\n");

  const prompt = `You are a senior HR business partner. Synthesise an annual performance review for ${employee.name} (${employee.designation}, ${employee.department}).

Cycle: ${cycle.name} | Overall score: ${annualScore}% (${grade}) | Rating: ${rating}

Goal performance:
${goalSummary}

Check-in data:
${checkinText || "No check-in data available."}

Write a professional annual review (250-350 words) in four paragraphs labelled:
[SUMMARY] [ACHIEVEMENTS] [STRENGTHS] [DEVELOPMENT]

Then on separate lines provide:
STRENGTHS_LIST: <item1> | <item2> | <item3>
DEV_LIST: <item1> | <item2>`;

  const raw = await geminiGenerate(prompt);
  const lines = raw.split("\n");
  const getTag = (tag: string) => (lines.find((l) => l.startsWith(`${tag}:`)) ?? "").replace(`${tag}:`, "").trim();

  const strengths = (getTag("STRENGTHS_LIST") || "Strong performance across goals | Consistent delivery | Self-awareness").split("|").map((s) => s.trim()).filter(Boolean);
  const devAreas = (getTag("DEV_LIST") || "Continue building on current momentum | Ensure all quarters have check-ins").split("|").map((s) => s.trim()).filter(Boolean);
  const draftLines = lines.filter((l) => !l.startsWith("STRENGTHS_LIST:") && !l.startsWith("DEV_LIST:"));

  return {
    annual_weighted_score: annualScore,
    performance_grade: grade,
    trend: "insufficient_data",
    recommended_rating: rating,
    quarters_present: quarters,
    checkin_completion_rate: allCheckins.length / Math.max(goals.length * 4, 1),
    goal_achievements: goalAchievements,
    sentiment_profile: { overall: "neutral", confidence_level: "medium", recurring_strengths_themes: [], recurring_blocker_themes: [], self_awareness_score: "medium" },
    quarterly_narratives: { Q1: null, Q2: null, Q3: null, Q4: null },
    strengths,
    development_areas: devAreas,
    draft_review: draftLines.join("\n").trim(),
  };
}

async function checkRedundancyFallback(payload: RedundancyRequest): Promise<RedundancyResponse> {
  const { new_goal, existing_goals } = payload;
  if (!existing_goals.length) return { has_redundancy: false, matches: [] };

  const toText = (g: { title: string; description?: string; thrust_area?: string }) =>
    [g.title, g.description, g.thrust_area].filter(Boolean).join(" | ");

  const allTexts = [toText(new_goal), ...existing_goals.map(toText)];
  const embeddings = await geminiEmbed(allTexts);
  const newEmb = embeddings[0];

  const THRESHOLD = 0.85;
  const rawMatches = existing_goals
    .map((g, i) => ({ ...g, similarity: cosineSimilarity(newEmb, embeddings[i + 1]) }))
    .filter((m) => m.similarity >= THRESHOLD)
    .sort((a, b) => b.similarity - a.similarity)
    .map((m) => ({
      goal_id: m.id,
      goal_title: m.title,
      owner_name: m.owner_name,
      owner_department: m.owner_department,
      thrust_area: m.thrust_area,
      similarity: Math.round(m.similarity * 10000) / 10000,
      match_level: (m.similarity >= 0.92 ? "near_duplicate" : "highly_similar") as "near_duplicate" | "highly_similar",
      recommendation: `${m.owner_name} in ${m.owner_department} is working on a ${Math.round(m.similarity * 100)}% similar goal ("${m.title}"). Consider converting both into a Shared Departmental KPI to eliminate duplicate effort.`,
    }));

  if (!rawMatches.length) return { has_redundancy: false, matches: [] };

  // One Gemini call to write better recommendations for all matches
  try {
    const matchLines = rawMatches.map((m, i) =>
      `${i + 1}. "${m.goal_title}" by ${m.owner_name} (${m.owner_department}) — ${Math.round(m.similarity * 100)}% similar`
    ).join("\n");

    const prompt = `New goal: "${new_goal.title}" (${new_goal.thrust_area})\n\nSimilar existing goals:\n${matchLines}\n\nFor each, write one 2-sentence recommendation suggesting whether to merge, coordinate, or split. Output ONLY a JSON array of strings: ["rec1", "rec2"]`;
    const recRaw = await geminiGenerate(prompt);
    const recs: string[] = JSON.parse(recRaw);
    rawMatches.forEach((m, i) => { if (recs[i]) m.recommendation = recs[i]; });
  } catch { /* keep default recommendations */ }

  return { has_redundancy: true, matches: rawMatches };
}

// ─── Python service callers ───────────────────────────────────────────────────

async function callPythonReview(payload: ReviewRequest): Promise<ReviewResponse> {
  const url = `${process.env.AI_SERVICE_URL}/review/synthesize`;
  const body = JSON.stringify(payload);
  const { token, timestamp } = signRequest(body);
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Service-Token": token, "X-Timestamp": timestamp },
    body,
    signal: AbortSignal.timeout(45_000),
  });
  if (!res.ok) throw new Error(`AI service ${res.status}`);
  return res.json();
}

async function callPythonRedundancy(payload: RedundancyRequest): Promise<RedundancyResponse> {
  const url = `${process.env.AI_SERVICE_URL}/goals/check-redundancy`;
  const body = JSON.stringify(payload);
  const { token, timestamp } = signRequest(body);
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Service-Token": token, "X-Timestamp": timestamp },
    body,
    signal: AbortSignal.timeout(30_000),
  });
  if (!res.ok) throw new Error(`AI service ${res.status}`);
  return res.json();
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function synthesizeReview(payload: ReviewRequest): Promise<ReviewResponse> {
  const serviceUrl = process.env.AI_SERVICE_URL;
  if (!serviceUrl || Date.now() < _openUntil) return reviewSynthesisFallback(payload);
  try {
    const result = await callPythonReview(payload);
    _failures = 0;
    return result;
  } catch {
    _failures++;
    if (_failures >= FAILURE_THRESHOLD) { _openUntil = Date.now() + OPEN_DURATION_MS; _failures = 0; }
    return reviewSynthesisFallback(payload);
  }
}

export async function checkRedundancy(payload: RedundancyRequest): Promise<RedundancyResponse> {
  const serviceUrl = process.env.AI_SERVICE_URL;
  if (!serviceUrl || Date.now() < _openUntil) return checkRedundancyFallback(payload);
  try {
    const result = await callPythonRedundancy(payload);
    _failures = 0;
    return result;
  } catch {
    _failures++;
    if (_failures >= FAILURE_THRESHOLD) { _openUntil = Date.now() + OPEN_DURATION_MS; _failures = 0; }
    return checkRedundancyFallback(payload);
  }
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
