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
import { getScoreColor, computeWeightedScore, computeGoalRisk } from "@/lib/scoring";
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
      <div className="space-y-6">
        {[1, 2, 3].map((i) => <Skeleton key={i} className="h-36 rounded-xl" />)}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Team Progress</h1>
          <p className="text-sm text-muted-foreground mt-1">
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

          // Aggregate all checkins across goals for team-level risk
          const allCheckins = emp.goals.flatMap((g: Record<string, unknown>) =>
            ((g.checkins ?? []) as { quarter: string; scorePercentage: number | null }[])
          );
          const teamRisk = computeGoalRisk(allCheckins);

          return (
            <Card key={id} className="hover:shadow-md transition-shadow border-border shadow-sm">
              <CardContent className="p-6">
                <div className="flex items-start gap-4">
                  <Avatar className="w-10 h-10 shrink-0">
                    <AvatarFallback className="bg-primary/10 text-primary text-sm font-semibold">
                      {getInitials(emp.name)}
                    </AvatarFallback>
                  </Avatar>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-4 flex-wrap mb-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-semibold text-foreground">{emp.name}</p>
                          {teamRisk.level !== "no_data" && (
                            <span className={`inline-flex items-center gap-1 text-xs font-semibold ${teamRisk.color}`} title={teamRisk.reason}>
                              <span className={`w-1.5 h-1.5 rounded-full ${teamRisk.dotColor}`} />
                              {teamRisk.label}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">{emp.dept}</p>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className={`text-xl font-bold ${ws > 0 ? getScoreColor(ws) : "text-muted-foreground"}`}>
                            {ws > 0 ? `${formatScore(ws)}%` : "—"}
                          </p>
                          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Weighted Score</p>
                        </div>
                        {/* AI Annual Review button */}
                        {cycle?.id && hasLockedGoals && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="gap-2 text-muted-foreground border-border hover:bg-muted/50 hover:text-foreground"
                            onClick={() => setReviewTarget({ employeeId: id, employeeName: emp.name })}
                          >
                            <ClipboardList className="w-4 h-4" />
                            Review
                          </Button>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center gap-3 text-xs text-muted-foreground mb-4 font-medium">
                      <span>{emp.goals.length} goals</span>
                      <span className="opacity-50">·</span>
                      <span>{locked} locked</span>
                      <span className="opacity-50">·</span>
                      <span>Weight: {totalW}%</span>
                      {ws > 0 && (
                        <>
                          <span className="opacity-50">·</span>
                          <Progress
                            value={ws}
                            className={`w-32 h-1.5 ${ws >= 80 ? "[&>div]:bg-emerald-500" : ws >= 60 ? "[&>div]:bg-amber-500" : "[&>div]:bg-destructive"}`}
                          />
                        </>
                      )}
                    </div>

                    <div className="flex gap-2 flex-wrap">
                      {emp.goals.map((g: Record<string, unknown>) => (
                        <Badge
                          key={g.id as string}
                          className={`text-[10px] font-normal ${getGoalStatusColor(g.status as string)}`}
                          variant="secondary"
                        >
                          {(g.title as string).length > 25
                            ? `${(g.title as string).slice(0, 25)}…`
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
          <Card className="border-border shadow-sm">
            <CardContent className="flex flex-col items-center py-16 text-center">
              <ClipboardList className="w-12 h-12 text-muted-foreground opacity-50 mb-4" />
              <p className="text-lg font-semibold text-foreground">No team members found</p>
              <p className="text-sm text-muted-foreground mt-1">Goals from your direct reports will appear here.</p>
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
