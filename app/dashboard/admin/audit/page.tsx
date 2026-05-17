// Admin Audit Trail page
"use client";

import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Shield, ChevronLeft, ChevronRight, ShieldCheck, ShieldAlert, Loader2, ChevronDown } from "lucide-react";
import { useState } from "react";
import { formatDateTime } from "@/lib/utils";
import { useMutation } from "@tanstack/react-query";
import { toast } from "sonner";

const FIELD_LABELS: Record<string, string> = {
  status: "Status", score: "Score", quarter: "Quarter", progressStatus: "Progress",
  count: "Count", title: "Title", weightage: "Weightage", target: "Target",
  rejectReason: "Reject Reason", returnReason: "Return Reason", trigger: "Trigger",
  escalateTo: "Escalate To", lockedCount: "Locked", content: "Content",
  isInternal: "Internal", cycleId: "Cycle", templateId: "Template",
};

function formatValue(key: string, val: unknown): string {
  if (val === null || val === undefined) return "—";
  if (typeof val === "boolean") return val ? "Yes" : "No";
  if (typeof val === "number") return String(val);
  if (typeof val === "string") return val.replace(/_/g, " ");
  return String(val);
}

function AuditDetails({ value }: { value: unknown }) {
  const [expanded, setExpanded] = useState(false);
  if (!value || typeof value !== "object") return <span className="text-slate-400">—</span>;

  const entries = Object.entries(value as Record<string, unknown>).filter(
    ([k]) => !["cycleId", "entityId"].includes(k)
  );
  const visible = expanded ? entries : entries.slice(0, 2);

  return (
    <div className="flex flex-wrap items-center gap-1">
      {visible.map(([k, v]) => (
        <span key={k} className="inline-flex items-center gap-1 rounded-md bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 text-xs">
          <span className="text-slate-400">{FIELD_LABELS[k] ?? k}:</span>
          <span className="font-medium text-slate-700 dark:text-slate-200 max-w-[120px] truncate">{formatValue(k, v)}</span>
        </span>
      ))}
      {entries.length > 2 && (
        <button onClick={() => setExpanded(e => !e)} className="text-xs text-blue-500 hover:underline flex items-center gap-0.5">
          {expanded ? "less" : `+${entries.length - 2} more`}
          <ChevronDown className={`w-3 h-3 transition-transform ${expanded ? "rotate-180" : ""}`} />
        </button>
      )}
    </div>
  );
}

const actionColors: Record<string, string> = {
  GOAL_CREATED: "bg-blue-100 text-blue-700",
  GOAL_SUBMITTED: "bg-indigo-100 text-indigo-700",
  GOAL_APPROVED: "bg-green-100 text-green-700",
  GOAL_REJECTED: "bg-red-100 text-red-700",
  GOAL_RETURNED: "bg-amber-100 text-amber-700",
  CHECKIN_SUBMITTED: "bg-purple-100 text-purple-700",
  TARGET_EDITED: "bg-orange-100 text-orange-700",
  WEIGHTAGE_EDITED: "bg-pink-100 text-pink-700",
  ESCALATION_SENT: "bg-yellow-100 text-yellow-700",
  GOALS_AUTO_LOCKED: "bg-slate-100 text-slate-700",
  USER_CREATED: "bg-cyan-100 text-cyan-700",
  CYCLE_CREATED: "bg-teal-100 text-teal-700",
  EXPORT_GENERATED: "bg-lime-100 text-lime-700",
};

