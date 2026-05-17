import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"
import { format, formatDistanceToNow, differenceInDays, differenceInHours, differenceInMinutes, differenceInSeconds } from "date-fns"
import { NextResponse } from "next/server"

// ─── API Helpers ─────────────────────────────────────────────

/**
 * Safely parse the JSON body of a Next.js Request.
 * Returns { ok: true, data } on success or { ok: false, error: NextResponse } on failure.
 * Use this instead of bare `req.json()` to prevent malformed payloads from
 * causing unhandled 500s — the caller gets a proper 400 Bad Request instead.
 */
export async function parseJson(
  req: Request
): Promise<{ ok: true; data: unknown } | { ok: false; error: NextResponse }> {
  try {
    const data = await req.json();
    return { ok: true, data };
  } catch {
    return {
      ok: false,
      error: NextResponse.json({ error: "Invalid JSON in request body" }, { status: 400 }),
    };
  }
}

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

// ─── Date Helpers ────────────────────────────────────────────

export function formatDate(date: Date | string): string {
  return format(new Date(date), "MMM d, yyyy");
}

export function formatDateTime(date: Date | string): string {
  return format(new Date(date), "MMM d, yyyy h:mm a");
}

export function formatRelativeTime(date: Date | string): string {
  return formatDistanceToNow(new Date(date), { addSuffix: true });
}

export function getCountdown(targetDate: Date | string): {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  isExpired: boolean;
} {
  const target = new Date(targetDate);
  const now = new Date();

  if (now >= target) {
    return { days: 0, hours: 0, minutes: 0, seconds: 0, isExpired: true };
  }

  const days = differenceInDays(target, now);
  const hours = differenceInHours(target, now) % 24;
  const minutes = differenceInMinutes(target, now) % 60;
  const seconds = differenceInSeconds(target, now) % 60;

  return { days, hours, minutes, seconds, isExpired: false };
}

// ─── Status Colors ───────────────────────────────────────────

export function getGoalStatusColor(status: string): string {
  const colors: Record<string, string> = {
    DRAFT: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
    SUBMITTED: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
    UNDER_REVIEW: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
    APPROVED: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
    REJECTED: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
    RETURNED: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
    LOCKED: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300",
  };
  return colors[status] || colors.DRAFT;
}

export function getProgressStatusColor(status: string): string {
  const colors: Record<string, string> = {
    NOT_STARTED: "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300",
    ON_TRACK: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
    AT_RISK: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
    COMPLETED: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
    OVERDUE: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
  };
  return colors[status] || colors.NOT_STARTED;
}

// ─── UoM Helpers ─────────────────────────────────────────────

export function getUoMLabel(uomType: string): string {
  const labels: Record<string, string> = {
    NUMERIC_MIN: "Higher is Better",
    NUMERIC_MAX: "Lower is Better",
    TIMELINE: "Timeline",
    ZERO: "Zero Target",
    PERCENTAGE: "Percentage",
  };
  return labels[uomType] || uomType;
}

export function getUoMColor(uomType: string): string {
  const colors: Record<string, string> = {
    NUMERIC_MIN: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
    NUMERIC_MAX: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
    TIMELINE: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
    ZERO: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
    PERCENTAGE: "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300",
  };
  return colors[uomType] || "";
}

// ─── Format Helpers ──────────────────────────────────────────

export function formatScore(score: number | null): string {
  if (score === null || score === undefined) return "—";
  return `${score.toFixed(1)}%`;
}

export function formatWeightage(weightage: number): string {
  return `${weightage}%`;
}

export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength) + "…";
}

export function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}
