"use client";

import { Progress } from "@/components/ui/progress";
import { CheckCircle2, XCircle, AlertCircle, TrendingUp, Lightbulb, ArrowRight } from "lucide-react";

export interface AiResult {
  overall_score: number;
  verdict: "strong" | "acceptable" | "needs_work";
  smart_scores: { specific: number; measurable: number; achievable: number; relevant: number; time_bound: number };
  suggestions: string[];
  improved_title: string;
  semantic_match: { title: string; similarity: number };
  brd_issues: string[];
}

interface Props {
  result: AiResult;
  onApplyTitle?: (title: string) => void;
  currentTitle?: string;
}

const SMART_LABELS: Record<string, string> = {
  specific: "Specific", measurable: "Measurable", achievable: "Achievable",
  relevant: "Relevant", time_bound: "Time-bound",
};

const VERDICT_CONFIG = {
  strong:      { label: "Strong",      dot: "bg-emerald-500", text: "text-emerald-600 dark:text-emerald-400", bar: "[&>div]:bg-emerald-500" },
  acceptable:  { label: "Acceptable",  dot: "bg-blue-500",    text: "text-blue-600 dark:text-blue-400",       bar: "[&>div]:bg-blue-500" },
  needs_work:  { label: "Needs work",  dot: "bg-amber-500",   text: "text-amber-600 dark:text-amber-400",     bar: "[&>div]:bg-amber-500" },
};

function smartBarColor(v: number) {
  return v >= 8 ? "[&>div]:bg-emerald-500" : v >= 6 ? "[&>div]:bg-blue-400" : "[&>div]:bg-amber-400";
}

function smartTextColor(v: number) {
  return v >= 8 ? "text-emerald-600 dark:text-emerald-400" : v >= 6 ? "text-blue-600 dark:text-blue-400" : "text-amber-600 dark:text-amber-400";
}

export function AiAnalysisPanel({ result, onApplyTitle, currentTitle }: Props) {
  const cfg          = VERDICT_CONFIG[result.verdict] ?? VERDICT_CONFIG.acceptable;
  const showImproved = !!result.improved_title && result.improved_title !== currentTitle;

  return (
    <div className="space-y-4 text-sm animate-in fade-in slide-in-from-bottom-2 duration-300">

      {/* Score header */}
      <div className="flex items-center gap-4">
        <div className="text-center shrink-0">
          <p className={`text-3xl font-extrabold tabular-nums leading-none ${cfg.text}`}>{result.overall_score}</p>
          <p className="text-[10px] text-muted-foreground mt-0.5 font-medium">/10</p>
        </div>
        <div className="flex-1 space-y-1.5">
          <div className="flex items-center gap-2">
            <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot} flex-shrink-0`} />
            <span className={`text-xs font-semibold ${cfg.text}`}>{cfg.label}</span>
            <span className="text-xs text-muted-foreground ml-auto">{result.overall_score * 10}% quality</span>
          </div>
          <Progress value={result.overall_score * 10} className={`h-1.5 ${cfg.bar}`} />
        </div>
      </div>

      {/* SMART breakdown */}
      <div className="space-y-2">
        <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
          <TrendingUp className="w-3 h-3" /> SMART Criteria
        </p>
        {(Object.entries(result.smart_scores) as [string, number][]).map(([key, val]) => (
          <div key={key} className="flex items-center gap-3">
            <span className="text-xs text-muted-foreground w-20 shrink-0">{SMART_LABELS[key] ?? key}</span>
            <Progress value={val * 10} className={`flex-1 h-1.5 ${smartBarColor(val)}`} />
            <span className={`text-xs font-semibold w-6 text-right tabular-nums ${smartTextColor(val)}`}>{val}</span>
          </div>
        ))}
      </div>

      {/* Policy issues */}
      {result.brd_issues?.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[10px] font-semibold text-destructive uppercase tracking-widest flex items-center gap-1.5">
            <XCircle className="w-3 h-3" /> Policy Issues
          </p>
          {result.brd_issues.map((issue, i) => (
            <div key={i} className="flex items-start gap-2 p-2.5 rounded-lg bg-destructive/10 border border-destructive/20">
              <XCircle className="w-3.5 h-3.5 text-destructive mt-0.5 shrink-0" />
              <span className="text-xs text-destructive leading-snug">{issue}</span>
            </div>
          ))}
        </div>
      )}

      {/* Suggestions */}
      {result.suggestions.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest flex items-center gap-1.5">
            <AlertCircle className="w-3 h-3" /> Suggestions
          </p>
          {result.suggestions.map((s, i) => (
            <div key={i} className="flex items-start gap-2 p-2.5 rounded-lg bg-muted/50 border border-border">
              <AlertCircle className="w-3.5 h-3.5 text-muted-foreground mt-0.5 shrink-0" />
              <span className="text-xs text-muted-foreground leading-snug">{s}</span>
            </div>
          ))}
        </div>
      )}

      {/* Suggested title */}
      {showImproved && (
        <div className="p-3 rounded-lg bg-primary/5 border border-primary/10">
          <p className="text-[10px] font-semibold text-primary uppercase tracking-widest flex items-center gap-1.5 mb-2">
            <Lightbulb className="w-3 h-3" /> Suggested Title
          </p>
          <p className="text-xs text-foreground leading-snug">{result.improved_title}</p>
          {onApplyTitle && (
            <button
              type="button"
              onClick={() => onApplyTitle(result.improved_title)}
              className="mt-2 text-xs font-semibold text-primary flex items-center gap-1 hover:underline"
            >
              Apply <ArrowRight className="w-3 h-3" />
            </button>
          )}
        </div>
      )}

      {/* Golden standard match */}
      {result.semantic_match?.similarity > 0.5 && result.semantic_match?.title && (
        <div className="flex items-start gap-2 p-2.5 rounded-lg bg-muted/50 border border-border">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 mt-0.5 shrink-0" />
          <div className="min-w-0">
            <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider mb-0.5">
              Benchmark match — {Math.round(result.semantic_match.similarity * 100)}% similar
            </p>
            <p className="text-xs text-muted-foreground italic leading-snug">
              &ldquo;{result.semantic_match.title}&rdquo;
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
