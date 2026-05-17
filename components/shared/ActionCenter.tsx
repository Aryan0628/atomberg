// ActionCenter — proactive action items for all dashboards
// Server-side fetch on page load via TanStack Query (no polling delay on first render)
"use client";

import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, CheckCircle, Info, ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface ActionItem {
  severity: "high" | "medium" | "low";
  message: string;
  link: string;
  category: string;
}

function useActionItems() {
  return useQuery({
    queryKey: ["action-items"],
    queryFn: async () => {
      const res = await fetch("/api/action-items");
      if (!res.ok) return [] as ActionItem[];
      return res.json() as Promise<ActionItem[]>;
    },
    staleTime: 60_000,
    refetchInterval: 120_000,
  });
}

const SEVERITY_CONFIG = {
  high: {
    icon: AlertTriangle,
    containerClass: "bg-destructive/10 border-destructive/20",
    iconClass: "text-destructive",
    textClass: "text-destructive font-medium",
    badgeClass: "bg-destructive/20 text-destructive",
  },
  medium: {
    icon: AlertTriangle,
    containerClass: "bg-amber-500/10 border-amber-500/20",
    iconClass: "text-amber-600 dark:text-amber-400",
    textClass: "text-amber-800 dark:text-amber-300 font-medium",
    badgeClass: "bg-amber-500/20 text-amber-700 dark:text-amber-300",
  },
  low: {
    icon: Info,
    containerClass: "bg-primary/5 border-primary/10",
    iconClass: "text-primary",
    textClass: "text-foreground font-medium",
    badgeClass: "bg-primary/10 text-primary",
  },
};

export function ActionCenter() {
  const { data: items = [], isLoading } = useActionItems();
  const [collapsed, setCollapsed] = useState(false);

  if (isLoading || items.length === 0) {
    if (!isLoading && items.length === 0) {
      return (
        <div className="flex items-center gap-2 p-4 rounded-xl border border-border bg-card text-sm text-muted-foreground shadow-sm">
          <CheckCircle className="w-4 h-4 flex-shrink-0 text-emerald-500" />
          <span>All clear — no action required right now.</span>
        </div>
      );
    }
    return null;
  }

  const highCount = items.filter((i) => i.severity === "high").length;

  return (
    <div className="rounded-xl border border-border overflow-hidden bg-card shadow-sm">
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="w-full flex items-center justify-between px-6 py-4 border-b border-border hover:bg-muted/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-foreground">Action Required</span>
          {highCount > 0 && (
            <span className="text-xs font-bold px-1.5 py-0.5 rounded-full bg-destructive text-destructive-foreground">
              {highCount}
            </span>
          )}
          <span className="text-xs text-muted-foreground">{items.length} item{items.length !== 1 ? "s" : ""}</span>
        </div>
        {collapsed ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronUp className="w-4 h-4 text-muted-foreground" />}
      </button>

      {!collapsed && (
        <div className="divide-y divide-border">
          {items.map((item, i) => {
            const config = SEVERITY_CONFIG[item.severity];
            const Icon = config.icon;
            return (
              <Link
                key={i}
                href={item.link}
                className={cn("flex items-start gap-4 px-6 py-4 hover:bg-muted/50 transition-colors group", config.containerClass)}
              >
                <Icon className={cn("w-4 h-4 flex-shrink-0 mt-0.5", config.iconClass)} />
                <div className="flex-1 min-w-0">
                  <span className={cn("text-sm", config.textClass)}>{item.message}</span>
                </div>
                <span className={cn("text-[10px] px-2 py-1 rounded-md flex-shrink-0 font-medium", config.badgeClass)}>
                  {item.category}
                </span>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
