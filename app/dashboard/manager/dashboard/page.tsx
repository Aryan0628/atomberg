"use client";

import { useGoals } from "@/hooks/useGoals";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Users, UserCheck, ClipboardCheck, Target, ArrowRight, ChevronRight } from "lucide-react";
import Link from "next/link";
import { getGoalStatusColor } from "@/lib/utils";
import { ActionCenter } from "@/components/shared/ActionCenter";
import { computeGoalWellness, computeWeightedScore } from "@/lib/scoring";
import { useRef, useEffect } from "react";
import { useStaggerIn } from "@/hooks/useGsap";
import gsap from "gsap";

const GRADE_PILL: Record<string, string> = {
  A: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400",
  B: "bg-blue-100   text-blue-700   dark:bg-blue-500/15   dark:text-blue-400",
  C: "bg-amber-100  text-amber-700  dark:bg-amber-500/15  dark:text-amber-400",
  D: "bg-red-100    text-red-700    dark:bg-red-500/15    dark:text-red-400",
};

function StatCard({
  label, value, sub, icon: Icon, accent,
}: {
  label: string; value: number | string; sub: string;
  icon: React.ElementType; accent: string;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const numRef  = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!cardRef.current) return;
    gsap.fromTo(cardRef.current, { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.4, ease: "power2.out" });
    const parsed = typeof value === "number" ? value : parseFloat(String(value));
    if (numRef.current && !isNaN(parsed) && parsed > 0) {
      gsap.fromTo({ v: 0 }, { v: parsed }, {
        duration: 0.75, ease: "power2.out",
        onUpdate() { if (numRef.current) numRef.current.textContent = String(Math.round((this as { targets: () => { v: number }[] }).targets()[0].v)); },
      });
    }
  }, [value]);

  return (
    <div
      ref={cardRef}
      className="opacity-0 rounded-xl border border-slate-200 dark:border-white/[0.06] bg-white dark:bg-white/[0.02] p-5"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest">{label}</p>
          <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1 tabular-nums tracking-tight">
            <span ref={numRef}>{value}</span>
          </p>
          <p className="text-xs text-slate-500 mt-1">{sub}</p>
        </div>
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${accent}`}>
          <Icon className="w-4 h-4" />
        </div>
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

  const wellnessRef   = useStaggerIn({ delay: 0.2, stagger: 0.05 });
  const approvalRef   = useStaggerIn({ delay: 0.3, stagger: 0.06 });
  const teamRef       = useStaggerIn({ delay: 0.35, stagger: 0.05 });

  return (
    <div className="space-y-5">
      <ActionCenter />

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Pending Approvals" value={pendingApprovals.length} sub="Goals awaiting review"    icon={UserCheck}     accent="bg-amber-50   text-amber-600  dark:bg-amber-500/10  dark:text-amber-400" />
        <StatCard label="Team Members"      value={totalReports}            sub="Direct reports"           icon={Users}         accent="bg-indigo-50  text-indigo-600 dark:bg-indigo-500/10 dark:text-indigo-400" />
        <StatCard label="Approved Goals"    value={approvedGoals.length}    sub="Active goals"             icon={ClipboardCheck} accent="bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400" />
        <StatCard label="Total Goals"       value={allGoals.length}         sub="Across all reports"       icon={Target}        accent="bg-blue-50    text-blue-600   dark:bg-blue-500/10   dark:text-blue-400" />
      </div>

      {/* Team Wellness */}
      {employeeWellness.length > 0 && (
        <div className="rounded-xl border border-slate-200 dark:border-white/[0.06] bg-white dark:bg-white/[0.02] overflow-hidden">
          <div className="px-5 py-3.5 border-b border-slate-100 dark:border-white/[0.04]">
            <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-200">Team Wellness</h2>
            <p className="text-xs text-slate-400 mt-0.5">Based on goal completeness, weightage, and check-in rates</p>
          </div>
          <TooltipProvider>
            <div ref={wellnessRef} className="p-4 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {employeeWellness.map((emp) => (
                <Tooltip key={emp.id}>
                  <TooltipTrigger className="w-full text-left rounded-lg border border-slate-100 dark:border-white/[0.06] hover:border-slate-200 dark:hover:border-white/[0.1] hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors focus:outline-none p-3">
                    <div className="flex items-center gap-3">
                      <div className={`w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${GRADE_PILL[emp.grade] ?? GRADE_PILL.D}`}>
                        {emp.grade}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-slate-700 dark:text-slate-300 truncate">{emp.name}</p>
                        <p className="text-[10px] text-slate-400 mt-0.5">
                          {emp.goalsCount} goal{emp.goalsCount !== 1 ? "s" : ""}
                          {emp.ws > 0 ? ` · ${emp.ws.toFixed(0)}%` : ""}
                        </p>
                      </div>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent side="bottom" className="max-w-[200px]">
                    <p className="font-semibold mb-1 text-xs">Wellness {emp.score}/100 — Grade {emp.grade}</p>
                    {emp.issues.length > 0 ? (
                      <ul className="text-xs space-y-0.5 text-slate-300">
                        {emp.issues.map((issue) => <li key={issue}>· {issue}</li>)}
                      </ul>
                    ) : (
                      <p className="text-xs text-emerald-400">All checks passed ✓</p>
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
        <div className="rounded-xl border border-slate-200 dark:border-white/[0.06] bg-white dark:bg-white/[0.02] overflow-hidden">
          <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 dark:border-white/[0.04]">
            <div>
              <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-200">Pending Approvals</h2>
            </div>
            <Link
              href="/dashboard/manager/approvals"
              className="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 flex items-center gap-0.5"
            >
              Review all <ChevronRight className="w-3 h-3" />
            </Link>
          </div>
          <div ref={approvalRef} className="divide-y divide-slate-100 dark:divide-white/[0.04]">
            {pendingApprovals.map((goal: Record<string, unknown>) => (
              <div key={goal.id as string} className="flex items-center gap-4 px-5 py-3.5">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">{goal.title as string}</p>
                  <p className="text-xs text-slate-400 mt-0.5">
                    {((goal.owner as Record<string, unknown>)?.name as string) ?? "Unknown"}
                    {" · "}{goal.thrustArea as string}
                    {" · "}{goal.weightage as number}% weight
                  </p>
                </div>
                <Badge className={`text-[10px] shrink-0 ${getGoalStatusColor(goal.status as string)}`}>
                  {goal.status as string}
                </Badge>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Team goals overview */}
      <div className="rounded-xl border border-slate-200 dark:border-white/[0.06] bg-white dark:bg-white/[0.02] overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-100 dark:border-white/[0.04]">
          <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-200">Team Goals</h2>
          <Link
            href="/dashboard/manager/team"
            className="text-xs font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 flex items-center gap-0.5"
          >
            Full view <ChevronRight className="w-3 h-3" />
          </Link>
        </div>

        {isLoading ? (
          <div className="p-5 space-y-3">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 rounded-lg" />)}
          </div>
        ) : (
          <div ref={teamRef} className="divide-y divide-slate-100 dark:divide-white/[0.04]">
            {allGoals.slice(0, 8).map((goal: Record<string, unknown>) => (
              <div key={goal.id as string} className="flex items-center gap-3 px-5 py-3 hover:bg-slate-50 dark:hover:bg-white/[0.02] transition-colors">
                <div className="w-1.5 h-1.5 rounded-full bg-slate-300 dark:bg-slate-600 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-slate-800 dark:text-slate-200 truncate">{goal.title as string}</p>
                  <p className="text-xs text-slate-400">{((goal.owner as Record<string, unknown>)?.name as string) ?? "Unknown"}</p>
                </div>
                <Badge className={`text-[10px] shrink-0 ${getGoalStatusColor(goal.status as string)}`} variant="outline">
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
