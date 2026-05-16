// Admin Escalation Dashboard — configure rules + view logs + manual trigger
"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertTriangle, Plus, Play, Trash2, Mail, CheckCircle } from "lucide-react";
import { formatDateTime } from "@/lib/utils";
import { toast } from "sonner";

function useEscalationRules() {
  return useQuery({
    queryKey: ["escalation-rules"],
    queryFn: async () => {
      const res = await fetch("/api/escalations/rules");
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    staleTime: 30_000,
  });
}

function useEscalationLogs() {
  return useQuery({
    queryKey: ["escalation-logs"],
    queryFn: async () => {
      const res = await fetch("/api/escalations?limit=50");
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    staleTime: 30_000,
  });
}

const TRIGGER_LABELS: Record<string, string> = {
  GOAL_NOT_SUBMITTED: "Goal Not Submitted",
  GOAL_NOT_APPROVED: "Goal Not Approved",
  CHECKIN_NOT_COMPLETED: "Check-in Not Completed",
};

const ESCALATE_TO_LABELS: Record<string, string> = {
  EMPLOYEE: "Employee",
  MANAGER: "Manager",
  SKIP_LEVEL: "Skip Level",
  HR: "HR",
};

export default function AdminEscalationsPage() {
  const { data: rulesData, isLoading: rulesLoading } = useEscalationRules();
  const { data: logs, isLoading: logsLoading } = useEscalationLogs();
  const [showAddRule, setShowAddRule] = useState(false);
  const [newRule, setNewRule] = useState({ trigger: "GOAL_NOT_SUBMITTED", daysAfterTrigger: "7", escalateTo: "EMPLOYEE" });
  const queryClient = useQueryClient();

  const addRuleMutation = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const res = await fetch("/api/escalations/rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) { const err = await res.json(); throw new Error(err.error || "Failed"); }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["escalation-rules"] });
      toast.success("Escalation rule added");
      setShowAddRule(false);
      setNewRule({ trigger: "GOAL_NOT_SUBMITTED", daysAfterTrigger: "7", escalateTo: "EMPLOYEE" });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteRuleMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/escalations/rules?id=${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["escalation-rules"] });
      toast.success("Rule deleted");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const runNowMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/notifications/escalate", { method: "POST" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["escalation-logs"] });
      toast.success(`Escalation engine ran — ${data.processed || 0} escalation(s) processed`);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Escalation Dashboard</h1>
          {rulesData?.cycleName && <p className="text-sm text-slate-500 mt-1">Active cycle: {rulesData.cycleName}</p>}
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            className="gap-2"
            onClick={() => runNowMutation.mutate()}
            disabled={runNowMutation.isPending}
          >
            <Play className="w-4 h-4" />
            {runNowMutation.isPending ? "Running..." : "Run Engine Now"}
          </Button>
          <Button className="gap-2" onClick={() => setShowAddRule(true)}>
            <Plus className="w-4 h-4" /> Add Rule
          </Button>
        </div>
      </div>

      {/* Rules */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-500" /> Escalation Rules
          </CardTitle>
        </CardHeader>
        <CardContent>
          {rulesLoading && <Skeleton className="h-24" />}
          {!rulesLoading && (!rulesData?.rules || rulesData.rules.length === 0) && (
            <p className="text-sm text-slate-400 py-4 text-center">No escalation rules configured. Add one to automate reminders.</p>
          )}
          <div className="space-y-2">
            {rulesData?.rules?.map((rule: Record<string, unknown>) => (
              <div key={rule.id as string} className="flex items-center justify-between p-3 rounded-lg border border-slate-200 dark:border-slate-800">
                <div className="flex items-center gap-3 flex-wrap">
                  <Badge variant="outline">{TRIGGER_LABELS[rule.trigger as string]}</Badge>
                  <span className="text-sm">after <strong>{rule.daysAfterTrigger as number} days</strong></span>
                  <span className="text-sm text-slate-500">→ notify</span>
                  <Badge className="bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                    {ESCALATE_TO_LABELS[rule.escalateTo as string]}
                  </Badge>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-red-500 hover:text-red-600"
                  onClick={() => deleteRuleMutation.mutate(rule.id as string)}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Logs */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Escalation Log</CardTitle>
        </CardHeader>
        <CardContent>
          {logsLoading && <Skeleton className="h-32" />}
          {!logsLoading && (!logs || logs.length === 0) && (
            <p className="text-sm text-slate-400 py-4 text-center">No escalations have been triggered yet.</p>
          )}
          <div className="space-y-2">
            {logs?.map((log: Record<string, unknown>) => {
              const user = log.user as Record<string, unknown>;
              return (
                <div key={log.id as string} className="flex items-center justify-between p-3 rounded-lg border border-slate-200 dark:border-slate-800">
                  <div className="flex items-center gap-3">
                    {log.resolvedAt
                      ? <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                      : <AlertTriangle className="w-4 h-4 text-amber-500 flex-shrink-0" />}
                    <div>
                      <p className="text-sm font-medium">{String(user?.name ?? "")}</p>
                      <p className="text-xs text-slate-400">
                        {TRIGGER_LABELS[log.trigger as string] || String(log.trigger)} → {ESCALATE_TO_LABELS[log.escalatedTo as string] || String(log.escalatedTo)}
                        {!!log.emailSent && <span className="ml-2 inline-flex items-center gap-0.5"><Mail className="w-3 h-3" /> sent</span>}
                      </p>
                    </div>
                  </div>
                  <p className="text-xs text-slate-400">{formatDateTime(log.createdAt as string)}</p>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Add Rule Dialog */}
      <Dialog open={showAddRule} onOpenChange={setShowAddRule}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Add Escalation Rule</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Trigger</Label>
              <Select value={newRule.trigger} onValueChange={(v) => v && setNewRule({ ...newRule, trigger: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(TRIGGER_LABELS).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Days After Trigger</Label>
              <Input
                type="number" min="1" max="90"
                value={newRule.daysAfterTrigger}
                onChange={(e) => setNewRule({ ...newRule, daysAfterTrigger: e.target.value })}
              />
            </div>
            <div className="space-y-2">
              <Label>Escalate To</Label>
              <Select value={newRule.escalateTo} onValueChange={(v) => v && setNewRule({ ...newRule, escalateTo: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(ESCALATE_TO_LABELS).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="flex gap-2">
              <Button
                className="flex-1"
                disabled={addRuleMutation.isPending}
                onClick={() => addRuleMutation.mutate({
                  trigger: newRule.trigger,
                  daysAfterTrigger: parseInt(newRule.daysAfterTrigger),
                  escalateTo: newRule.escalateTo,
                })}
              >
                {addRuleMutation.isPending ? "Adding..." : "Add Rule"}
              </Button>
              <Button variant="outline" onClick={() => setShowAddRule(false)}>Cancel</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
