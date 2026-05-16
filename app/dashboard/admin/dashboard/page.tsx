// Admin Dashboard
"use client";

import { useGoals } from "@/hooks/useGoals";
import { useCurrentCycle } from "@/hooks/useCycle";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, Target, BarChart3, Shield, TrendingUp, Clock } from "lucide-react";
import { ActionCenter } from "@/components/shared/ActionCenter";

export default function AdminDashboard() {
  const { data: goals, isLoading } = useGoals();
  const { data: cycle } = useCurrentCycle();
  const allGoals = goals || [];

  const totalGoals = allGoals.length;
  const submitted = allGoals.filter((g: Record<string, unknown>) => g.status === "SUBMITTED").length;
  const approved = allGoals.filter((g: Record<string, unknown>) => g.status === "APPROVED").length;
  const locked = allGoals.filter((g: Record<string, unknown>) => g.status === "LOCKED").length;
  const draft = allGoals.filter((g: Record<string, unknown>) => g.status === "DRAFT").length;
  const uniqueEmployees = [...new Set(allGoals.map((g: Record<string, unknown>) => (g.owner as Record<string, unknown>)?.id))].length;

  const goalsWithScores = allGoals.filter((g: Record<string, unknown>) => g.latestScore !== null);
  const avgScore = goalsWithScores.length > 0
    ? goalsWithScores.reduce((sum: number, g: Record<string, unknown>) => sum + (g.latestScore as number), 0) / goalsWithScores.length
    : 0;

  return (
    <div className="space-y-6">
      {/* Action Center */}
      <ActionCenter />

      {/* Org Pulse Ticker */}
      <Card className="bg-gradient-to-r from-slate-900 to-slate-800 border-0 text-white">
        <CardContent className="p-5 space-y-3">
          <h3 className="text-sm font-medium text-slate-300 uppercase tracking-wider">Org-Wide Pulse</h3>
          <div className="space-y-2">
            <PulseLine label="Goal Setting" value={Math.round(((submitted + approved + locked) / Math.max(totalGoals, 1)) * 100)} />
            <PulseLine label="Approved" value={Math.round(((approved + locked) / Math.max(totalGoals, 1)) * 100)} />
            <PulseLine label="Locked" value={Math.round((locked / Math.max(totalGoals, 1)) * 100)} />
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {isLoading ? (
          [1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-28" />)
        ) : (
          <>
            <StatCard title="Active Employees" value={uniqueEmployees} icon={Users} color="blue" />
            <StatCard title="Total Goals" value={totalGoals} icon={Target} color="green" subtitle={`${draft} draft, ${submitted} pending`} />
            <StatCard title="Avg Score" value={avgScore > 0 ? `${avgScore.toFixed(1)}%` : "—"} icon={TrendingUp} color="purple" />
            <StatCard title="Current Cycle" value={cycle?.name || "—"} icon={Clock} color="amber" subtitle={cycle?.fiscalYear} />
          </>
        )}
      </div>

      {/* Quick Links */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <QuickLink href="/dashboard/admin/analytics" icon={BarChart3} title="Analytics" desc="View charts and reports" color="blue" />
        <QuickLink href="/dashboard/admin/audit" icon={Shield} title="Audit Trail" desc="Review all system actions" color="green" />
        <QuickLink href="/dashboard/admin/users" icon={Users} title="User Management" desc="Manage employees and roles" color="purple" />
      </div>
    </div>
  );
}

function PulseLine({ label, value }: { label: string; value: number }) {
  const bars = Math.floor(value / 5);
  const barStr = "█".repeat(bars) + "░".repeat(20 - bars);
  return (
    <div className="flex items-center gap-3 text-sm font-mono">
      <span className="w-28 text-slate-400">{label}:</span>
      <span className="text-green-400">{barStr}</span>
      <span className="text-white font-bold">{value}%</span>
    </div>
  );
}

function StatCard({ title, value, icon: Icon, color, subtitle }: {
  title: string; value: string | number; icon: React.ElementType; color: string; subtitle?: string;
}) {
  const bg: Record<string, string> = {
    blue: "bg-blue-50 text-blue-600 dark:bg-blue-950/50",
    green: "bg-green-50 text-green-600 dark:bg-green-950/50",
    purple: "bg-purple-50 text-purple-600 dark:bg-purple-950/50",
    amber: "bg-amber-50 text-amber-600 dark:bg-amber-950/50",
  };
  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-medium text-slate-500 uppercase">{title}</p>
            <p className="text-2xl font-bold mt-1">{value}</p>
            {subtitle && <p className="text-xs text-slate-500 mt-1">{subtitle}</p>}
          </div>
          <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${bg[color]}`}>
            <Icon className="w-5 h-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function QuickLink({ href, icon: Icon, title, desc, color }: {
  href: string; icon: React.ElementType; title: string; desc: string; color: string;
}) {
  const bg: Record<string, string> = {
    blue: "bg-blue-50 text-blue-600 dark:bg-blue-950/30",
    green: "bg-green-50 text-green-600 dark:bg-green-950/30",
    purple: "bg-purple-50 text-purple-600 dark:bg-purple-950/30",
  };
  return (
    <a href={href}>
      <Card className="hover:shadow-md transition-shadow cursor-pointer group">
        <CardContent className="p-4 flex items-center gap-4">
          <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${bg[color]}`}>
            <Icon className="w-6 h-6" />
          </div>
          <div>
            <p className="font-semibold group-hover:text-blue-600 transition-colors">{title}</p>
            <p className="text-xs text-slate-500">{desc}</p>
          </div>
        </CardContent>
      </Card>
    </a>
  );
}
