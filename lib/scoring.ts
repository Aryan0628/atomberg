// lib/scoring.ts
// All 5 UoM score computation functions + Goal Wellness Score (unique differentiator)
// Shared between API routes and client components for consistency.

export interface ScoringInput {
  uomType: "NUMERIC_MIN" | "NUMERIC_MAX" | "TIMELINE" | "ZERO" | "PERCENTAGE";
  target: number | null;
  targetDate: Date | null;
  actualValue: number | null;
  actualDate: Date | null;
}

/**
 * Computes the achievement score for a single goal based on its UoM type.
 * Returns a percentage (0-100+, uncapped for overachievement).
 */
export function computeScore(input: ScoringInput): number {
  const { uomType, target, targetDate, actualValue, actualDate } = input;

  switch (uomType) {
    case "NUMERIC_MIN":
    case "PERCENTAGE": {
      // Higher is better: score = (actual / target) * 100
      if (!target || target === 0 || actualValue === null) return 0;
      return Math.round((actualValue / target) * 10000) / 100;
    }
    case "NUMERIC_MAX": {
      // Lower is better: score = (target / actual) * 100
      if (!target || actualValue === null || actualValue === 0) return 0;
      return Math.round((target / actualValue) * 10000) / 100;
    }
    case "TIMELINE": {
      // Date-based: 100% if on/before deadline, -5% per day overdue
      if (!targetDate || !actualDate) return 0;
      const deadline = new Date(targetDate);
      const completion = new Date(actualDate);
      if (completion <= deadline) return 100;
      const daysOverdue = Math.floor(
        (completion.getTime() - deadline.getTime()) / (1000 * 60 * 60 * 24)
      );
      return Math.max(0, 100 - daysOverdue * 5);
    }
    case "ZERO": {
      // Binary: 0 incidents = 100%, any positive = 0%
      if (actualValue === null) return 0;
      return actualValue === 0 ? 100 : 0;
    }
    default:
      return 0;
  }
}

/**
 * Returns a Tailwind color class based on the score percentage.
 */
export function getScoreColor(score: number): string {
  if (score >= 90) return "text-green-600";
  if (score >= 70) return "text-blue-600";
  if (score >= 50) return "text-amber-600";
  return "text-red-600";
}

/**
 * Returns a human-readable label for the score.
 */
export function getScoreLabel(score: number): string {
  if (score >= 90) return "Excellent";
  if (score >= 70) return "On Track";
  if (score >= 50) return "Needs Attention";
  return "At Risk";
}

/**
 * Returns a background color class for score badges.
 */
export function getScoreBgColor(score: number): string {
  if (score >= 90) return "bg-green-100 dark:bg-green-900/30";
  if (score >= 70) return "bg-blue-100 dark:bg-blue-900/30";
  if (score >= 50) return "bg-amber-100 dark:bg-amber-900/30";
  return "bg-red-100 dark:bg-red-900/30";
}

/**
 * Computes the weighted average score across multiple goals.
 */
export function computeWeightedScore(
  goals: { weightage: number; score: number }[]
): number {
  const total = goals.reduce((sum, g) => sum + g.weightage, 0);
  if (total === 0) return 0;
  return goals.reduce((sum, g) => sum + (g.score * g.weightage) / total, 0);
}

/**
 * Goal Wellness Score — unique differentiator.
 * Provides a letter grade (A/B/C/D) per employee based on goal health.
 * Tooltip expands to show issue list. Instantly lets managers know who needs attention.
 */
export function computeGoalWellness(data: {
  goalsCount: number;
  weightageTotal: number;
  checkinCompletionRate: number;
  avgScore: number;
  reworkCount: number;
}): { score: number; grade: "A" | "B" | "C" | "D"; issues: string[] } {
  const issues: string[] = [];
  let score = 100;

  if (data.goalsCount === 0) {
    score -= 40;
    issues.push("No goals set");
  }
  if (Math.abs(data.weightageTotal - 100) > 0.01) {
    score -= 20;
    issues.push("Weightage ≠ 100%");
  }
  if (data.checkinCompletionRate < 0.5) {
    score -= 20;
    issues.push("Check-ins incomplete");
  }
  if (data.avgScore < 50) {
    score -= 10;
    issues.push("Low achievement score");
  }
  if (data.reworkCount > 2) {
    score -= 5;
    issues.push("Multiple goal reworks");
  }

  const clamped = Math.max(0, score);
  const grade =
    clamped >= 85 ? "A" : clamped >= 70 ? "B" : clamped >= 55 ? "C" : "D";
  return { score: clamped, grade, issues };
}

/**
 * Forecasts annual weighted score based on available quarter scores.
 * Returns the running average — simple but effective for the Forecast card.
 */
export function forecastAnnualScore(quarterScores: number[]): number {
  if (quarterScores.length === 0) return 0;
  const avg = quarterScores.reduce((a, b) => a + b, 0) / quarterScores.length;
  return Math.round(avg * 10) / 10;
}

/**
 * Determines the trend direction for forecasting.
 */
export function getScoreTrend(
  currentScore: number,
  targetScore: number = 80
): "up" | "flat" | "down" {
  if (currentScore >= targetScore + 5) return "up";
  if (currentScore >= targetScore - 5) return "flat";
  return "down";
}
