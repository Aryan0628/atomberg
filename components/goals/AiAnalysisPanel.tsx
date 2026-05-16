"use client";

import { Progress } from "@/components/ui/progress";
import { Sparkles, AlertCircle, XCircle, Target, TrendingUp, CheckCircle2 } from "lucide-react";

export interface AiResult {
  overall_score: number;
  verdict: "strong" | "acceptable" | "needs_work";
  smart_scores: { specific: number; measurable: number; achievable: number; relevant: number; time_bound: number };
  suggestions: string[];
  improved_title: string;
  semantic_match: { title: string; similarity: number };
  brd_issues: string[];
}

interface AiAnalysisPanelProps {
  result: AiResult;
  onApplyTitle?: (title: string) => void;
  currentTitle?: string;
}

const SMART_LABELS: Record<string, string> = {
  specific: "Specific",
  measurable: "Measurable",
  achievable: "Achievable",
  relevant: "Relevant",
  time_bound: "Time-bound",
};

function scoreColor(v: number) {
  if (v >= 8) return "text-green-600 dark:text-green-400";
  if (v >= 6) return "text-amber-600 dark:text-amber-400";
  return "text-red-600 dark:text-red-400";
}

function barColor(v: number) {
  if (v >= 8) return "[&>div]:bg-green-500";
  if (v >= 6) return "[&>div]:bg-amber-500";
  return "[&>div]:bg-red-500";
}

const VERDICT_STYLES: Record<string, string> = {
  strong: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400",
  acceptable: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-400",
  needs_work: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400",
};

export function AiAnalysisPanel({ result, onApplyTitle, currentTitle }: AiAnalysisPanelProps) {
  const showImproved = result.improved_title && result.improved_title !== currentTitle;

  return (
    <div className="space-y-4 text-sm">
      {/* Overall score + verdict */}
      <div className="flex items-center gap-4">
        <div className={`text-4xl font-extrabold tabular-nums ${scoreColor(result.overall_score)}`}>
          {result.overall_score}
          <span className="text-base font-normal text-slate-400">/10</span>
        </div>
        <div className="flex-1 space-y-1.5">
          <div className="flex items-center justify-between">
            <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full ${VERDICT_STYLES[result.verdict] ?? VERDICT_STYLES.acceptable}`}>
              {result.verdict.replace("_", " ").toUpperCase()}
            </span>
            <span className="text-xs text-slate-400">{result.overall_score * 10}% quality</span>
          </div>
          <Progress value={result.overall_score * 10} className={`h-2 ${barColor(result.overall_score)}`} />
        </div>
      </div>

      {/* SMART breakdown */}
      <div className="space-y-2.5">
        <div className="flex items-center gap-1.5">
          <TrendingUp className="w-3.5 h-3.5 text-slate-400" />
          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">SMART Breakdown</p>
        </div>
        {(Object.entries(result.smart_scores) as [string, number][]).map(([key, val]) => (
          <div key={key} className="flex items-center gap-3">
            <span className="text-xs text-slate-500 w-24 shrink-0">{SMART_LABELS[key] ?? key}</span>
            <Progress value={val * 10} className={`flex-1 h-1.5 ${barColor(val)}`} />
            <span className={`text-xs font-bold w-8 text-right tabular-nums ${scoreColor(val)}`}>{val}/10</span>
          </div>
        ))}
      </div>

      {/* BRD issues — show first since they're blockers */}
      {result.brd_issues?.length > 0 && (
        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5">
            <XCircle className="w-3.5 h-3.5 text-red-500" />
            <p className="text-xs font-semibold text-red-500 uppercase tracking-wide">Policy Issues</p>
          </div>
          {result.brd_issues.map((issue, i) => (
            <div key={i} className="flex items-start gap-2 p-2.5 bg-red-50 dark:bg-red-950/30 rounded-lg border border-red-100 dark:border-red-900/50">
              <XCircle className="w-3.5 h-3.5 text-red-500 mt-0.5 shrink-0" />
              <span className="text-xs text-red-700 dark:text-red-300 leading-snug">{issue}</span>
            </div>
          ))}
        </div>
      )}

      {/* Suggestions */}
      {result.suggestions.length > 0 && (
        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5">
            <AlertCircle className="w-3.5 h-3.5 text-amber-500" />
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Improvement Suggestions</p>
          </div>
          {result.suggestions.map((s, i) => (
            <div key={i} className="flex items-start gap-2 p-2.5 bg-amber-50 dark:bg-amber-950/30 rounded-lg border border-amber-100 dark:border-amber-900/50">
              <AlertCircle className="w-3.5 h-3.5 text-amber-500 mt-0.5 shrink-0" />
              <span className="text-xs text-slate-700 dark:text-slate-300 leading-snug">{s}</span>
            </div>
          ))}
        </div>
      )}

      {/* Improved title */}
      {showImproved && (
        <div className="p-3 bg-purple-50 dark:bg-purple-950/30 rounded-lg border border-purple-100 dark:border-purple-900/50">
          <div className="flex items-center gap-1.5 mb-2">
            <Sparkles className="w-3.5 h-3.5 text-purple-500" />
            <span className="text-xs font-semibold text-purple-600 dark:text-purple-400">AI-Suggested Title</span>
          </div>
          <p className="text-xs text-slate-700 dark:text-slate-300 leading-snug mb-2">{result.improved_title}</p>
          {onApplyTitle && (
            <button
              type="button"
              onClick={() => onApplyTitle(result.improved_title)}
              className="text-xs text-purple-600 dark:text-purple-400 font-semibold hover:underline flex items-center gap-1"
            >
              <CheckCircle2 className="w-3 h-3" /> Apply this title
            </button>
          )}
        </div>
      )}

      {/* Semantic match */}
      {result.semantic_match?.similarity > 0.5 && result.semantic_match?.title && (
        <div className="flex items-start gap-2 p-2.5 bg-slate-50 dark:bg-slate-800/50 rounded-lg border border-slate-100 dark:border-slate-700">
          <Target className="w-3.5 h-3.5 text-slate-400 mt-0.5 shrink-0" />
          <div className="min-w-0">
            <span className="text-xs text-slate-500">
              Golden standard match ({Math.round(result.semantic_match.similarity * 100)}% similar):
            </span>
            <p className="text-xs text-slate-700 dark:text-slate-300 italic mt-0.5 leading-snug">
              &ldquo;{result.semantic_match.title}&rdquo;
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
