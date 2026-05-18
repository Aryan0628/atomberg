"use client";

import { useState, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import {
  Download, FileSpreadsheet, FileText, Shield, TrendingUp,
  Users, CheckSquare, Clock, AlertCircle, CalendarDays,
  GripVertical, Plus, Trash2, Mail, Settings2,
} from "lucide-react";
import { downloadICS, cycleToICSEvents } from "@/lib/ics";

// ─── Custom Report Builder (drag-and-drop columns) ───────────────────────────

const ALL_COLUMNS = [
  { id: "employeeName", label: "Employee Name" },
  { id: "department", label: "Department" },
  { id: "managerName", label: "Manager" },
  { id: "goalTitle", label: "Goal Title" },
  { id: "thrustArea", label: "Thrust Area" },
  { id: "uomType", label: "UoM Type" },
  { id: "target", label: "Target" },
  { id: "weightage", label: "Weightage %" },
  { id: "status", label: "Goal Status" },
  { id: "latestScore", label: "Latest Score %" },
  { id: "q1Score", label: "Q1 Score" },
  { id: "q2Score", label: "Q2 Score" },
  { id: "q3Score", label: "Q3 Score" },
  { id: "q4Score", label: "Q4 Score" },
  { id: "submittedAt", label: "Submitted At" },
  { id: "approvedAt", label: "Approved At" },
  { id: "lockedAt", label: "Locked At" },
];

function CustomReportBuilder() {
  const [selectedCols, setSelectedCols] = useState<string[]>(["employeeName", "department", "goalTitle", "weightage", "latestScore"]);
  const [reportName, setReportName] = useState("My Custom Report");
  const [format, setFormat] = useState<"excel" | "csv">("excel");
  const [filterDept, setFilterDept] = useState("");
  const [filterStatus, setFilterStatus] = useState("ALL");
  const dragItem = useRef<string | null>(null);
  const dragOver = useRef<string | null>(null);

  const available = ALL_COLUMNS.filter((c) => !selectedCols.includes(c.id));

  const onDragStart = (id: string) => { dragItem.current = id; };
  const onDragEnter = (id: string) => { dragOver.current = id; };

  const onDropToSelected = () => {
    if (!dragItem.current || selectedCols.includes(dragItem.current)) return;
    setSelectedCols((prev) => [...prev, dragItem.current!]);
    dragItem.current = null;
  };

  const onDropReorder = () => {
    if (!dragItem.current || !dragOver.current || dragItem.current === dragOver.current) return;
    setSelectedCols((prev) => {
      const arr = [...prev];
      const from = arr.indexOf(dragItem.current!);
      const to = arr.indexOf(dragOver.current!);
      if (from === -1 || to === -1) return prev;
      arr.splice(from, 1);
      arr.splice(to, 0, dragItem.current!);
      return arr;
    });
    dragItem.current = null;
    dragOver.current = null;
  };

  const removeCol = (id: string) => setSelectedCols((p) => p.filter((c) => c !== id));

  const handleExport = async () => {
    const params = new URLSearchParams({
      columns: selectedCols.join(","),
      format,
      ...(filterDept && { department: filterDept }),
      ...(filterStatus !== "ALL" && { status: filterStatus }),
    });
    const ext = format === "excel" ? "xlsx" : "csv";
    const url = format === "excel" ? `/api/export/excel?${params}` : `/api/export/csv?${params}`;
    toast.loading("Building custom report…");
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const href = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = href; a.download = `${reportName.replace(/\s+/g, "_")}.${ext}`; a.click();
      URL.revokeObjectURL(href);
      toast.dismiss(); toast.success("Report downloaded!");
    } catch { toast.dismiss(); toast.error("Export failed"); }
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-3">
        <div className="flex-1 space-y-1">
          <Label className="text-xs">Report Name</Label>
          <Input value={reportName} onChange={(e) => setReportName(e.target.value)} className="h-8 text-sm" />
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Format</Label>
          <Select value={format} onValueChange={(v) => v && setFormat(v as "excel" | "csv")}>
            <SelectTrigger className="w-28 h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="excel">Excel (.xlsx)</SelectItem>
              <SelectItem value="csv">CSV</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <Label className="text-xs">Filter Status</Label>
          <Select value={filterStatus} onValueChange={(v) => v && setFilterStatus(v)}>
            <SelectTrigger className="w-32 h-8 text-xs"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL">All</SelectItem>
              {["DRAFT","SUBMITTED","APPROVED","LOCKED","REJECTED","RETURNED","CANCELLED"].map((s) =>
                <SelectItem key={s} value={s}>{s}</SelectItem>
              )}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Available columns */}
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-2">Available Columns</p>
          <div className="border rounded-lg p-2 min-h-32 space-y-1 bg-muted/20"
            onDragOver={(e) => e.preventDefault()}
            onDrop={() => {
              if (dragItem.current && selectedCols.includes(dragItem.current)) {
                removeCol(dragItem.current);
              }
            }}>
            {available.length === 0
              ? <p className="text-xs text-muted-foreground text-center py-4">All columns selected</p>
              : available.map((col) => (
                <div key={col.id} draggable onDragStart={() => onDragStart(col.id)}
                  className="flex items-center gap-2 px-2 py-1.5 rounded bg-background border text-xs cursor-grab hover:border-primary transition-colors">
                  <GripVertical className="w-3 h-3 text-muted-foreground" />
                  {col.label}
                </div>
              ))}
          </div>
        </div>

        {/* Selected columns (reorderable) */}
        <div>
          <p className="text-xs font-medium text-muted-foreground mb-2">Report Columns (drag to reorder)</p>
          <div className="border-2 border-dashed border-primary/30 rounded-lg p-2 min-h-32 space-y-1 bg-primary/5"
            onDragOver={(e) => e.preventDefault()}
            onDrop={onDropToSelected}>
            {selectedCols.length === 0
              ? <p className="text-xs text-muted-foreground text-center py-4">Drag columns here</p>
              : selectedCols.map((id) => {
                const col = ALL_COLUMNS.find((c) => c.id === id)!;
                return (
                  <div key={id} draggable
                    onDragStart={() => onDragStart(id)}
                    onDragEnter={() => onDragEnter(id)}
                    onDragEnd={onDropReorder}
                    onDragOver={(e) => e.preventDefault()}
                    className="flex items-center gap-2 px-2 py-1.5 rounded bg-background border border-primary/20 text-xs cursor-grab hover:border-primary transition-colors">
                    <GripVertical className="w-3 h-3 text-muted-foreground" />
                    <span className="flex-1">{col?.label}</span>
                    <button onClick={() => removeCol(id)} className="text-muted-foreground hover:text-destructive">
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                );
              })}
          </div>
        </div>
      </div>

      <Button onClick={handleExport} disabled={selectedCols.length === 0} className="gap-2">
        <Download className="w-4 h-4" />
        Export Custom Report ({selectedCols.length} columns)
      </Button>
    </div>
  );
}

