// Employee Goal History — past cycles goals and scores
"use client";

import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { History, Trophy } from "lucide-react";
import { getGoalStatusColor, getUoMLabel, formatScore, formatDate } from "@/lib/utils";
import { getScoreColor } from "@/lib/scoring";

function useGoalHistory() {
  return useQuery({
    queryKey: ["goal-history"],
    queryFn: async () => {
      const res = await fetch("/api/goals?status=LOCKED&includeInactive=true");
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    staleTime: 60_000,
  });
}

export default function EmployeeHistoryPage() {
  const { data: goals, isLoading } = useGoalHistory();

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48" />
        {[1, 2, 3].map((i) => <Skeleton key={i} className="h-32" />)}
      </div>
    );
  }

  const locked = goals?.filter((g: Record<string, unknown>) => g.isLocked) || [];

  // Group by cycle
  const byCycle: Record<string, { cycleName: string; goals: Record<string, unknown>[] }> = {};
  for (const goal of locked) {
    const cycleId = (goal.cycle as Record<string, unknown>)?.id as string;
    const cycleName = (goal.cycle as Record<string, unknown>)?.name as string || "Unknown Cycle";
    if (!byCycle[cycleId]) byCycle[cycleId] = { cycleName, goals: [] };
    byCycle[cycleId].goals.push(goal);
  }

  if (locked.length === 0) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold">Goal History</h1>
        <Card>
          <CardContent className="flex flex-col items-center py-12">
            <History className="w-12 h-12 text-blue-400 mb-4" />
            <p className="text-lg font-medium">No historical goals yet</p>
            <p className="text-sm text-slate-400">Past cycle goals will appear here once cycles complete</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Goal History</h1>
        <p className="text-sm text-slate-500 mt-1">Your achievements across all cycles</p>
      </div>

      {Object.entries(byCycle).map(([cycleId, { cycleName, goals: cycleGoals }]) => {
        const scoredGoals = cycleGoals.filter((g) => g.latestScore !== null);
        const avgScore = scoredGoals.length > 0
          ? scoredGoals.reduce((sum, g) => sum + (g.latestScore as number), 0) / scoredGoals.length
          : null;

        return (
          <div key={cycleId} className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                <Trophy className="w-5 h-5 text-amber-500" /> {cycleName}
              </h2>
              {avgScore !== null && (
                <div className="text-right">
                  <p className="text-xs text-slate-400">Avg Score</p>
                  <p className={`text-lg font-bold ${getScoreColor(avgScore)}`}>{formatScore(avgScore)}</p>
                </div>
              )}
            </div>

            <div className="space-y-3">
              {cycleGoals.map((goal) => {
                const checkins = (goal.checkins as Record<string, unknown>[]) || [];
                return (
                  <Card key={goal.id as string}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="space-y-2 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <Badge className={getGoalStatusColor(goal.status as string)}>{goal.status as string}</Badge>
                            <Badge variant="outline">{getUoMLabel(goal.uomType as string)}</Badge>
                            <span className="text-xs text-slate-400">{goal.thrustArea as string}</span>
                          </div>
                          <p className="font-medium">{goal.title as string}</p>
                          <div className="flex items-center gap-4 text-sm">
                            <span className="text-slate-400">Weightage: <strong>{goal.weightage as number}%</strong></span>
                            {goal.target !== null && (
                              <span className="text-slate-400">Target: <strong>{Number(goal.target)} {String(goal.uomUnit ?? "")}</strong></span>
                            )}
                            {!!goal.approvedAt && (
                              <span className="text-slate-400">Approved: {formatDate(String(goal.approvedAt))}</span>
                            )}
                          </div>

                          {/* Quarter scores */}
                          {checkins.length > 0 && (
                            <div className="flex gap-2 flex-wrap mt-1">
                              {checkins.map((c) => (
                                <div key={c.id as string} className="flex items-center gap-1.5 text-xs bg-slate-50 dark:bg-slate-900 rounded px-2 py-1 border">
                                  <span className="text-slate-500 font-medium">{c.quarter as string}:</span>
                                  {c.scorePercentage !== null ? (
                                    <span className={`font-bold ${getScoreColor(c.scorePercentage as number)}`}>
                                      {(c.scorePercentage as number).toFixed(1)}%
                                    </span>
                                  ) : (
                                    <span className="text-slate-400">—</span>
                                  )}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        {goal.latestScore !== null && (
                          <div className="text-right flex-shrink-0">
                            <p className="text-xs text-slate-400 mb-0.5">Final Score</p>
                            <p className={`text-xl font-bold ${getScoreColor(goal.latestScore as number)}`}>
                              {formatScore(goal.latestScore as number)}
                            </p>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
