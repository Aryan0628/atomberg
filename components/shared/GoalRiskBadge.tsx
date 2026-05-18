"use client";

import { computeGoalRisk, type RiskLevel } from "@/lib/scoring";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface Checkin {
  quarter: string;
  scorePercentage: number | null;
}

interface Props {
  checkins: Checkin[];
  showLabel?: boolean;
}

const ICONS: Record<RiskLevel, string> = {
  on_track: "✓",
  at_risk:  "⚠",
  critical: "✕",
  no_data:  "—",
};

export function GoalRiskBadge({ checkins, showLabel = true }: Props) {
  const risk = computeGoalRisk(checkins);

  if (risk.level === "no_data") return null;

  return (
    <TooltipProvider delay={200}>
      <Tooltip>
        <TooltipTrigger>
          <span className={`inline-flex items-center gap-1 text-xs font-semibold cursor-default select-none ${risk.color}`}>
            <span className={`inline-block w-1.5 h-1.5 rounded-full ${risk.dotColor}`} />
            {showLabel && risk.label}
            {!showLabel && ICONS[risk.level]}
          </span>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs max-w-[200px]">
          <p className="font-semibold">{risk.label}</p>
          <p className="text-muted-foreground mt-0.5">{risk.reason}</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
