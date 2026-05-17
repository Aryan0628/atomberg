"use client";

import { useGoals } from "@/hooks/useGoals";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Users, UserCheck, ClipboardCheck, Target, ChevronRight } from "lucide-react";
import Link from "next/link";
import { getGoalStatusColor } from "@/lib/utils";
import { ActionCenter } from "@/components/shared/ActionCenter";
import { computeGoalWellness, computeWeightedScore } from "@/lib/scoring";

const GRADE_PILL: Record<string, string> = {
  A: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20",
  B: "bg-blue-500/10   text-blue-600   dark:text-blue-400   border border-blue-500/20",
  C: "bg-amber-500/10  text-amber-600  dark:text-amber-400  border border-amber-500/20",
  D: "bg-red-500/10    text-red-600    dark:text-red-400    border border-red-500/20",
};

function StatCard({
  label, value, sub, icon: Icon, highlight = false,
}: {
  label: string; value: number | string; sub: string;
  icon: React.ElementType; highlight?: boolean;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-6 shadow-sm flex flex-col justify-between">
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <Icon className={`w-4 h-4 ${highlight ? "text-primary" : "text-muted-foreground"}`} />
      </div>
      <div>
        <p className="text-2xl font-semibold text-foreground tracking-tight tabular-nums">
          {value}
        </p>
        <p className="text-xs text-muted-foreground mt-1">{sub}</p>
      </div>
    </div>
  );
}

