"use client";

import { AlertTriangle, GitMerge, ExternalLink, X } from "lucide-react";
import type { RedundancyMatch } from "@/lib/ai-client";

interface Props {
  matches: RedundancyMatch[];
  onDismiss: () => void;
}

const LEVEL_STYLES = {
  near_duplicate: {
    border: "border-red-200 dark:border-red-800/60",
    bg: "bg-red-50 dark:bg-red-950/30",
    header: "bg-red-100 dark:bg-red-900/40",
    badge: "bg-red-200 text-red-800 dark:bg-red-900 dark:text-red-300",
    icon: "text-red-500",
    label: "Near Duplicate",
  },
  highly_similar: {
    border: "border-amber-200 dark:border-amber-800/60",
    bg: "bg-amber-50 dark:bg-amber-950/30",
    header: "bg-amber-100 dark:bg-amber-900/40",
    badge: "bg-amber-200 text-amber-800 dark:bg-amber-900 dark:text-amber-300",
    icon: "text-amber-500",
    label: "Highly Similar",
  },
};

export function RedundancyWarning({ matches, onDismiss }: Props) {
  if (!matches.length) return null;

  const hasNearDuplicate = matches.some((m) => m.match_level === "near_duplicate");

  return (
    <div className={`rounded-xl border overflow-hidden ${hasNearDuplicate ? "border-red-200 dark:border-red-800/60" : "border-amber-200 dark:border-amber-800/60"}`}>
      {/* Header */}
      <div className={`flex items-start justify-between p-3 ${hasNearDuplicate ? "bg-red-100 dark:bg-red-900/40" : "bg-amber-100 dark:bg-amber-900/40"}`}>
        <div className="flex items-center gap-2">
          <AlertTriangle className={`w-4 h-4 shrink-0 ${hasNearDuplicate ? "text-red-500" : "text-amber-500"}`} />
          <div>
            <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">
              {hasNearDuplicate ? "Potential Duplicate Goal Detected" : "Similar Goals Already Exist"}
            </p>
            <p className="text-xs text-slate-600 dark:text-slate-400 mt-0.5">
              {matches.length} existing goal{matches.length > 1 ? "s" : ""} in this cycle {matches.length > 1 ? "are" : "is"} semantically similar
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 p-0.5 rounded"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Matches */}
      <div className="divide-y divide-slate-100 dark:divide-slate-800">
        {matches.map((m) => {
          const style = LEVEL_STYLES[m.match_level];
          return (
            <div key={m.goal_id} className={`p-3 ${style.bg}`}>
              <div className="flex items-start justify-between gap-2 mb-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${style.badge}`}>
                      {style.label} — {Math.round(m.similarity * 100)}%
                    </span>
                    <span className="text-xs text-slate-500">{m.thrust_area}</span>
                  </div>
                  <p className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">
                    &ldquo;{m.goal_title}&rdquo;
                  </p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {m.owner_name} · {m.owner_department}
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <div className="text-right">
                    <div className="text-lg font-bold tabular-nums text-slate-700 dark:text-slate-300">
                      {Math.round(m.similarity * 100)}
                      <span className="text-xs font-normal text-slate-400">%</span>
                    </div>
                    <div className="text-[9px] text-slate-400 uppercase tracking-wide">match</div>
                  </div>
                </div>
              </div>

              {/* Recommendation */}
              <div className="flex items-start gap-2 p-2 rounded-lg bg-white/60 dark:bg-slate-900/40 border border-white/80 dark:border-slate-700/50">
                <GitMerge className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${style.icon}`} />
                <p className="text-xs text-slate-700 dark:text-slate-300 leading-snug">{m.recommendation}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Footer note */}
      <div className="px-3 py-2 bg-slate-50 dark:bg-slate-900/30 border-t border-slate-100 dark:border-slate-800 flex items-center gap-1.5">
        <ExternalLink className="w-3 h-3 text-slate-400 shrink-0" />
        <p className="text-[10px] text-slate-400">
          You can still submit this goal. Contact your manager to discuss converting to a Shared Departmental KPI.
        </p>
      </div>
    </div>
  );
}
