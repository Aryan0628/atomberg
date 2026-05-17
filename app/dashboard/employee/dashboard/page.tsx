"use client";

import { useGoals } from "@/hooks/useGoals";
import { useCurrentCycle } from "@/hooks/useCycle";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Target, TrendingUp, CheckCircle2, Clock, AlertTriangle, ArrowRight, ChevronRight } from "lucide-react";
import Link from "next/link";
import { ActionCenter } from "@/components/shared/ActionCenter";
import { formatScore, getGoalStatusColor, getCountdown } from "@/lib/utils";
import { computeWeightedScore, forecastAnnualScore, getScoreColor, getScoreLabel } from "@/lib/scoring";
import { useEffect, useRef, useState } from "react";
import { useStaggerIn, useSlideIn } from "@/hooks/useGsap";
import gsap from "gsap";

// ─── Animated Stat Card ────────────────────────────────────────

function StatCard({
  title, value, subtitle, icon: Icon, accent, loading,
}: {
  title: string; value: string | number; subtitle: string;
  icon: React.ElementType; accent: string; loading: boolean;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const numRef  = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (loading || !cardRef.current) return;
    gsap.fromTo(cardRef.current,
      { opacity: 0, y: 16 },
      { opacity: 1, y: 0, duration: 0.45, ease: "power2.out" }
    );
    const parsed = parseFloat(String(value));
    if (numRef.current && !isNaN(parsed) && parsed > 0) {
      const isFloat = String(value).includes(".");
      const suffix  = String(value).includes("%") ? "%" : "";
      gsap.fromTo({ val: 0 }, { val: parsed }, {
        duration: 0.85, ease: "power2.out",
        onUpdate() {
          if (!numRef.current) return;
          const v = (this as { targets: () => { val: number }[] }).targets()[0].val;
          numRef.current.textContent = (isFloat ? v.toFixed(1) : Math.round(v)) + suffix;
        },
      });
    }
  }, [loading, value]);

  if (loading) {
    return <div className="rounded-xl border border-slate-200 dark:border-white/[0.06] bg-white dark:bg-white/[0.02] p-5"><Skeleton className="h-16" /></div>;
  }

  return (
    <div
      ref={cardRef}
      className="rounded-xl border border-slate-200 dark:border-white/[0.06] bg-white dark:bg-white/[0.02] p-5 hover:border-slate-300 dark:hover:border-white/[0.1] transition-colors opacity-0"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-1 min-w-0">
          <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest">{title}</p>
          <p className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight tabular-nums">
            {/^\d/.test(String(value)) ? (
              <><span ref={numRef}>{value}</span></>
            ) : (
              String(value)
            )}
          </p>
          <p className="text-xs text-slate-500">{subtitle}</p>
        </div>
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${accent}`}>
          <Icon className="w-4 h-4" />
        </div>
      </div>
    </div>
  );
}

// ─── Cycle Banner ──────────────────────────────────────────────

function CycleBanner({ cycle }: { cycle: Record<string, unknown> }) {
  const [cd, setCd] = useState(getCountdown(cycle.goalSettingClose as string));
  useEffect(() => {
    const t = setInterval(() => setCd(getCountdown(cycle.goalSettingClose as string)), 1000);
    return () => clearInterval(t);
  }, [cycle.goalSettingClose]);

  const urgency = cd.days <= 2 ? "text-red-400" : cd.days <= 7 ? "text-amber-400" : "text-emerald-400";

  return (
    <div className="flex items-center justify-between px-5 py-3.5 rounded-xl border border-slate-200 dark:border-white/[0.06] bg-white dark:bg-white/[0.02]">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-500/10 flex items-center justify-center">
          <Clock className="w-4 h-4 text-indigo-500" />
        </div>
        <div>
          <p className="text-sm font-semibold text-slate-800 dark:text-slate-200">{cycle.name as string}</p>
          <p className="text-xs text-slate-400">Goal setting window</p>
        </div>
      </div>
      <div className="text-right">
        {cd.isExpired ? (
          <span className="text-xs font-medium text-slate-400 bg-slate-100 dark:bg-white/[0.06] px-2.5 py-1 rounded-full">Window closed</span>
        ) : (
          <div className={`font-mono text-sm font-bold tracking-tight ${urgency}`}>
            {cd.days}d {String(cd.hours).padStart(2, "0")}h {String(cd.minutes).padStart(2, "0")}m{" "}
            <span className="opacity-60">{String(cd.seconds).padStart(2, "0")}s</span>
          </div>
        )}
        <p className="text-[10px] text-slate-400 mt-0.5">remaining</p>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────

export default function EmployeeDashboard() {
  const { data: goals, isLoading: goalsLoading } = useGoals();
  const { data: cycle } = useCurrentCycle();

  const lockedGoals = goals?.filter((g: Record<string, unknown>) => g.status === "LOCKED") || [];
  const draftGoals  = goals?.filter((g: Record<string, unknown>) => g.status === "DRAFT")  || [];
  const allGoals    = goals || [];

  const totalWeightage = allGoals.reduce((s: number, g: Record<string, unknown>) => s + ((g.weightage as number) || 0), 0);
  const goalsWithScores = lockedGoals
    .filter((g: Record<string, unknown>) => g.latestScore !== null)
    .map((g: Record<string, unknown>) => ({ weightage: g.weightage as number, score: g.latestScore as number }));

  const weightedScore = computeWeightedScore(goalsWithScores);
  const forecast      = forecastAnnualScore(goalsWithScores.map((g: { score: number }) => g.score));

  const listRef = useStaggerIn({ delay: 0.25, stagger: 0.06 });
  const alertRef = useSlideIn({ delay: 0.15 });

  return (
    <div className="space-y-5">
      {cycle && <CycleBanner cycle={cycle} />}

      <ActionCenter />

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Goals"          value={allGoals.length}                                                accent="bg-indigo-50 text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400" icon={Target}      subtitle={`${lockedGoals.length} locked`}                                                     loading={goalsLoading} />
        <StatCard title="Weighted Score" value={weightedScore > 0 ? `${weightedScore.toFixed(1)}%` : "—"}      accent="bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400" icon={TrendingUp}   subtitle={goalsWithScores.length > 0 ? getScoreLabel(weightedScore) : "No check-ins yet"} loading={goalsLoading} />
        <StatCard title="Weightage"      value={`${totalWeightage}%`}                                           accent={Math.abs(totalWeightage - 100) < 0.01 ? "bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400" : "bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-400"} icon={CheckCircle2} subtitle={Math.abs(totalWeightage - 100) < 0.01 ? "Complete" : `${(100 - totalWeightage).toFixed(0)}% remaining`} loading={goalsLoading} />
        <StatCard title="Annual Forecast" value={forecast > 0 ? `${forecast}%` : "—"}                          accent="bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400" icon={TrendingUp}   subtitle={forecast >= 80 ? "Above target" : forecast > 0 ? "On track" : "Pending check-ins"} loading={goalsLoading} />
      </div>

      {/* Draft alert */}
      {draftGoals.length > 0 && (
        <div
          ref={alertRef}
          className="opacity-0 flex items-center gap-3 px-4 py-3 rounded-xl border border-amber-200 dark:border-amber-800/40 bg-amber-50 dark:bg-amber-900/10"
        >
          <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-amber-800 dark:text-amber-300">
              {draftGoals.length} draft goal{draftGoals.length > 1 ? "s" : ""} not submitted
            </p>
            <p className="text-xs text-amber-600 dark:text-amber-500">
              Weightage: {totalWeightage}%{" "}
              {Math.abs(totalWeightage - 100) < 0.01 ? "— ready to submit" : `— need ${(100 - totalWeightage).toFixed(0)}% more`}
            </p>
          </div>
          <Link
            href="/dashboard/employee/goals"
            className="text-xs font-semibold text-amber-700 dark:text-amber-400 hover:text-amber-900 dark:hover:text-amber-300 flex items-center gap-1 shrink-0"
          >
            Review <ArrowRight className="w-3 h-3" />
          </Link>
        </div>
      )}

      {/* Goals list */}
      <div className="rounded-xl border border-slate-200 dark:border-white/[0.06] bg-white dark:bg-white/[0.02] overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 dark:border-white/[0.04]">
          <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-200">My Goals</h2>
          <Link
            href="/dashboard/employee/goals"
            className="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 flex items-center gap-0.5"
          >
            View all <ChevronRight className="w-3 h-3" />
          </Link>
        </div>

        {goalsLoading ? (
          <div className="p-5 space-y-3">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-14 rounded-lg" />)}
          </div>
        ) : allGoals.length === 0 ? (
          <div className="flex flex-col items-center py-14 text-center px-6">
            <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-white/[0.04] flex items-center justify-center mb-3">
              <Target className="w-5 h-5 text-slate-400" />
            </div>
            <p className="text-sm font-medium text-slate-600 dark:text-slate-400">No goals yet</p>
            <p className="text-xs text-slate-400 mt-1">Create your first goal to get started</p>
            <Link
              href="/dashboard/employee/goals"
              className="mt-4 text-xs font-semibold text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800/50 px-3 py-1.5 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-500/10 transition-colors"
            >
              Add goal
            </Link>
          </div>
        ) : (
          <div ref={listRef} className="divide-y divide-slate-100 dark:divide-white/[0.04]">
            {allGoals.slice(0, 6).map((goal: Record<string, unknown>) => (
              <Link
                key={goal.id as string}
                href={`/dashboard/employee/goals/${goal.id}`}
                className="flex items-center gap-4 px-5 py-3.5 hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors group"
              >
                <div className="w-1.5 h-1.5 rounded-full bg-indigo-400 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">
                    {goal.title as string}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5 text-xs text-slate-400">
                    <span>{goal.thrustArea as string}</span>
                    <span>·</span>
                    <span>{goal.weightage as number}% weight</span>
                    {goal.latestScore !== null && (
                      <>
                        <span>·</span>
                        <span className={getScoreColor(goal.latestScore as number)}>
                          {formatScore(goal.latestScore as number)}
                        </span>
                      </>
                    )}
                  </div>
                </div>
                <Badge
                  className={`text-[10px] shrink-0 ${getGoalStatusColor(goal.status as string)}`}
                  variant="outline"
                >
                  {(goal.status as string).replace("_", " ")}
                </Badge>
                <ChevronRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-indigo-400 transition-colors shrink-0" />
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
