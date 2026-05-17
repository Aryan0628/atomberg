"use client";

import { useGoals } from "@/hooks/useGoals";
import { useCurrentCycle } from "@/hooks/useCycle";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, Target, BarChart3, Shield, TrendingUp, Clock, ArrowRight } from "lucide-react";
import { ActionCenter } from "@/components/shared/ActionCenter";
import Link from "next/link";
import { useEffect, useRef } from "react";
import { useStaggerIn } from "@/hooks/useGsap";
import gsap from "gsap";

// ─── Animated Pulse Bar ────────────────────────────────────────

function PulseBar({ label, value, color }: { label: string; value: number; color: string }) {
  const barRef = useRef<HTMLDivElement>(null);
  const numRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!barRef.current) return;
    barRef.current.style.width = "0%";
    gsap.to(barRef.current, { width: `${Math.min(value, 100)}%`, duration: 1, ease: "power2.out", delay: 0.1 });
    gsap.fromTo({ v: 0 }, { v: value }, {
      duration: 1, ease: "power2.out", delay: 0.1,
      onUpdate() { if (numRef.current) numRef.current.textContent = `${Math.round((this as { targets: () => { v: number }[] }).targets()[0].v)}%`; },
    });
  }, [value]);

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs">
        <span className="text-slate-500 font-medium">{label}</span>
        <span ref={numRef} className="text-slate-700 dark:text-slate-300 font-semibold tabular-nums">{value}%</span>
      </div>
      <div className="h-1.5 w-full bg-slate-100 dark:bg-white/[0.06] rounded-full overflow-hidden">
        <div ref={barRef} className={`h-full rounded-full ${color}`} style={{ width: 0 }} />
      </div>
    </div>
  );
}

// ─── Stat Card ─────────────────────────────────────────────────

function StatCard({
  title, value, icon: Icon, accent, subtitle, loading,
}: {
  title: string; value: string | number; icon: React.ElementType;
  accent: string; subtitle?: string; loading?: boolean;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const numRef  = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (loading || !cardRef.current) return;
    gsap.fromTo(cardRef.current, { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.4, ease: "power2.out" });
    const parsed = parseFloat(String(value));
    if (numRef.current && !isNaN(parsed) && parsed > 0) {
      gsap.fromTo({ v: 0 }, { v: parsed }, {
        duration: 0.75, ease: "power2.out",
        onUpdate() {
          if (!numRef.current) return;
          const n = (this as { targets: () => { v: number }[] }).targets()[0].v;
          numRef.current.textContent = String(Math.round(n));
        },
      });
    }
  }, [loading, value]);

  if (loading) return <div className="rounded-xl border border-slate-200 dark:border-white/[0.06] bg-white dark:bg-white/[0.02] p-5"><Skeleton className="h-16" /></div>;

  return (
    <div ref={cardRef} className="opacity-0 rounded-xl border border-slate-200 dark:border-white/[0.06] bg-white dark:bg-white/[0.02] p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest">{title}</p>
          <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1 tracking-tight tabular-nums">
            {/^\d/.test(String(value)) ? <span ref={numRef}>{value}</span> : String(value)}
          </p>
          {subtitle && <p className="text-xs text-slate-400 mt-1">{subtitle}</p>}
        </div>
        <div className={`w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 ${accent}`}>
          <Icon className="w-4 h-4" />
        </div>
      </div>
    </div>
  );
}

// ─── Quick Link ────────────────────────────────────────────────

function QuickLink({ href, icon: Icon, title, desc, accent }: {
  href: string; icon: React.ElementType; title: string; desc: string; accent: string;
}) {
  return (
    <Link
      href={href}
      className="group flex items-center gap-4 p-4 rounded-xl border border-slate-200 dark:border-white/[0.06] bg-white dark:bg-white/[0.02] hover:border-slate-300 dark:hover:border-white/[0.12] hover:shadow-sm transition-all"
    >
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${accent}`}>
        <Icon className="w-4.5 h-4.5 w-[18px] h-[18px]" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 group-hover:text-indigo-600 dark:group-hover:text-indigo-400 transition-colors">{title}</p>
        <p className="text-xs text-slate-400 mt-0.5">{desc}</p>
      </div>
      <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-indigo-400 transition-colors shrink-0" />
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

  const quickRef  = useStaggerIn({ delay: 0.3, stagger: 0.07 });

  return (
    <div className="space-y-5">
      <ActionCenter />

      {/* Org Pulse */}
      <div className="rounded-xl border border-slate-200 dark:border-white/[0.06] bg-white dark:bg-white/[0.02] p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-200">Org-Wide Funnel</h2>
          <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wider">{cycle?.name ?? "No active cycle"}</span>
        </div>
        <div className="space-y-3">
          <PulseBar label="Submitted"  value={pct(submitted + approved + locked)} color="bg-indigo-400" />
          <PulseBar label="Approved"   value={pct(approved + locked)}              color="bg-emerald-400" />
          <PulseBar label="Locked"     value={pct(locked)}                         color="bg-blue-400" />
        </div>
        <div className="grid grid-cols-4 gap-3 pt-1">
          {[
            { label: "Draft",      count: draft,     color: "text-slate-500" },
            { label: "Submitted",  count: submitted,  color: "text-indigo-600 dark:text-indigo-400" },
            { label: "Approved",   count: approved,   color: "text-emerald-600 dark:text-emerald-400" },
            { label: "Locked",     count: locked,     color: "text-blue-600 dark:text-blue-400" },
          ].map((s) => (
            <div key={s.label} className="text-center py-2 rounded-lg bg-slate-50 dark:bg-white/[0.03]">
              <p className={`text-lg font-bold tabular-nums ${s.color}`}>{s.count}</p>
              <p className="text-[10px] text-slate-400 mt-0.5">{s.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard loading={isLoading} title="Employees"     value={uniqueEmployees}                     accent="bg-indigo-50  text-indigo-600  dark:bg-indigo-500/10  dark:text-indigo-400"  icon={Users}     />
        <StatCard loading={isLoading} title="Total Goals"   value={totalGoals}                          accent="bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400" icon={Target}    subtitle={`${draft} draft · ${submitted} pending`} />
        <StatCard loading={isLoading} title="Avg Score"     value={avgScore > 0 ? `${avgScore.toFixed(1)}%` : "—"} accent="bg-blue-50   text-blue-600   dark:bg-blue-500/10   dark:text-blue-400"   icon={TrendingUp}/>
        <StatCard loading={isLoading} title="Active Cycle"  value={cycle?.name ?? "—"}                  accent="bg-amber-50  text-amber-600  dark:bg-amber-500/10  dark:text-amber-400"  icon={Clock}     subtitle={cycle?.fiscalYear} />
      </div>

      {/* Quick Links */}
      <div ref={quickRef} className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <QuickLink href="/dashboard/admin/analytics" icon={BarChart3} title="Analytics"        desc="View charts and performance reports" accent="bg-indigo-50  text-indigo-600  dark:bg-indigo-500/10  dark:text-indigo-400" />
        <QuickLink href="/dashboard/admin/audit"     icon={Shield}    title="Audit Trail"       desc="Review all system actions and changes"   accent="bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400" />
        <QuickLink href="/dashboard/admin/users"     icon={Users}     title="User Management"   desc="Manage employees, roles, and hierarchy"   accent="bg-blue-50   text-blue-600   dark:bg-blue-500/10   dark:text-blue-400" />
      </div>
    </div>
  );
}