// ─── Scheduled Reports ────────────────────────────────────────────────────────

type ScheduledReport = {
  id: string; name: string; schedule: string; recipients: string[];
  format: string; columns: string[]; createdAt: string;
};

const SCHEDULE_LABELS: Record<string, string> = {
  "0 9 * * 1": "Weekly (Mon 9 AM)",
  "0 9 * * *": "Daily (9 AM)",
  "0 9 1 * *": "Monthly (1st, 9 AM)",
};

function ScheduledReports() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    name: "", schedule: "0 9 * * 1", recipients: "", format: "excel" as "excel" | "csv",
    columns: ["employeeName", "goalTitle", "latestScore"],
  });

  const { data: reports = [] } = useQuery<ScheduledReport[]>({
    queryKey: ["scheduled-reports"],
    queryFn: () => fetch("/api/scheduled-reports").then((r) => r.json()),
  });

  const create = useMutation({
    mutationFn: () => fetch("/api/scheduled-reports", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        recipients: form.recipients.split(",").map((e) => e.trim()).filter(Boolean),
      }),
    }).then((r) => r.json()),
    onSuccess: (data) => {
      if (data.error) { toast.error(JSON.stringify(data.error)); return; }
      toast.success("Scheduled report created");
      setOpen(false);
      qc.invalidateQueries({ queryKey: ["scheduled-reports"] });
    },
    onError: () => toast.error("Failed to create scheduled report"),
  });

  const remove = useMutation({
    mutationFn: (id: string) => fetch(`/api/scheduled-reports?id=${id}`, { method: "DELETE" }).then((r) => r.json()),
    onSuccess: () => { toast.success("Deleted"); qc.invalidateQueries({ queryKey: ["scheduled-reports"] }); },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">Automatically email reports to HR and stakeholders on a schedule.</p>
        <Button size="sm" variant="outline" onClick={() => setOpen(!open)}>
          <Plus className="w-3.5 h-3.5 mr-1" />Add Schedule
        </Button>
      </div>

      {open && (
        <Card className="border-dashed">
          <CardContent className="pt-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Report Name</Label>
                <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="Weekly Goal Summary" className="h-8 text-sm" />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Schedule</Label>
                <Select value={form.schedule} onValueChange={(v) => v && setForm((f) => ({ ...f, schedule: v }))}>
                  <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(SCHEDULE_LABELS).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">Recipients (comma-separated emails)</Label>
              <Input value={form.recipients} onChange={(e) => setForm((f) => ({ ...f, recipients: e.target.value }))}
                placeholder="hr@atomberg.com, ceo@atomberg.com" className="h-8 text-sm" />
            </div>
            <div className="flex gap-3">
              <div className="space-y-1">
                <Label className="text-xs">Format</Label>
                <Select value={form.format} onValueChange={(v) => v && setForm((f) => ({ ...f, format: v as "excel" | "csv" }))}>
                  <SelectTrigger className="w-28 h-8 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="excel">Excel</SelectItem>
                    <SelectItem value="csv">CSV</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button size="sm" className="mt-auto" onClick={() => create.mutate()} disabled={!form.name || !form.recipients || create.isPending}>
                Save Schedule
              </Button>
              <Button size="sm" variant="ghost" className="mt-auto" onClick={() => setOpen(false)}>Cancel</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {reports.length === 0 ? (
        <div className="text-center py-8 text-sm text-muted-foreground">
          <Mail className="w-8 h-8 mx-auto mb-2 text-muted-foreground" />
          No scheduled reports yet
        </div>
      ) : (
        <div className="space-y-2">
          {reports.map((r) => (
            <div key={r.id} className="flex items-center gap-3 p-3 border rounded-lg">
              <Mail className="w-4 h-4 text-muted-foreground flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium">{r.name}</p>
                <p className="text-xs text-muted-foreground">
                  {SCHEDULE_LABELS[r.schedule] ?? r.schedule} · {r.recipients.join(", ")} · {r.format.toUpperCase()}
                </p>
              </div>
              <button onClick={() => remove.mutate(r.id)} className="text-muted-foreground hover:text-destructive flex-shrink-0">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

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

      {/* Custom Report Builder */}
      <div>
        <CardHeader className="px-0 pt-0 pb-3">
          <CardTitle className="text-base text-foreground flex items-center gap-2">
            <Settings2 className="w-4 h-4 text-slate-500" />
            Custom Report Builder
          </CardTitle>
        </CardHeader>
        <Card>
          <CardContent className="pt-5">
            <p className="text-sm text-muted-foreground mb-4">
              Drag and drop columns to build a custom report. Reorder columns by dragging within the selection area.
            </p>
            <CustomReportBuilder />
          </CardContent>
        </Card>
      </div>

      {/* Scheduled Reports */}
      <div>
        <CardHeader className="px-0 pt-0 pb-3">
          <CardTitle className="text-base text-foreground flex items-center gap-2">
            <Mail className="w-4 h-4 text-slate-500" />
            Scheduled Report Emails
          </CardTitle>
        </CardHeader>
        <Card>
          <CardContent className="pt-5">
            <ScheduledReports />
          </CardContent>
        </Card>
      </div>

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
