"use client";

import { useState } from "react";
import { useGoals } from "@/hooks/useGoals";
import { useCurrentCycle } from "@/hooks/useCycle";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { AnnualReviewModal } from "@/components/goals/AnnualReviewModal";
import { getInitials, getGoalStatusColor, formatScore } from "@/lib/utils";
import { getScoreColor, computeWeightedScore } from "@/lib/scoring";
import { ClipboardList } from "lucide-react";

interface ReviewTarget {
  employeeId: string;
  employeeName: string;
}

export default function ManagerTeamPage() {
  const { data: goals, isLoading } = useGoals();
  const { data: cycle } = useCurrentCycle();
  const [reviewTarget, setReviewTarget] = useState<ReviewTarget | null>(null);

  const allGoals = goals || [];

  // Group by employee
  const byEmployee = allGoals.reduce(
    (acc: Record<string, { name: string; dept: string; goals: Record<string, unknown>[] }>, g: Record<string, unknown>) => {
      const owner = g.owner as Record<string, unknown>;
      const id = owner?.id as string;
      if (!id) return acc;
      if (!acc[id]) acc[id] = { name: owner.name as string, dept: (owner.department as string) || "", goals: [] };
      acc[id].goals.push(g);
      return acc;
    },
    {}
  );

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => <Skeleton key={i} className="h-36" />)}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Team Progress</h1>
          <p className="text-sm text-slate-500 mt-1">
            {Object.keys(byEmployee).length} direct report{Object.keys(byEmployee).length !== 1 ? "s" : ""} · {cycle?.name ?? "No active cycle"}
          </p>
        </div>
      </div>

      <div className="space-y-4">
        {Object.entries(byEmployee).map(([id, _emp]) => {
          const emp = _emp as { name: string; dept: string; goals: Record<string, unknown>[] };
          const scored = emp.goals
            .filter((g) => g.latestScore !== null)
            .map((g) => ({ weightage: g.weightage as number, score: g.latestScore as number }));
          const ws = computeWeightedScore(scored);
          const totalW = emp.goals.reduce((s: number, g: Record<string, unknown>) => s + (g.weightage as number), 0);
          const locked = emp.goals.filter((g) => g.status === "LOCKED").length;
          const hasLockedGoals = locked > 0;

          return (
            <Card key={id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-5">
                <div className="flex items-start gap-4">
                  <Avatar className="w-10 h-10 shrink-0">
                    <AvatarFallback className="bg-blue-100 text-blue-700 text-sm">
                      {getInitials(emp.name)}
                    </AvatarFallback>
                  </Avatar>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-3 flex-wrap mb-1">
                      <div>
                        <p className="font-semibold">{emp.name}</p>
                        <p className="text-xs text-slate-500">{emp.dept}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <p className={`text-lg font-bold ${ws > 0 ? getScoreColor(ws) : "text-slate-400"}`}>
                            {ws > 0 ? `${formatScore(ws)}%` : "—"}
                          </p>
                          <p className="text-xs text-slate-500">Weighted Score</p>
                        </div>
                        {/* AI Annual Review button — only shown when employee has locked/approved goals */}
                        {cycle?.id && hasLockedGoals && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-1.5 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-white/[0.1] hover:bg-slate-50 dark:hover:bg-white/[0.04] hover:text-slate-800 dark:hover:text-slate-200"
                            onClick={() => setReviewTarget({ employeeId: id, employeeName: emp.name })}
                          >
                            <ClipboardList className="w-3.5 h-3.5" />
                            Review
                          </Button>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-3 text-xs text-slate-500 mb-3">
                      <span>{emp.goals.length} goals</span>
                      <span>·</span>
                      <span>{locked} locked</span>
                      <span>·</span>
                      <span>Weightage: {totalW}%</span>
                      {ws > 0 && (
                        <>
                          <span>·</span>
                          <Progress
                            value={ws}
                            className={`w-24 h-1.5 ${ws >= 80 ? "[&>div]:bg-green-500" : ws >= 60 ? "[&>div]:bg-amber-500" : "[&>div]:bg-red-500"}`}
                          />
                        </>
                      )}
                    </div>

                    <div className="flex gap-1 flex-wrap">
                      {emp.goals.map((g: Record<string, unknown>) => (
                        <Badge
                          key={g.id as string}
                          className={`text-[10px] ${getGoalStatusColor(g.status as string)}`}
                          variant="outline"
                        >
                          {(g.title as string).length > 22
                            ? `${(g.title as string).slice(0, 22)}…`
                            : (g.title as string)}
                        </Badge>
                      ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}

        {Object.keys(byEmployee).length === 0 && (
          <Card>
            <CardContent className="flex flex-col items-center py-12 text-center">
              <p className="text-lg font-medium text-slate-600 dark:text-slate-400">No team members found</p>
              <p className="text-sm text-slate-400 mt-1">Goals from your direct reports will appear here.</p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Annual Review Modal */}
      {reviewTarget && cycle?.id && (
        <AnnualReviewModal
          open={!!reviewTarget}
          onOpenChange={(o) => { if (!o) setReviewTarget(null); }}
          employeeId={reviewTarget.employeeId}
          employeeName={reviewTarget.employeeName}
          cycleId={cycle.id}
          cycleName={cycle.name}
        />
      )}
    </div>
  );
}
