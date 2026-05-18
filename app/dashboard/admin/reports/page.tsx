"use client";

import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  Download, FileSpreadsheet, FileText, Shield, TrendingUp,
  Users, CheckSquare, Clock, AlertCircle, CalendarDays,
} from "lucide-react";
import { downloadICS, cycleToICSEvents } from "@/lib/ics";

function useOverview() {
  return useQuery({
    queryKey: ["analytics", "overview"],
    queryFn: async () => {
      const r = await fetch("/api/analytics/overview");
      if (!r.ok) return null;
      return r.json();
    },
    staleTime: 60_000,
  });
}

function useActiveCycle() {
  return useQuery({
    queryKey: ["cycles", "current"],
    queryFn: async () => {
      const r = await fetch("/api/cycles/current");
      if (!r.ok) return null;
      return r.json();
    },
    staleTime: 300_000,
  });
}

async function triggerDownload(url: string, filename: string) {
  toast.loading("Generating report…");
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error("Export failed");
    const blob = await res.blob();
    const href = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = href;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(href);
    toast.dismiss();
    toast.success(`${filename} downloaded!`);
  } catch {
    toast.dismiss();
    toast.error("Export failed — please try again");
  }
}

interface ReportCardProps {
  icon: React.ReactNode;
  iconBg: string;
  title: string;
  description: string;
  badges?: string[];
  actions: { label: string; onClick: () => void; variant?: "default" | "outline" }[];
}

