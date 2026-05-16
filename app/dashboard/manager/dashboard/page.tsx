// Manager Dashboard — with Goal Wellness Score badges per employee
"use client";

import { useGoals } from "@/hooks/useGoals";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Users, UserCheck, ClipboardCheck, AlertTriangle, ArrowRight } from "lucide-react";
import Link from "next/link";
import { getGoalStatusColor } from "@/lib/utils";
import { ActionCenter } from "@/components/shared/ActionCenter";
import { computeGoalWellness, computeWeightedScore } from "@/lib/scoring";

const GRADE_COLORS: Record<string, string> = {
  A: "bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300",
  B: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  C: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  D: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
};

export default function ManagerDashboard() {
  const { data: goals, isLoading } = useGoals();
  const allGoals = goals || [];

  const pendingApprovals = allGoals.filter((g: Record<string, unknown>) => g.status === "SUBMITTED");
  const approvedGoals = allGoals.filter((g: Record<string, unknown>) => g.status === "APPROVED" || g.status === "LOCKED");
  const totalReports = [...new Set(allGoals.map((g: Record<string, unknown>) => (g.owner as Record<string, unknown>)?.id))].length;

  // Compute per-employee Goal Wellness Score
  const byEmployee: Record<string, { name: string; goals: Record<string, unknown>[] }> = {};
  for (const g of allGoals) {
    const owner = g.owner as Record<string, unknown>;
    const id = owner?.id as string;
    if (!id) continue;
    if (!byEmployee[id]) byEmployee[id] = { name: owner.name as string, goals: [] };
    byEmployee[id].goals.push(g);
  }

  const employeeWellness = Object.entries(byEmployee).map(([id, emp]) => {
    const empGoals = emp.goals as Record<string, unknown>[];
    const totalWeightage = empGoals.reduce((s, g) => s + (g.weightage as number || 0), 0);
    const checkins = empGoals.flatMap((g) => (g.checkins as Record<string, unknown>[]) || []);
    const checkinRate = checkins.length > 0
      ? checkins.filter((c) => c.submittedAt).length / checkins.length
      : 0;
    const scored = empGoals.filter(g => g.latestScore !== null && g.latestScore !== undefined);
    const avgScore = scored.length > 0
      ? scored.reduce((s, g) => s + (g.latestScore as number), 0) / scored.length
      : 0;
    const reworkCount = empGoals.reduce((s, g) => s + (g.reworkCount as number || 0), 0);

    const wellness = computeGoalWellness({
      goalsCount: empGoals.length,
      weightageTotal: totalWeightage,
      checkinCompletionRate: checkinRate,
      avgScore,
      reworkCount,
    });

    const ws = computeWeightedScore(
      scored.map(g => ({ weightage: g.weightage as number, score: g.latestScore as number }))
    );

    return { id, name: emp.name, ...wellness, goalsCount: empGoals.length, ws };
  });

  return (
    <div className="space-y-6">
      <ActionCenter />

      {/* Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Pending Approvals", value: pendingApprovals.length, sub: "Goals awaiting review", bg: "bg-amber-50 dark:bg-amber-950/50", icon: <UserCheck className="w-5 h-5 text-amber-600" /> },
          { label: "Team Members", value: totalReports, sub: "Direct reports", bg: "bg-blue-50 dark:bg-blue-950/50", icon: <Users className="w-5 h-5 text-blue-600" /> },
          { label: "Approved Goals", value: approvedGoals.length, sub: "Active goals", bg: "bg-green-50 dark:bg-green-950/50", icon: <ClipboardCheck className="w-5 h-5 text-green-600" /> },
          { label: "Total Goals", value: allGoals.length, sub: "Across all reports", bg: "bg-purple-50 dark:bg-purple-950/50", icon: <AlertTriangle className="w-5 h-5 text-purple-600" /> },
        ].map((s) => (
          <Card key={s.label} className="hover:shadow-md transition-shadow">
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">{s.label}</p>
                  <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1">{s.value}</p>
                  <p className="text-xs text-slate-500 mt-1">{s.sub}</p>
                </div>
                <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${s.bg}`}>{s.icon}</div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Goal Wellness Scores — per employee */}
      {employeeWellness.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              Goal Wellness Scores
              <span className="text-xs font-normal text-slate-400">(A = excellent, D = needs attention)</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <TooltipProvider>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                {employeeWellness.map((emp) => (
                  <Tooltip key={emp.id}>
                    <TooltipTrigger className="w-full text-left block rounded-lg border border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900 cursor-default focus:outline-none">
                      <div className="flex items-center gap-3 p-3">
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold flex-shrink-0 ${GRADE_COLORS[emp.grade]}`}>
                          {emp.grade}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium truncate">{emp.name}</p>
                          <p className="text-xs text-slate-400">{emp.goalsCount} goals{emp.ws > 0 ? ` · ${emp.ws.toFixed(0)}%` : ""}</p>
                        </div>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="max-w-[200px]">
                      <p className="font-semibold mb-1">Wellness: {emp.score}/100 ({emp.grade})</p>
                      {emp.issues.length > 0 ? (
                        <ul className="text-xs space-y-0.5">
                          {emp.issues.map((issue) => <li key={issue}>• {issue}</li>)}
                        </ul>
                      ) : (
                        <p className="text-xs text-green-400">All checks passed ✓</p>
                      )}
                    </TooltipContent>
                  </Tooltip>
                ))}
              </div>
            </TooltipProvider>
          </CardContent>
        </Card>
      )}

      {/* Pending Approvals */}
      {pendingApprovals.length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg">Pending Approvals</CardTitle>
            <Link href="/dashboard/manager/approvals">
              <Badge variant="outline" className="cursor-pointer hover:bg-slate-100 dark:hover:bg-slate-800">
                Review All <ArrowRight className="w-3 h-3 ml-1" />
              </Badge>
            </Link>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {pendingApprovals.map((goal: Record<string, unknown>) => (
                <div key={goal.id as string} className="flex items-center gap-4 p-3 rounded-lg border border-slate-200 dark:border-slate-800">
                  <div className="flex-1">
                    <p className="font-medium text-sm">{goal.title as string}</p>
                    <p className="text-xs text-slate-500">
                      {((goal.owner as Record<string, unknown>)?.name as string) || "Unknown"} · {goal.thrustArea as string} · {goal.weightage as number}% weight
                    </p>
                  </div>
                  <Badge className={getGoalStatusColor(goal.status as string)}>{goal.status as string}</Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Team Goals Overview */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Team Goals Overview</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-12" />)}</div>
          ) : (
            <div className="space-y-2">
              {allGoals.slice(0, 10).map((goal: Record<string, unknown>) => (
                <div key={goal.id as string} className="flex items-center gap-3 p-2 rounded hover:bg-slate-50 dark:hover:bg-slate-900">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{goal.title as string}</p>
                    <p className="text-xs text-slate-500">
                      {((goal.owner as Record<string, unknown>)?.name as string) || "Unknown"}
                    </p>
                  </div>
                  <Badge className={getGoalStatusColor(goal.status as string)} variant="outline">
                    {(goal.status as string).replace("_", " ")}
                  </Badge>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
