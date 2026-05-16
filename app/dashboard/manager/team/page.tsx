"use client";
import { useGoals } from "@/hooks/useGoals";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { getInitials, getGoalStatusColor, formatScore } from "@/lib/utils";
import { getScoreColor, computeWeightedScore } from "@/lib/scoring";

export default function ManagerTeamPage() {
  const { data: goals, isLoading } = useGoals();
  const allGoals = goals || [];

  // Group by employee
  const byEmployee = allGoals.reduce((acc: Record<string, { name: string; dept: string; goals: Record<string, unknown>[] }>, g: Record<string, unknown>) => {
    const owner = g.owner as Record<string, unknown>;
    const id = owner?.id as string;
    if (!id) return acc;
    if (!acc[id]) acc[id] = { name: owner.name as string, dept: (owner.department as string) || "", goals: [] };
    acc[id].goals.push(g);
    return acc;
  }, {});

  if (isLoading) return <div className="space-y-4">{[1, 2, 3].map(i => <Skeleton key={i} className="h-32" />)}</div>;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Team Progress</h1>
      <div className="space-y-4">
        {Object.entries(byEmployee).map(([id, _emp]) => {
          const emp = _emp as { name: string; dept: string; goals: Record<string, unknown>[] };
          const scored = emp.goals.filter(g => g.latestScore !== null).map(g => ({ weightage: g.weightage as number, score: g.latestScore as number }));
          const ws = computeWeightedScore(scored);
          const totalW = emp.goals.reduce((s: number, g: Record<string, unknown>) => s + (g.weightage as number), 0);
          const locked = emp.goals.filter(g => g.status === "LOCKED").length;

          return (
            <Card key={id} className="hover:shadow-md transition-shadow">
              <CardContent className="p-5">
                <div className="flex items-center gap-4 mb-3">
                  <Avatar className="w-10 h-10"><AvatarFallback className="bg-blue-100 text-blue-700 text-sm">{getInitials(emp.name)}</AvatarFallback></Avatar>
                  <div className="flex-1">
                    <p className="font-semibold">{emp.name}</p>
                    <p className="text-xs text-slate-500">{emp.dept}</p>
                  </div>
                  <div className="text-right">
                    <p className={`text-lg font-bold ${ws > 0 ? getScoreColor(ws) : "text-slate-400"}`}>{ws > 0 ? `${ws.toFixed(1)}%` : "—"}</p>
                    <p className="text-xs text-slate-500">Weighted Score</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 text-xs text-slate-500 mb-2">
                  <span>{emp.goals.length} goals</span><span>•</span>
                  <span>{locked} locked</span><span>•</span>
                  <span>Weightage: {totalW}%</span>
                </div>
                <div className="flex gap-1 flex-wrap">
                  {emp.goals.map((g: Record<string, unknown>) => (
                    <Badge key={g.id as string} className={`text-[10px] ${getGoalStatusColor(g.status as string)}`} variant="outline">
                      {(g.title as string).slice(0, 20)}...
                    </Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
