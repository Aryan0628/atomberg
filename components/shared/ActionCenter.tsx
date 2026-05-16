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
    containerClass: "bg-red-50 border-red-200 dark:bg-red-950/30 dark:border-red-900",
    iconClass: "text-red-500",
    textClass: "text-red-800 dark:text-red-300",
    badgeClass: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
  },
  medium: {
    icon: AlertTriangle,
    containerClass: "bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-900",
    iconClass: "text-amber-500",
    textClass: "text-amber-800 dark:text-amber-300",
    badgeClass: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  },
  low: {
    icon: Info,
    containerClass: "bg-blue-50 border-blue-200 dark:bg-blue-950/30 dark:border-blue-900",
    iconClass: "text-blue-500",
    textClass: "text-blue-800 dark:text-blue-300",
    badgeClass: "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
  },
};

export function ActionCenter() {
  const { data: items = [], isLoading } = useActionItems();
  const [collapsed, setCollapsed] = useState(false);

  if (isLoading || items.length === 0) {
    if (!isLoading && items.length === 0) {
      return (
        <div className="flex items-center gap-2 p-3 rounded-lg border border-green-200 bg-green-50 dark:bg-green-950/30 dark:border-green-900 text-sm text-green-700 dark:text-green-300">
          <CheckCircle className="w-4 h-4 flex-shrink-0" />
          <span>All clear — no action required right now.</span>
        </div>
      );
    }
    return null;
  }

  const highCount = items.filter((i) => i.severity === "high").length;

  return (
    <div className="rounded-xl border border-slate-200 dark:border-slate-800 overflow-hidden">
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="w-full flex items-center justify-between px-4 py-3 bg-slate-50 dark:bg-slate-900 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">Action Required</span>
          {highCount > 0 && (
            <span className="text-xs font-bold px-1.5 py-0.5 rounded-full bg-red-500 text-white">
              {highCount}
            </span>
          )}
          <span className="text-xs text-slate-400">{items.length} item{items.length !== 1 ? "s" : ""}</span>
        </div>
        {collapsed ? <ChevronDown className="w-4 h-4 text-slate-400" /> : <ChevronUp className="w-4 h-4 text-slate-400" />}
      </button>

      {!collapsed && (
        <div className="divide-y divide-slate-100 dark:divide-slate-800">
          {items.map((item, i) => {
            const config = SEVERITY_CONFIG[item.severity];
            const Icon = config.icon;
            return (
              <Link
                key={i}
                href={item.link}
                className={cn("flex items-start gap-3 px-4 py-3 hover:opacity-80 transition-opacity", config.containerClass)}
              >
                <Icon className={cn("w-4 h-4 flex-shrink-0 mt-0.5", config.iconClass)} />
                <div className="flex-1 min-w-0">
                  <span className={cn("text-sm", config.textClass)}>{item.message}</span>
                </div>
                <span className={cn("text-[10px] px-1.5 py-0.5 rounded flex-shrink-0", config.badgeClass)}>
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