function ReportCard({ icon, iconBg, title, description, badges, actions }: ReportCardProps) {
  return (
    <Card className="hover:shadow-md transition-shadow border-border">
      <CardContent className="p-6">
        <div className="flex items-start gap-4">
          <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 ${iconBg}`}>
            {icon}
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-foreground">{title}</p>
            <p className="text-sm text-muted-foreground mt-0.5">{description}</p>
            {badges && (
              <div className="flex flex-wrap gap-1.5 mt-2">
                {badges.map((b) => (
                  <Badge key={b} variant="secondary" className="text-[10px] font-normal">{b}</Badge>
                ))}
              </div>
            )}
          </div>
          <div className="flex flex-col gap-2 flex-shrink-0">
            {actions.map((a) => (
              <Button
                key={a.label}
                size="sm"
                variant={a.variant ?? "default"}
                onClick={a.onClick}
                className="gap-1.5 whitespace-nowrap"
              >
                <Download className="w-3.5 h-3.5" />
                {a.label}
              </Button>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function AdminReportsPage() {
  const { data: overview, isLoading } = useOverview();
  const { data: activeCycle } = useActiveCycle();
  const [auditFilter, setAuditFilter] = useState("ALL");

  const ts = () => new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Report Center</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Export data for analysis, audits, and HR reviews
          </p>
        </div>
        {overview?.cycleName && (
          <Badge variant="outline" className="text-sm">{overview.cycleName}</Badge>
        )}
      </div>

      {/* Snapshot stats */}
      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Total Goals", value: overview?.totalGoals ?? "—", icon: <CheckSquare className="w-4 h-4 text-blue-500" /> },
            { label: "Employees", value: overview?.totalEmployees ?? "—", icon: <Users className="w-4 h-4 text-violet-500" /> },
            { label: "Avg Score", value: overview?.avgScore ? `${overview.avgScore}%` : "—", icon: <TrendingUp className="w-4 h-4 text-emerald-500" /> },
            { label: "Check-in Rate", value: overview?.checkinCompletionRate ? `${overview.checkinCompletionRate}%` : "—", icon: <Clock className="w-4 h-4 text-amber-500" /> },
          ].map((s) => (
            <Card key={s.label} className="border-border">
              <CardContent className="p-4 flex items-center gap-3">
                {s.icon}
                <div>
                  <p className="text-xl font-bold text-foreground">{s.value}</p>
                  <p className="text-xs text-muted-foreground">{s.label}</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Goal Reports */}
      <div>
        <CardHeader className="px-0 pt-0 pb-3">
          <CardTitle className="text-base text-foreground">Goal Reports</CardTitle>
        </CardHeader>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <ReportCard
            icon={<FileSpreadsheet className="w-6 h-6 text-emerald-600" />}
            iconBg="bg-emerald-50 dark:bg-emerald-950/40"
            title="Goals Report (Excel)"
            description="All goals with targets, actuals, weighted scores, and check-in history — formatted for HR review."
            badges={["All quarters", "Weighted scores", "Check-in data", "Sortable"]}
            actions={[{
              label: "Export Excel",
              onClick: () => triggerDownload("/api/export/excel", `AtomQuest_Goals_${ts()}.xlsx`),
            }]}
          />
          <ReportCard
            icon={<FileText className="w-6 h-6 text-blue-600" />}
            iconBg="bg-blue-50 dark:bg-blue-950/40"
            title="Goals Report (CSV)"
            description="Raw CSV of all goals — ideal for importing into Excel, Power BI, or Sheets for custom analysis."
            badges={["Raw data", "All employees", "Machine-readable"]}
            actions={[{
              label: "Export CSV",
              variant: "outline",
              onClick: () => triggerDownload("/api/export/csv", `AtomQuest_Goals_${ts()}.csv`),
            }]}
          />
        </div>
      </div>

      {/* Calendar Export */}
      {activeCycle && (
        <div>
          <CardHeader className="px-0 pt-0 pb-3">
            <CardTitle className="text-base text-foreground flex items-center gap-2">
              <CalendarDays className="w-4 h-4 text-slate-500" />
              Calendar Export
            </CardTitle>
          </CardHeader>
          <ReportCard
            icon={<CalendarDays className="w-6 h-6 text-indigo-600" />}
            iconBg="bg-indigo-50 dark:bg-indigo-950/40"
            title="Check-in Schedule (.ics)"
            description={`Export all ${activeCycle.name} window dates to your calendar — opens in Google Calendar, Outlook, or Apple Calendar.`}
            badges={["Goal Setting", "Q1", "Q2", "Q3", "Q4", "With reminders"]}
            actions={[{
              label: "Add to Calendar",
              variant: "outline",
              onClick: () => {
                const events = cycleToICSEvents(activeCycle);
                downloadICS(events, `AtomQuest_${activeCycle.name.replace(/\s+/g, "_")}.ics`);
                toast.success("Calendar file downloaded — open it to import into your calendar app");
              },
            }]}
          />
        </div>
      )}

      {/* Audit Report */}
      <div>
        <CardHeader className="px-0 pt-0 pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base text-foreground flex items-center gap-2">
              <Shield className="w-4 h-4 text-slate-500" />
              Audit Trail Export
            </CardTitle>
            <Select value={auditFilter} onValueChange={(v) => { if (v !== null) setAuditFilter(v); }}>
              <SelectTrigger className="w-[180px] h-8 text-xs">
                <SelectValue placeholder="Filter actions" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ALL">All Actions</SelectItem>
                <SelectItem value="GOAL_APPROVED">Goal Approved</SelectItem>
                <SelectItem value="GOAL_REJECTED">Goal Rejected</SelectItem>
                <SelectItem value="CHECKIN_SUBMITTED">Check-in Submitted</SelectItem>
                <SelectItem value="GOALS_AUTO_LOCKED">Auto-locked</SelectItem>
                <SelectItem value="ESCALATION_SENT">Escalation Sent</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <ReportCard
            icon={<Shield className="w-6 h-6 text-slate-600" />}
            iconBg="bg-slate-100 dark:bg-slate-800"
            title="Audit Trail (Excel)"
            description="Tamper-evident log of all goal changes — who changed what, when. Includes hash chain for compliance."
            badges={["Immutable", "Hash-verified", "Compliance-ready"]}
            actions={[{
              label: "Export Audit",
              onClick: () => {
                const filter = auditFilter !== "ALL" ? `?action=${auditFilter}` : "";
                triggerDownload(`/api/audit/export${filter}`, `AtomQuest_Audit_${ts()}.xlsx`);
              },
            }]}
          />
          <Card className="border-border border-dashed">
            <CardContent className="p-6 flex items-start gap-4">
              <div className="w-12 h-12 rounded-xl bg-amber-50 dark:bg-amber-950/40 flex items-center justify-center flex-shrink-0">
                <AlertCircle className="w-6 h-6 text-amber-600" />
              </div>
              <div>
                <p className="font-semibold text-foreground">Compliance Note</p>
                <p className="text-sm text-muted-foreground mt-1">
                  Audit logs are cryptographically hash-chained. No audit entry can be deleted or
                  modified without detection. Chain integrity can be verified from the Audit Trail page.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