export default function ManagerDashboard() {
  const { data: goals, isLoading } = useGoals();
  const allGoals = goals || [];

  const pendingApprovals = allGoals.filter((g: Record<string, unknown>) => g.status === "SUBMITTED");
  const approvedGoals    = allGoals.filter((g: Record<string, unknown>) => g.status === "APPROVED" || g.status === "LOCKED");
  const totalReports     = [...new Set(allGoals.map((g: Record<string, unknown>) => (g.owner as Record<string, unknown>)?.id))].length;

  const byEmployee: Record<string, { name: string; goals: Record<string, unknown>[] }> = {};
  for (const g of allGoals) {
    const owner = g.owner as Record<string, unknown>;
    const id    = owner?.id as string;
    if (!id) continue;
    if (!byEmployee[id]) byEmployee[id] = { name: owner.name as string, goals: [] };
    byEmployee[id].goals.push(g);
  }

  const employeeWellness = Object.entries(byEmployee).map(([id, emp]) => {
    const empGoals     = emp.goals;
    const totalW       = empGoals.reduce((s, g) => s + ((g.weightage as number) || 0), 0);
    const checkins     = empGoals.flatMap((g) => (g.checkins as Record<string, unknown>[]) || []);
    const checkinRate  = checkins.length > 0 ? checkins.filter((c) => c.submittedAt).length / checkins.length : 0;
    const scored       = empGoals.filter((g) => g.latestScore !== null && g.latestScore !== undefined);
    const avgScore     = scored.length > 0 ? scored.reduce((s, g) => s + (g.latestScore as number), 0) / scored.length : 0;
    const reworkCount  = empGoals.reduce((s, g) => s + ((g.reworkCount as number) || 0), 0);
    const wellness     = computeGoalWellness({ goalsCount: empGoals.length, weightageTotal: totalW, checkinCompletionRate: checkinRate, avgScore, reworkCount });
    const ws           = computeWeightedScore(scored.map((g) => ({ weightage: g.weightage as number, score: g.latestScore as number })));
    return { id, name: emp.name, ...wellness, goalsCount: empGoals.length, ws };
  });

  return (
    <div className="space-y-6">
      <ActionCenter />

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard label="Pending Approvals" value={pendingApprovals.length} sub="Goals awaiting review"    icon={UserCheck} highlight={pendingApprovals.length > 0} />
        <StatCard label="Team Members"      value={totalReports}            sub="Direct reports"           icon={Users} />
        <StatCard label="Approved Goals"    value={approvedGoals.length}    sub="Active goals"             icon={ClipboardCheck} />
        <StatCard label="Total Goals"       value={allGoals.length}         sub="Across all reports"       icon={Target} />
      </div>

      {/* Team Wellness */}
      {employeeWellness.length > 0 && (
        <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
          <div className="px-6 py-4 border-b border-border">
            <h2 className="text-base font-semibold text-foreground">Team Wellness</h2>
            <p className="text-sm text-muted-foreground mt-1">Based on goal completeness, weightage, and check-in rates</p>
          </div>
          <TooltipProvider>
            <div className="p-6 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {employeeWellness.map((emp) => (
                <Tooltip key={emp.id}>
                  <TooltipTrigger className="w-full text-left rounded-lg border border-border hover:bg-muted/50 transition-colors focus:outline-none p-4 shadow-sm">
                    <div className="flex items-center gap-4">
                      <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-semibold flex-shrink-0 ${GRADE_PILL[emp.grade] ?? GRADE_PILL.D}`}>
                        {emp.grade}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-foreground truncate">{emp.name}</p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {emp.goalsCount} goal{emp.goalsCount !== 1 ? "s" : ""}
                          {emp.ws > 0 ? ` · ${emp.ws.toFixed(0)}%` : ""}
                        </p>
                      </div>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="max-w-[200px]">
                    <p className="font-semibold mb-2 text-sm">Wellness {emp.score}/100 — Grade {emp.grade}</p>
                    {emp.issues.length > 0 ? (
                      <ul className="text-xs space-y-1 text-muted-foreground">
                        {emp.issues.map((issue) => <li key={issue}>· {issue}</li>)}
                      </ul>
                    ) : (
                      <p className="text-xs text-emerald-500">All checks passed ✓</p>
                    )}
                  </TooltipContent>
                </Tooltip>
              ))}
            </div>
          </TooltipProvider>
        </div>
      )}

      {/* Pending Approvals */}
      {pendingApprovals.length > 0 && (
        <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-border">
            <div>
              <h2 className="text-base font-semibold text-foreground">Pending Approvals</h2>
            </div>
            <Link
              href="/dashboard/manager/approvals"
              className="text-sm font-medium text-primary hover:underline flex items-center gap-1"
            >
              Review all <ChevronRight className="w-4 h-4" />
            </Link>
          </div>
          <div className="divide-y divide-border">
            {pendingApprovals.map((goal: Record<string, unknown>) => (
              <div key={goal.id as string} className="flex items-center gap-4 px-6 py-4">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{goal.title as string}</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {((goal.owner as Record<string, unknown>)?.name as string) ?? "Unknown"}
                    {" · "}{goal.thrustArea as string}
                    {" · "}{goal.weightage as number}% weight
                  </p>
                </div>
                <Badge className={`text-xs shrink-0 font-normal ${getGoalStatusColor(goal.status as string)}`} variant="secondary">
                  {goal.status as string}
                </Badge>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Team goals overview */}
      <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="text-base font-semibold text-foreground">Team Goals</h2>
          <Link
            href="/dashboard/manager/team"
            className="text-sm font-medium text-primary hover:underline flex items-center gap-1"
          >
            Full view <ChevronRight className="w-4 h-4" />
          </Link>
        </div>

        {isLoading ? (
          <div className="p-6 space-y-4">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-14 rounded-lg" />)}
          </div>
        ) : (
          <div className="divide-y divide-border">
            {allGoals.slice(0, 8).map((goal: Record<string, unknown>) => (
              <div key={goal.id as string} className="flex items-center gap-4 px-6 py-4 hover:bg-muted/50 transition-colors">
                <div className="w-2 h-2 rounded-full bg-muted-foreground flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{goal.title as string}</p>
                  <p className="text-xs text-muted-foreground mt-1">{((goal.owner as Record<string, unknown>)?.name as string) ?? "Unknown"}</p>
                </div>
                <Badge className={`text-xs shrink-0 font-normal ${getGoalStatusColor(goal.status as string)}`} variant="secondary">
                  {(goal.status as string).replace("_", " ")}
                </Badge>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
