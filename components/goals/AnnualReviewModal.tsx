"use client";

import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  FileText, Copy, TrendingUp, TrendingDown, Minus,
  Star, AlertCircle, ChevronDown, ChevronUp, ClipboardList, CheckCircle2, Printer,
} from "lucide-react";
import type { ReviewResponse } from "@/lib/ai-client";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  employeeId: string;
  employeeName: string;
  cycleId: string;
  cycleName: string;
}

const GRADE_COLORS: Record<string, string> = {
  "A+": "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
  "A":  "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
  "A-": "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
  "B+": "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
  "B":  "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
  "B-": "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
  "C+": "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  "C":  "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  "C-": "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
  "D":  "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
  "F":  "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
};

const TREND_ICON = {
  improving: <TrendingUp className="w-4 h-4 text-green-500" />,
  declining: <TrendingDown className="w-4 h-4 text-red-500" />,
  stable: <Minus className="w-4 h-4 text-slate-400" />,
  insufficient_data: <Minus className="w-4 h-4 text-slate-300" />,
  no_data: <Minus className="w-4 h-4 text-slate-300" />,
};

function ScoreBar({ score }: { score: number }) {
  const color = score >= 80 ? "[&>div]:bg-green-500" : score >= 60 ? "[&>div]:bg-amber-500" : "[&>div]:bg-red-500";
  return <Progress value={score} className={`h-1.5 flex-1 ${color}`} />;
}

