// Employee Dashboard — scorecard, alerts, upcoming deadlines
"use client";

import { useGoals } from "@/hooks/useGoals";
import { useCurrentCycle } from "@/hooks/useCycle";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Target, TrendingUp, CheckCircle2, Clock, AlertTriangle, ArrowRight } from "lucide-react";
import Link from "next/link";
import { ActionCenter } from "@/components/shared/ActionCenter";
import { formatScore, getGoalStatusColor, getCountdown } from "@/lib/utils";
import { computeWeightedScore, forecastAnnualScore, getScoreColor, getScoreLabel } from "@/lib/scoring";
import { useEffect, useState } from "react";

export default function EmployeeDashboard() {
  const { data: goals, isLoading: goalsLoading } = useGoals();
  const { data: cycle, isLoading: cycleLoading } = useCurrentCycle();

  const lockedGoals = goals?.filter((g: Record<string, unknown>) => g.status === "LOCKED") || [];
  const draftGoals = goals?.filter((g: Record<string, unknown>) => g.status === "DRAFT") || [];
  const allGoals = goals || [];

  const totalWeightage = allGoals.reduce((sum: number, g: Record<string, unknown>) => sum + (g.weightage as number || 0), 0);
  const goalsWithScores = lockedGoals
    .filter((g: Record<string, unknown>) => g.latestScore !== null)
    .map((g: Record<string, unknown>) => ({ weightage: g.weightage as number, score: g.latestScore as number }));

  const weightedScore = computeWeightedScore(goalsWithScores);
  const forecast = forecastAnnualScore(goalsWithScores.map((g: { score: number }) => g.score));

  return (
    <div className="space-y-6">
      {/* Cycle Banner */}
      {cycle && <CycleBanner cycle={cycle} />}

      {/* Proactive Action Center */}
      <ActionCenter />

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Goals"
          value={allGoals.length}
          subtitle={`${lockedGoals.length} locked`}
          icon={Target}
          color="blue"
          loading={goalsLoading}
        />
        <StatCard
          title="Weighted Score"
          value={weightedScore > 0 ? `${weightedScore.toFixed(1)}%` : "—"}
          subtitle={goalsWithScores.length > 0 ? getScoreLabel(weightedScore) : "No check-ins yet"}
          icon={TrendingUp}
          color="green"
          loading={goalsLoading}
        />
        <StatCard
          title="Weightage"
          value={`${totalWeightage}%`}
          subtitle={Math.abs(totalWeightage - 100) < 0.01 ? "✓ Complete" : `${100 - totalWeightage}% remaining`}
          icon={CheckCircle2}
          color={Math.abs(totalWeightage - 100) < 0.01 ? "emerald" : "amber"}
          loading={goalsLoading}
        />
        <StatCard
          title="Forecast"
          value={forecast > 0 ? `${forecast}%` : "—"}
          subtitle={forecast >= 80 ? "↑ Above target" : forecast > 0 ? "→ On track" : "Pending check-ins"}
          icon={TrendingUp}
          color="purple"
          loading={goalsLoading}
        />
      </div>

      {/* Action Required */}
      {draftGoals.length > 0 && (
        <Card className="border-amber-200 bg-amber-50/50 dark:border-amber-800 dark:bg-amber-950/20">
          <CardContent className="flex items-center gap-4 p-4">
            <AlertTriangle className="w-5 h-5 text-amber-600 flex-shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
                You have {draftGoals.length} draft goal{draftGoals.length > 1 ? "s" : ""}
              </p>
              <p className="text-xs text-amber-600 dark:text-amber-400">
                Total weightage: {totalWeightage}% — {Math.abs(totalWeightage - 100) < 0.01 ? "ready to submit!" : `need ${100 - totalWeightage}% more`}
              </p>
            </div>
            <Link href="/dashboard/employee/goals">
              <Badge className="bg-amber-600 hover:bg-amber-700 text-white cursor-pointer">
                Review Goals <ArrowRight className="w-3 h-3 ml-1" />
              </Badge>
            </Link>
          </CardContent>
        </Card>
      )}

      {/* Goals List */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-lg">My Goals</CardTitle>
          <Link href="/dashboard/employee/goals">
            <Badge variant="outline" className="cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800">
              View All <ArrowRight className="w-3 h-3 ml-1" />
            </Badge>
          </Link>
        </CardHeader>
        <CardContent>
          {goalsLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full" />)}
            </div>
          ) : allGoals.length === 0 ? (
            <div className="text-center py-8 text-slate-400">
              <Target className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p className="font-medium">No goals yet</p>
              <p className="text-sm">Create your first goal to get started</p>
            </div>
          ) : (
            <div className="space-y-3">
              {allGoals.slice(0, 5).map((goal: Record<string, unknown>) => (
                <Link
                  key={goal.id as string}
                  href={`/dashboard/employee/goals/${goal.id}`}
                  className="flex items-center gap-4 p-3 rounded-lg border border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors group"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-medium text-sm text-slate-900 dark:text-white truncate group-hover:text-blue-600 dark:group-hover:text-blue-400">
                        {goal.title as string}
                      </p>
                      <Badge className={getGoalStatusColor(goal.status as string)} variant="outline">
                        {(goal.status as string).replace("_", " ")}
                      </Badge>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-slate-500">
                      <span>{goal.thrustArea as string}</span>
                      <span>•</span>
                      <span>{goal.weightage as number}% weight</span>
                      {goal.latestScore !== null && (
                        <>
                          <span>•</span>
                          <span className={getScoreColor(goal.latestScore as number)}>
                            {formatScore(goal.latestScore as number)}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-blue-500" />
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Cycle Banner ─────────────────────────────────────────────

function CycleBanner({ cycle }: { cycle: Record<string, unknown> }) {
  const [countdown, setCountdown] = useState(getCountdown(cycle.goalSettingClose as string));

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown(getCountdown(cycle.goalSettingClose as string));
    }, 1000);
    return () => clearInterval(timer);
  }, [cycle.goalSettingClose]);

  const urgencyColor = countdown.days > 7
    ? "text-green-600"
    : countdown.days > 2
    ? "text-amber-600"
    : "text-red-600";

  return (
    <Card className="bg-gradient-to-r from-blue-600 to-indigo-600 border-0 text-white">
      <CardContent className="flex items-center justify-between p-4">
        <div className="flex items-center gap-3">
          <Clock className="w-5 h-5 opacity-80" />
          <div>
            <p className="font-semibold">{cycle.name as string}</p>
            <p className="text-sm text-blue-100">Goal Setting Window</p>
          </div>
        </div>
        <div className="text-right">
          {countdown.isExpired ? (
            <Badge className="bg-white/20 text-white border-0">Window Closed</Badge>
          ) : (
            <div className="flex items-center gap-1 font-mono text-lg">
              <span className={urgencyColor.replace("text-", "bg-").replace("600", "100") + " px-2 py-1 rounded text-slate-900 font-bold text-sm"}>
                {countdown.days}d
              </span>
              <span className="text-blue-200">:</span>
              <span className="bg-white/10 px-2 py-1 rounded text-sm">
                {String(countdown.hours).padStart(2, "0")}h
              </span>
              <span className="text-blue-200">:</span>
              <span className="bg-white/10 px-2 py-1 rounded text-sm">
                {String(countdown.minutes).padStart(2, "0")}m
              </span>
              <span className="text-blue-200">:</span>
              <span className="bg-white/10 px-2 py-1 rounded text-sm">
                {String(countdown.seconds).padStart(2, "0")}s
              </span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Stat Card ─────────────────────────────────────────────────

function StatCard({
  title, value, subtitle, icon: Icon, color, loading,
}: {
  title: string; value: string | number; subtitle: string;
  icon: React.ElementType; color: string; loading: boolean;
}) {
  const colorMap: Record<string, string> = {
    blue: "bg-blue-50 text-blue-600 dark:bg-blue-950/50 dark:text-blue-400",
    green: "bg-green-50 text-green-600 dark:bg-green-950/50 dark:text-green-400",
    emerald: "bg-emerald-50 text-emerald-600 dark:bg-emerald-950/50 dark:text-emerald-400",
    amber: "bg-amber-50 text-amber-600 dark:bg-amber-950/50 dark:text-amber-400",
    purple: "bg-purple-50 text-purple-600 dark:bg-purple-950/50 dark:text-purple-400",
  };

  if (loading) return <Card><CardContent className="p-4"><Skeleton className="h-20" /></CardContent></Card>;

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">{title}</p>
            <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">{value}</p>
            <p className="text-xs text-slate-500 mt-1">{subtitle}</p>
          </div>
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${colorMap[color] || colorMap.blue}`}>
            <Icon className="w-5 h-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