export default function AdminAuditPage() {
  const [page, setPage] = useState(1);
  const [actionFilter, setActionFilter] = useState("ALL");
  const [verifyResult, setVerifyResult] = useState<{ valid: boolean; totalEntries: number; firstTamperedId?: string; firstTamperedAction?: string } | null>(null);

  const verifyChain = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/audit/verify");
      if (!res.ok) throw new Error("Verification failed");
      return res.json();
    },
    onSuccess: (result) => {
      setVerifyResult(result);
      if (result.valid) toast.success(`Chain intact — ${result.totalEntries} entries verified`);
      else toast.error(`Tamper detected at entry ${result.firstTamperedId?.slice(0, 8)}...`);
    },
    onError: () => toast.error("Verification request failed"),
  });

  const { data, isLoading } = useQuery({
    queryKey: ["audit", page, actionFilter],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), pageSize: "15" });
      if (actionFilter !== "ALL") params.set("action", actionFilter);
      const res = await fetch(`/api/audit?${params}`);
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
  });

  const logs = data?.data || [];
  const totalPages = data?.totalPages || 1;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Shield className="w-6 h-6 text-slate-600" />
          <h1 className="text-2xl font-bold">Audit Trail</h1>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="outline">{data?.total || 0} total entries</Badge>
          <Button
            size="sm"
            variant="outline"
            className="gap-2"
            onClick={() => verifyChain.mutate()}
            disabled={verifyChain.isPending}
          >
            {verifyChain.isPending
              ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
              : <ShieldCheck className="w-3.5 h-3.5" />}
            Verify Chain Integrity
          </Button>
        </div>
      </div>

      {/* Chain verification result banner */}
      {verifyResult && (
        <div className={`flex items-center gap-3 p-3 rounded-lg border text-sm ${
          verifyResult.valid
            ? "bg-green-50 border-green-200 text-green-800 dark:bg-green-950/40 dark:border-green-800 dark:text-green-300"
            : "bg-red-50 border-red-200 text-red-800 dark:bg-red-950/40 dark:border-red-800 dark:text-red-300"
        }`}>
          {verifyResult.valid
            ? <ShieldCheck className="w-4 h-4 flex-shrink-0" />
            : <ShieldAlert className="w-4 h-4 flex-shrink-0" />}
          {verifyResult.valid
            ? `Chain intact — all ${verifyResult.totalEntries} entries verified. No tampering detected.`
            : `Tamper detected! Entry ${verifyResult.firstTamperedId?.slice(0, 12)}... (${verifyResult.firstTamperedAction}) has an invalid hash. Database may have been edited directly.`}
        </div>
      )}

      {/* Filters */}
      <div className="flex items-center gap-3">
        <Select value={actionFilter} onValueChange={(v) => { setActionFilter(v || "ALL"); setPage(1); }}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Filter by action" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Actions</SelectItem>
            {Object.keys(actionColors).map((action) => (
              <SelectItem key={action} value={action}>{action.replace(/_/g, " ")}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Audit Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800">
                  <th className="text-left p-4 text-xs font-medium text-slate-500 uppercase">Timestamp</th>
                  <th className="text-left p-4 text-xs font-medium text-slate-500 uppercase">User</th>
                  <th className="text-left p-4 text-xs font-medium text-slate-500 uppercase">Action</th>
                  <th className="text-left p-4 text-xs font-medium text-slate-500 uppercase">Entity</th>
                  <th className="text-left p-4 text-xs font-medium text-slate-500 uppercase">Details</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  [1, 2, 3, 4, 5].map((i) => (
                    <tr key={i}><td colSpan={5} className="p-4"><Skeleton className="h-8" /></td></tr>
                  ))
                ) : logs.length === 0 ? (
                  <tr><td colSpan={5} className="p-8 text-center text-slate-400">No audit logs found</td></tr>
                ) : (
                  logs.map((log: Record<string, unknown>) => (
                    <tr key={log.id as string} className="border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900">
                      <td className="p-4 text-xs text-slate-500 whitespace-nowrap">{formatDateTime(log.createdAt as string)}</td>
                      <td className="p-4 text-sm">{(log.user as Record<string, unknown>)?.name as string || log.userId as string}</td>
                      <td className="p-4">
                        <Badge className={`text-xs ${actionColors[log.action as string] || "bg-slate-100 text-slate-700"}`}>
                          {(log.action as string).replace(/_/g, " ")}
                        </Badge>
                      </td>
                      <td className="p-4 text-sm">
                        {String(log.entityType ?? "")}
                        {!!((log.goal as Record<string, unknown>)?.title) && (
                          <span className="text-xs text-slate-400 ml-1">({String((log.goal as Record<string, unknown>).title)})</span>
                        )}
                      </td>
                      <td className="p-4 max-w-[260px]">
                        <AuditDetails value={log.newValue ?? log.oldValue} />
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Pagination */}
      <div className="flex items-center justify-center gap-2">
        <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}>
          <ChevronLeft className="w-4 h-4" />
        </Button>
        <span className="text-sm text-slate-500">Page {page} of {totalPages}</span>
        <Button variant="outline" size="sm" onClick={() => setPage(p => p + 1)} disabled={page >= totalPages}>
          <ChevronRight className="w-4 h-4" />
        </Button>
      </div>
    </div>
  );
}
