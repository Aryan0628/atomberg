"use client";

import { useGoals } from "@/hooks/useGoals";
import { useCurrentCycle } from "@/hooks/useCycle";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, Target, BarChart3, Shield, TrendingUp, Clock, ArrowRight } from "lucide-react";
import { ActionCenter } from "@/components/shared/ActionCenter";
import Link from "next/link";
import { useEffect, useState } from "react";

// ─── Pulse Bar ────────────────────────────────────────

function PulseBar({ label, value, color }: { label: string; value: number; color: string }) {
  const [width, setWidth] = useState(0);
  
  useEffect(() => {
    // Small delay to trigger CSS transition on mount
    const timer = setTimeout(() => setWidth(Math.min(value, 100)), 100);
    return () => clearTimeout(timer);
  }, [value]);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-xs">
        <span className="text-muted-foreground font-medium">{label}</span>
        <span className="text-foreground font-semibold tabular-nums">{value}%</span>
      </div>
      <div className="h-2 w-full bg-muted rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all duration-1000 ease-out ${color}`} style={{ width: `${width}%` }} />
      </div>
    </div>
  );
}

// ─── Stat Card ─────────────────────────────────────────────────

function StatCard({
  title, value, icon: Icon, subtitle, loading,
}: {
  title: string; value: string | number; icon: React.ElementType;
  subtitle?: string; loading?: boolean;
}) {
  if (loading) return <div className="rounded-xl border border-border bg-card p-6 shadow-sm"><Skeleton className="h-16" /></div>;

  return (
    <div className="rounded-xl border border-border bg-card p-6 shadow-sm flex flex-col justify-between">
      <div className="flex items-center justify-between mb-4">
        <p className="text-xs font-medium text-muted-foreground">{title}</p>
        <Icon className="w-4 h-4 text-muted-foreground" />
      </div>
      <div>
        <p className="text-2xl font-semibold text-foreground tracking-tight tabular-nums">
          {value}
        </p>
        {subtitle && <p className="text-xs text-muted-foreground mt-1">{subtitle}</p>}
      </div>
    </div>
  );
}

// ─── Quick Link ────────────────────────────────────────────────

function QuickLink({ href, icon: Icon, title, desc }: {
  href: string; icon: React.ElementType; title: string; desc: string;
}) {
  return (
    <Link
      href={href}
      className="group flex items-center gap-4 p-5 rounded-xl border border-border bg-card hover:bg-muted/50 transition-colors shadow-sm"
    >
      <div className="w-10 h-10 rounded-lg flex items-center justify-center bg-muted text-muted-foreground flex-shrink-0 group-hover:text-foreground transition-colors">
        <Icon className="w-5 h-5" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-foreground">{title}</p>
        <p className="text-xs text-muted-foreground mt-1">{desc}</p>
      </div>
      <ArrowRight className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors shrink-0" />
    </Link>
  );
}

// ─── Page ─────────────────────────────────────────────────────

export default function AdminDashboard() {
  const { data: goals, isLoading } = useGoals();
  const { data: cycle }            = useCurrentCycle();
  const allGoals = goals || [];

  const totalGoals      = allGoals.length;
  const submitted       = allGoals.filter((g: Record<string, unknown>) => g.status === "SUBMITTED").length;
  const approved        = allGoals.filter((g: Record<string, unknown>) => g.status === "APPROVED").length;
  const locked          = allGoals.filter((g: Record<string, unknown>) => g.status === "LOCKED").length;
  const draft           = allGoals.filter((g: Record<string, unknown>) => g.status === "DRAFT").length;
  const uniqueEmployees = [...new Set(allGoals.map((g: Record<string, unknown>) => (g.owner as Record<string, unknown>)?.id))].length;

  const goalsWithScores = allGoals.filter((g: Record<string, unknown>) => g.latestScore !== null);
  const avgScore        = goalsWithScores.length > 0
    ? goalsWithScores.reduce((s: number, g: Record<string, unknown>) => s + (g.latestScore as number), 0) / goalsWithScores.length
    : 0;

  const pct = (n: number) => Math.round((n / Math.max(totalGoals, 1)) * 100);

  return (
    <div className="space-y-6">
      <ActionCenter />

      {/* Org Pulse */}
      <div className="rounded-xl border border-border bg-card p-6 shadow-sm space-y-6">
        <div className="flex items-center justify-between border-b border-border pb-4">
          <h2 className="text-base font-semibold text-foreground">Org-Wide Funnel</h2>
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{cycle?.name ?? "No active cycle"}</span>
        </div>
        <div className="space-y-4">
          <PulseBar label="Submitted"  value={pct(submitted + approved + locked)} color="bg-primary" />
          <PulseBar label="Approved"   value={pct(approved + locked)}             color="bg-primary/80" />
          <PulseBar label="Locked"     value={pct(locked)}                        color="bg-primary/60" />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 pt-4 border-t border-border">
          {[
            { label: "Draft",      count: draft },
            { label: "Submitted",  count: submitted },
            { label: "Approved",   count: approved },
            { label: "Locked",     count: locked },
          ].map((s) => (
            <div key={s.label} className="text-center py-3 rounded-lg bg-muted/50 border border-border">
              <p className="text-xl font-bold tabular-nums text-foreground">{s.count}</p>
              <p className="text-xs text-muted-foreground mt-1">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard loading={isLoading} title="Employees"     value={uniqueEmployees}                     icon={Users}     />
        <StatCard loading={isLoading} title="Total Goals"   value={totalGoals}                          icon={Target}    subtitle={`${draft} draft · ${submitted} pending`} />
        <StatCard loading={isLoading} title="Avg Score"     value={avgScore > 0 ? `${avgScore.toFixed(1)}%` : "—"} icon={TrendingUp}/>
        <StatCard loading={isLoading} title="Active Cycle"  value={cycle?.name ?? "—"}                  icon={Clock}     subtitle={cycle?.fiscalYear} />
      </div>

      {/* Quick Links */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <QuickLink href="/dashboard/admin/analytics" icon={BarChart3} title="Analytics"        desc="View charts and performance reports" />
        <QuickLink href="/dashboard/admin/audit"     icon={Shield}    title="Audit Trail"       desc="Review all system actions and changes" />
        <QuickLink href="/dashboard/admin/users"     icon={Users}     title="User Management"   desc="Manage employees, roles, and hierarchy" />
      </div>
    </div>
  );
}
