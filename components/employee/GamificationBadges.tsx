"use client";

import { useGoals } from "@/hooks/useGoals";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Target, Send, Lock, Rocket, Star, Scale, RefreshCw,
  ShieldCheck, Dumbbell, Sparkles, Trophy, Medal,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface Badge {
  id: string;
  Icon: LucideIcon;
  name: string;
  desc: string;
  earned: boolean;
  color: string;
}

function computeBadges(goals: Record<string, unknown>[]): Badge[] {
  const allCheckins = goals.flatMap((g) => (g.checkins as Record<string, unknown>[]) ?? []);
  const lockedGoals = goals.filter((g) => g.status === "LOCKED");
  const submittedOrBetter = goals.filter((g) =>
    ["SUBMITTED", "UNDER_REVIEW", "APPROVED", "LOCKED"].includes(g.status as string)
  );
  const maxScore = allCheckins.reduce((m, c) => Math.max(m, (c.scorePercentage as number) ?? 0), 0);
  const totalWeightage = goals.reduce((s, g) => s + ((g.weightage as number) ?? 0), 0);
  const quarters = [...new Set(allCheckins.map((c) => c.quarter as string))];
  const hasZeroGoal = goals.some(
    (g) => g.uomType === "ZERO" && allCheckins.some((c) => c.goalId === g.id && (c.scorePercentage as number) === 100)
  );
  const avgScores = allCheckins.filter((c) => (c.scorePercentage as number) > 0).map((c) => c.scorePercentage as number);
  const avgScore = avgScores.length ? avgScores.reduce((a, b) => a + b, 0) / avgScores.length : 0;
  const heavyHitter = goals.some((g) => (g.weightage as number) >= 40);
  const noRejections = goals.every((g) => !["REJECTED", "RETURNED"].includes(g.status as string));

  return [
    {
      id: "goal_setter",
      Icon: Target,
      name: "Goal Setter",
      desc: "Created your first goal",
      earned: goals.length > 0,
      color: "blue",
    },
    {
      id: "fully_submitted",
      Icon: Send,
      name: "Fully Submitted",
      desc: "All goals submitted for approval",
      earned: goals.length > 0 && submittedOrBetter.length === goals.length,
      color: "violet",
    },
    {
      id: "locked_in",
      Icon: Lock,
      name: "Locked In",
      desc: "All goals approved and locked — ready for check-ins",
      earned: lockedGoals.length > 0 && lockedGoals.length === goals.length,
      color: "slate",
    },
    {
      id: "overachiever",
      Icon: Rocket,
      name: "Overachiever",
      desc: "Scored 90%+ on a quarterly check-in",
      earned: maxScore >= 90,
      color: "emerald",
    },
    {
      id: "high_achiever",
      Icon: Star,
      name: "High Achiever",
      desc: "Average check-in score above 80%",
      earned: avgScore >= 80,
      color: "amber",
    },
    {
      id: "balanced",
      Icon: Scale,
      name: "Balanced",
      desc: "Total weightage exactly 100%",
      earned: Math.abs(totalWeightage - 100) < 0.01,
      color: "teal",
    },
    {
      id: "consistent",
      Icon: RefreshCw,
      name: "Consistent",
      desc: "Check-ins submitted across 3+ quarters",
      earned: quarters.length >= 3,
      color: "indigo",
    },
    {
      id: "zero_incidents",
      Icon: ShieldCheck,
      name: "Zero Incidents",
      desc: "Achieved a zero-incident goal (100% score)",
      earned: hasZeroGoal,
      color: "green",
    },
    {
      id: "heavy_hitter",
      Icon: Dumbbell,
      name: "Heavy Hitter",
      desc: "One goal carries 40%+ of total weightage",
      earned: heavyHitter,
      color: "orange",
    },
    {
      id: "clean_slate",
      Icon: Sparkles,
      name: "Clean Slate",
      desc: "No goals rejected or returned for rework",
      earned: goals.length > 0 && noRejections,
      color: "pink",
    },
  ];
}

export function GamificationBadges() {
  const { data: goals } = useGoals();
  const allGoals: Record<string, unknown>[] = goals ?? [];
  const badges = computeBadges(allGoals);
  const earned = badges.filter((b) => b.earned);

  if (allGoals.length === 0) return null;

  return (
    <div className="rounded-xl border bg-card p-5 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div>
          <p className="text-sm font-semibold text-foreground">Achievements</p>
          <p className="text-xs text-muted-foreground mt-0.5">{earned.length} of {badges.length} unlocked</p>
        </div>
        <Medal className={`w-5 h-5 ${earned.length >= badges.length ? "text-amber-400" : earned.length >= 5 ? "text-yellow-500" : earned.length >= 3 ? "text-slate-400" : "text-orange-400"}`} />
      </div>
      <div className="flex flex-wrap gap-2">
        {badges.map((badge) => (
          <TooltipProvider key={badge.id} delay={150}>
            <Tooltip>
              <TooltipTrigger>
                <div
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full text-xs font-medium border transition-all select-none ${
                    badge.earned
                      ? "bg-primary/8 border-primary/20 text-foreground shadow-sm scale-100"
                      : "bg-muted/40 border-border text-muted-foreground opacity-40 grayscale"
                  }`}
                >
                  <badge.Icon className="w-3.5 h-3.5 flex-shrink-0" />
                  <span>{badge.name}</span>
                </div>
              </TooltipTrigger>
              <TooltipContent side="top" className="text-xs max-w-[180px] text-center">
                <p className="font-semibold">{badge.earned ? "Unlocked!" : "Locked"}</p>
                <p className="text-muted-foreground mt-0.5">{badge.desc}</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ))}
      </div>
    </div>
  );
}
