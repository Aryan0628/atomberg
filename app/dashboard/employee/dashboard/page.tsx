"use client";

import { useGoals } from "@/hooks/useGoals";
import { useCurrentCycle } from "@/hooks/useCycle";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Target, TrendingUp, CheckCircle2, Clock, AlertTriangle, ArrowRight, ChevronRight } from "lucide-react";
import Link from "next/link";
import { ActionCenter } from "@/components/shared/ActionCenter";
import { formatScore, getGoalStatusColor, getCountdown } from "@/lib/utils";
import { computeWeightedScore, forecastAnnualScore, getScoreLabel } from "@/lib/scoring";
import { useEffect, useState } from "react";

// ─── Stat Card ────────────────────────────────────────

function StatCard({
  title, value, subtitle, icon: Icon, loading, highlight = false
}: {
  title: string; value: string | number; subtitle: string;
  icon: React.ElementType; loading: boolean; highlight?: boolean;
}) {
  if (loading) {
    return <div className="rounded-xl border border-border bg-card p-6 shadow-sm"><Skeleton className="h-16" /></div>;
  }

  return (
    <div className="rounded-xl border border-border bg-card p-6 shadow-sm flex flex-col justify-between">
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs font-medium text-muted-foreground">{title}</p>
        <Icon className={`w-4 h-4 ${highlight ? "text-primary" : "text-muted-foreground"}`} />
      </div>
      <div>
        <p className="text-2xl font-semibold text-foreground tracking-tight tabular-nums">
          {value}
        </p>
        <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>
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

  const urgency = cd.days <= 2 ? "text-destructive" : cd.days <= 7 ? "text-amber-500 dark:text-amber-400" : "text-emerald-600 dark:text-emerald-400";

  return (
    <div className="flex items-center justify-between px-6 py-4 rounded-xl border border-border bg-card shadow-sm">
      <div className="flex items-center gap-4">
        <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center">
          <Clock className="w-5 h-5 text-muted-foreground" />
        </div>
        <div>
          <p className="text-sm font-semibold text-foreground">{cycle.name as string}</p>
          <p className="text-xs text-muted-foreground">Goal setting window</p>
        </div>
      </div>
      <div className="text-right">
        {cd.isExpired ? (
          <Badge variant="secondary" className="font-normal">Window closed</Badge>
        ) : (
          <div className={`font-mono text-sm font-medium tracking-tight ${urgency}`}>
            {cd.days}d {String(cd.hours).padStart(2, "0")}h {String(cd.minutes).padStart(2, "0")}m{" "}
            <span className="opacity-60">{String(cd.seconds).padStart(2, "0")}s</span>
          </div>
        )}
        <p className="text-[10px] text-muted-foreground mt-1 uppercase tracking-wider font-medium">Remaining</p>
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

  return (
    <div className="space-y-6">
      {cycle && <CycleBanner cycle={cycle} />}

      <ActionCenter />

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard title="Goals"          value={allGoals.length}                                                icon={Target}      subtitle={`${lockedGoals.length} locked`}                                                     loading={goalsLoading} highlight />
        <StatCard title="Weighted Score" value={weightedScore > 0 ? `${weightedScore.toFixed(1)}%` : "—"}       icon={TrendingUp}   subtitle={goalsWithScores.length > 0 ? getScoreLabel(weightedScore) : "No check-ins yet"} loading={goalsLoading} />
        <StatCard title="Weightage"      value={`${totalWeightage}%`}                                           icon={CheckCircle2} subtitle={Math.abs(totalWeightage - 100) < 0.01 ? "Complete" : `${(100 - totalWeightage).toFixed(0)}% remaining`} loading={goalsLoading} />
        <StatCard title="Annual Forecast" value={forecast > 0 ? `${forecast}%` : "—"}                           icon={TrendingUp}   subtitle={forecast >= 80 ? "Above target" : forecast > 0 ? "On track" : "Pending check-ins"} loading={goalsLoading} />
      </div>

      {/* Draft alert */}
      {draftGoals.length > 0 && (
        <div className="flex items-center gap-4 px-5 py-4 rounded-xl border border-amber-200 dark:border-amber-900/50 bg-amber-50 dark:bg-amber-900/10 shadow-sm">
          <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
              {draftGoals.length} draft goal{draftGoals.length > 1 ? "s" : ""} not submitted
            </p>
            <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
              Weightage: {totalWeightage}%{" "}
              {Math.abs(totalWeightage - 100) < 0.01 ? "— ready to submit" : `— need ${(100 - totalWeightage).toFixed(0)}% more`}
            </p>
          </div>
          <Link
            href="/dashboard/employee/goals"
            className="text-sm font-medium text-amber-700 dark:text-amber-300 hover:underline flex items-center gap-1 shrink-0"
          >
            Review <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      )}

      {/* Goals list */}
      <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="text-base font-semibold text-foreground">My Goals</h2>
          <Link
            href="/dashboard/employee/goals"
            className="text-sm font-medium text-primary hover:underline flex items-center gap-1"
          >
            View all <ChevronRight className="w-4 h-4" />
          </Link>
        </div>

        {goalsLoading ? (
          <div className="p-6 space-y-4">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 rounded-lg" />)}
          </div>
        ) : allGoals.length === 0 ? (
          <div className="flex flex-col items-center py-16 text-center px-6">
            <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-4">
              <Target className="w-6 h-6 text-muted-foreground" />
            </div>
            <p className="text-base font-medium text-foreground">No goals yet</p>
            <p className="text-sm text-muted-foreground mt-1">Create your first goal to get started</p>
            <Link
              href="/dashboard/employee/goals"
              className="mt-6 text-sm font-medium text-primary-foreground bg-primary px-4 py-2 rounded-md hover:bg-primary/90 transition-colors"
            >
              Add goal
            </Link>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {allGoals.slice(0, 6).map((goal: Record<string, unknown>) => (
              <Link
                key={goal.id as string}
                href={`/dashboard/employee/goals/${goal.id}`}
                className="flex items-center gap-4 px-6 py-4 hover:bg-muted/50 transition-colors group"
              >
                <div className="w-2 h-2 rounded-full bg-primary flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate group-hover:text-primary transition-colors">
                    {goal.title as string}
                  </p>
                  <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                    <span>{goal.thrustArea as string}</span>
                    <span>·</span>
                    <span>{goal.weightage as number}% weight</span>
                    {goal.latestScore !== null && (
                      <>
                        <span>·</span>
                        <span className="font-medium text-foreground">
                          {formatScore(goal.latestScore as number)} score
                        </span>
                      </>
                    )}
                  </div>
                </div>
                <Badge
                  className={`text-xs shrink-0 font-normal ${getGoalStatusColor(goal.status as string)}`}
                  variant="secondary"
                >
                  {(goal.status as string).replace("_", " ")}
                </Badge>
                <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors shrink-0" />
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