export function AnnualReviewModal({ open, onOpenChange, employeeId, employeeName, cycleId, cycleName }: Props) {
  const [result, setResult] = useState<ReviewResponse | null>(null);
  const [showDraft, setShowDraft] = useState(false);

  const synthesize = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/ai/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employeeId, cycleId }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error ?? "Review synthesis failed");
      }
      return res.json() as Promise<ReviewResponse>;
    },
    onSuccess: (data) => {
      setResult(data);
      toast.success("Annual review synthesized successfully");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  function copyDraft() {
    if (!result?.draft_review) return;
    navigator.clipboard.writeText(result.draft_review);
    toast.success("Review draft copied to clipboard");
  }

  function printReview() {
    if (!result) return;
    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(`
      <html><head><title>Annual Review — ${employeeName} (${cycleName})</title>
      <style>
        body { font-family: system-ui, sans-serif; padding: 40px; max-width: 800px; margin: 0 auto; color: #1e293b; }
        h1 { font-size: 22px; margin-bottom: 4px; } .sub { color: #64748b; font-size: 14px; margin-bottom: 28px; }
        .score-row { display: flex; align-items: center; gap: 16px; background: #f8fafc; border-radius: 12px; padding: 16px; margin-bottom: 20px; }
        .score-big { font-size: 40px; font-weight: 800; }
        .grade { display: inline-block; padding: 2px 10px; border-radius: 6px; font-weight: 700; font-size: 16px; background: #dcfce7; color: #166534; }
        .section { margin-bottom: 20px; }
        .section-title { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.1em; color: #64748b; margin-bottom: 8px; }
        .goal-row { display: flex; gap: 12px; font-size: 13px; margin-bottom: 6px; align-items: center; }
        .goal-name { flex: 1; color: #475569; }
        .goal-score { font-weight: 700; width: 44px; text-align: right; }
        .q-block { background: #eff6ff; border-radius: 8px; padding: 10px 14px; margin-bottom: 8px; }
        .q-label { font-size: 11px; font-weight: 700; color: #2563eb; margin-bottom: 4px; }
        .draft { background: #f5f3ff; border-radius: 8px; padding: 16px; font-size: 13px; line-height: 1.7; white-space: pre-wrap; }
        .footer { margin-top: 40px; font-size: 11px; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 12px; }
      </style></head><body>
      <h1>Annual Performance Review</h1>
      <div class="sub">${employeeName} &nbsp;·&nbsp; ${cycleName} &nbsp;·&nbsp; Generated by AtomQuest</div>
      <div class="score-row">
        <div class="score-big">${result.annual_weighted_score.toFixed(1)}%</div>
        <div>
          <div><span class="grade">${result.performance_grade}</span> &nbsp; ${result.recommended_rating}</div>
          <div style="color:#64748b;font-size:13px;margin-top:4px;">Trend: ${result.trend.replace("_", " ")} &nbsp;·&nbsp; ${Math.round(result.checkin_completion_rate * 100)}% check-in rate</div>
        </div>
      </div>
      <div class="section">
        <div class="section-title">Goal Performance</div>
        ${result.goal_achievements.map((g) => `<div class="goal-row"><span class="goal-name">${g.title}</span><span class="goal-score">${g.avg_score > 0 ? g.avg_score + "%" : "—"}</span><span style="color:#94a3b8;font-size:12px">${g.weightage}% wt</span></div>`).join("")}
      </div>
      ${Object.entries(result.quarterly_narratives).some(([, v]) => v) ? `
      <div class="section">
        <div class="section-title">Quarterly Highlights</div>
        ${Object.entries(result.quarterly_narratives).filter(([, v]) => v).map(([q, n]) => `<div class="q-block"><div class="q-label">${q}</div>${n}</div>`).join("")}
      </div>` : ""}
      <div class="section">
        <div class="section-title">Full Review Draft</div>
        <div class="draft">${result.draft_review}</div>
      </div>
      <div class="footer">Generated by AtomQuest Portal &nbsp;·&nbsp; Atomberg Technologies &nbsp;·&nbsp; ${new Date().toLocaleDateString()}</div>
      </body></html>
    `);
    win.document.close();
    win.print();
  }

  function handleOpen(o: boolean) {
    onOpenChange(o);
    if (!o) { setResult(null); setShowDraft(false); }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ClipboardList className="w-4.5 h-4.5 w-[18px] h-[18px] text-slate-600 dark:text-slate-400" />
            <span>Annual Review</span>
            <span className="text-sm font-normal text-slate-400">— {employeeName}</span>
            <span className="text-xs font-normal text-slate-400 ml-0.5">({cycleName})</span>
          </DialogTitle>
        </DialogHeader>

        {/* Trigger state */}
        {!result && !synthesize.isPending && (
          <div className="py-10 flex flex-col items-center gap-4 text-center">
            <div className="w-14 h-14 rounded-xl bg-slate-100 dark:bg-white/[0.06] flex items-center justify-center">
              <FileText className="w-6 h-6 text-slate-500" />
            </div>
            <div>
              <p className="font-semibold text-base text-slate-800 dark:text-slate-200">Generate Annual Review</p>
              <p className="text-sm text-slate-400 mt-1 max-w-sm leading-relaxed">
                Synthesizes all Q1–Q4 check-ins, self-assessments, and manager comments into a professional review document.
              </p>
            </div>
            <Button
              onClick={() => synthesize.mutate()}
              className="gap-2 bg-slate-900 hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-100"
            >
              <FileText className="w-3.5 h-3.5" /> Generate Review
            </Button>
          </div>
        )}

        {/* Loading skeleton */}
        {synthesize.isPending && (
          <div className="space-y-4 py-4">
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <div className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-pulse" />
              Analyzing check-ins and composing review…
            </div>
            <Skeleton className="h-20 w-full rounded-xl" />
            <Skeleton className="h-32 w-full rounded-xl" />
            <Skeleton className="h-24 w-full rounded-xl" />
          </div>
        )}

        {/* Results */}
        {result && (
          <div className="space-y-6">
            {/* ── Score Header ── */}
            <div className="flex items-center gap-4 p-4 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800">
              <div className="text-center">
                <p className="text-4xl font-extrabold tabular-nums text-slate-900 dark:text-white">
                  {result.annual_weighted_score.toFixed(1)}
                  <span className="text-base font-normal text-slate-400">%</span>
                </p>
                <p className="text-xs text-slate-500 mt-0.5">Annual Score</p>
              </div>
              <div className="flex-1 space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <Badge className={`font-bold text-sm px-3 ${GRADE_COLORS[result.performance_grade] ?? GRADE_COLORS["D"]}`}>
                    {result.performance_grade}
                  </Badge>
                  <span className="text-sm font-medium text-slate-700 dark:text-slate-300">
                    {result.recommended_rating}
                  </span>
                  <div className="flex items-center gap-1 text-xs text-slate-500">
                    {TREND_ICON[result.trend as keyof typeof TREND_ICON] ?? TREND_ICON.stable}
                    <span className="capitalize">{result.trend.replace("_", " ")}</span>
                  </div>
                </div>
                <Progress
                  value={result.annual_weighted_score}
                  className={`h-2 ${result.annual_weighted_score >= 80 ? "[&>div]:bg-green-500" : result.annual_weighted_score >= 60 ? "[&>div]:bg-amber-500" : "[&>div]:bg-red-500"}`}
                />
                <p className="text-xs text-slate-400">
                  {result.quarters_present.length} quarter(s) of data · {Math.round(result.checkin_completion_rate * 100)}% check-in completion
                </p>
              </div>
            </div>

            {/* ── Goal Achievements ── */}
            <div className="space-y-2">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide flex items-center gap-1.5">
                <TrendingUp className="w-3.5 h-3.5" /> Goal Performance
              </p>
              {result.goal_achievements.map((g) => (
                <div key={g.title} className="flex items-center gap-3">
                  <span className="text-sm text-slate-600 dark:text-slate-400 w-40 shrink-0 truncate" title={g.title}>{g.title}</span>
                  <ScoreBar score={g.avg_score} />
                  <span className="text-xs font-bold tabular-nums w-12 text-right text-slate-700 dark:text-slate-300">
                    {g.avg_score > 0 ? `${g.avg_score}%` : "—"}
                  </span>
                  <span className="text-xs text-slate-400 w-8 text-right">{g.weightage}%</span>
                </div>
              ))}
            </div>

            {/* ── Quarterly Narratives ── */}
            {Object.entries(result.quarterly_narratives).some(([, v]) => v) && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Quarterly Highlights</p>
                <div className="grid grid-cols-1 gap-2">
                  {Object.entries(result.quarterly_narratives).map(([q, narrative]) =>
                    narrative ? (
                      <div key={q} className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900/50">
                        <p className="text-xs font-bold text-blue-600 dark:text-blue-400 mb-1">{q}</p>
                        <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">{narrative}</p>
                      </div>
                    ) : null
                  )}
                </div>
              </div>
            )}

            {/* ── Strengths + Development ── */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <p className="text-xs font-semibold text-green-600 uppercase tracking-wide flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Key Strengths
                </p>
                {result.strengths.map((s, i) => (
                  <div key={i} className="flex items-start gap-2 p-2 bg-green-50 dark:bg-green-950/30 rounded-lg text-xs text-slate-700 dark:text-slate-300">
                    <Star className="w-3 h-3 text-green-500 mt-0.5 shrink-0" />{s}
                  </div>
                ))}
              </div>
              <div className="space-y-2">
                <p className="text-xs font-semibold text-amber-600 uppercase tracking-wide flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5" /> Development Areas
                </p>
                {result.development_areas.map((d, i) => (
                  <div key={i} className="flex items-start gap-2 p-2 bg-amber-50 dark:bg-amber-950/30 rounded-lg text-xs text-slate-700 dark:text-slate-300">
                    <AlertCircle className="w-3 h-3 text-amber-500 mt-0.5 shrink-0" />{d}
                  </div>
                ))}
              </div>
            </div>

            {/* ── Sentiment Profile ── */}
            {result.sentiment_profile?.overall && (
              <div className="p-3 rounded-lg border border-slate-100 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/30 text-xs">
                <p className="font-semibold text-slate-500 uppercase tracking-wide mb-2">Sentiment Analysis</p>
                <div className="flex flex-wrap gap-4 text-slate-600 dark:text-slate-400">
                  <span>Overall: <strong className="capitalize">{result.sentiment_profile.overall}</strong></span>
                  <span>Self-awareness: <strong className="capitalize">{result.sentiment_profile.self_awareness_score}</strong></span>
                  <span>Data confidence: <strong className="capitalize">{result.sentiment_profile.confidence_level}</strong></span>
                </div>
                {result.sentiment_profile.recurring_strengths_themes.length > 0 && (
                  <p className="mt-2">Recurring strengths: {result.sentiment_profile.recurring_strengths_themes.join(", ")}</p>
                )}
                {result.sentiment_profile.recurring_blocker_themes.length > 0 && (
                  <p className="mt-1">Recurring blockers: {result.sentiment_profile.recurring_blocker_themes.join(", ")}</p>
                )}
              </div>
            )}

            {/* ── Full Draft Review ── */}
            <div className="border border-purple-100 dark:border-purple-900/50 rounded-xl overflow-hidden">
              <button
                type="button"
                onClick={() => setShowDraft((v) => !v)}
                className="w-full flex items-center justify-between px-4 py-3 bg-purple-50 dark:bg-purple-950/30 text-sm font-semibold text-purple-700 dark:text-purple-300 hover:bg-purple-100 dark:hover:bg-purple-900/40 transition-colors"
              >
                <span className="flex items-center gap-2">
                  <FileText className="w-4 h-4" /> Full Review Draft
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    className="h-7 text-xs gap-1 text-purple-600"
                    onClick={(e) => { e.stopPropagation(); copyDraft(); }}
                  >
                    <Copy className="w-3 h-3" /> Copy
                  </Button>
                  {showDraft ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </div>
              </button>
              {showDraft && (
                <div className="p-4 prose prose-sm dark:prose-invert max-w-none">
                  <pre className="whitespace-pre-wrap text-sm text-slate-700 dark:text-slate-300 font-sans leading-relaxed">
                    {result.draft_review}
                  </pre>
                </div>
              )}
            </div>

            {/* Actions row */}
            <div className="flex items-center justify-between pt-1">
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 text-slate-600 dark:text-slate-400"
                onClick={printReview}
              >
                <Printer className="w-3.5 h-3.5" /> Print / Save PDF
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="gap-1.5 text-slate-600 dark:text-slate-400"
                onClick={() => { setResult(null); synthesize.mutate(); }}
              >
                <FileText className="w-3.5 h-3.5" /> Re-generate
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
