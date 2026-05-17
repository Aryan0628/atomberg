// Manager Approvals — with bulk select, Approve Selected, Return Selected
"use client";

import { useGoals, useApproveGoal } from "@/hooks/useGoals";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { Check, X, RotateCcw, CheckSquare, BarChart2, Loader2, ChevronDown, ChevronUp } from "lucide-react";
import { AiAnalysisPanel, type AiResult } from "@/components/goals/AiAnalysisPanel";
import { useState, useCallback } from "react";
import { getUoMLabel, formatRelativeTime } from "@/lib/utils";

export default function ManagerApprovalsPage() {
  const { data: goals, isLoading } = useGoals();
  const approveGoal = useApproveGoal();
  const queryClient = useQueryClient();

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [aiResults, setAiResults] = useState<Record<string, { analyzing: boolean; result?: AiResult }>>({});
  const [aiExpanded, setAiExpanded] = useState<Set<string>>(new Set());

  const analyzeGoal = useCallback(async (goal: Record<string, unknown>) => {
    const id = goal.id as string;
    setAiResults((prev) => ({ ...prev, [id]: { analyzing: true } }));
    setAiExpanded((prev) => new Set([...prev, id]));
    try {
      const res = await fetch("/api/ai/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: goal.title, description: goal.description ?? "",
          uom_type: goal.uomType, target: goal.target ?? null,
          weightage: goal.weightage, thrust_area: goal.thrustArea,
        }),
      });
      const data: AiResult = await res.json();
      setAiResults((prev) => ({ ...prev, [id]: { analyzing: false, result: data } }));
    } catch {
      setAiResults((prev) => ({ ...prev, [id]: { analyzing: false } }));
      toast.error("AI analysis failed");
    }
  }, []);
  const [rejectDialog, setRejectDialog] = useState<{ open: boolean; goalId: string; goalTitle: string }>({ open: false, goalId: "", goalTitle: "" });
  const [returnDialog, setReturnDialog] = useState<{ open: boolean; goalId: string; goalTitle: string; bulk?: boolean }>({ open: false, goalId: "", goalTitle: "" });
  const [reason, setReason] = useState("");

  const pendingGoals = (goals || []).filter((g: Record<string, unknown>) => g.status === "SUBMITTED");

  // Bulk approve — calls approve endpoint for each selected goal in parallel
  const bulkApproveMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      await Promise.all(ids.map((id) =>
        fetch(`/api/goals/${id}/approve`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "APPROVE" }),
        })
      ));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["goals"] });
      toast.success(`${selected.size} goals approved`);
      setSelected(new Set());
    },
    onError: () => toast.error("Bulk approve failed"),
  });

  // Bulk return
  const bulkReturnMutation = useMutation({
    mutationFn: async ({ ids, returnReason }: { ids: string[]; returnReason: string }) => {
      await Promise.all(ids.map((id) =>
        fetch(`/api/goals/${id}/approve`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "RETURN", returnReason }),
        })
      ));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["goals"] });
      toast.success(`${selected.size} goals returned for rework`);
      setSelected(new Set());
      setReturnDialog({ open: false, goalId: "", goalTitle: "" });
      setReason("");
    },
    onError: () => toast.error("Bulk return failed"),
  });

  function toggleSelect(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function toggleAll() {
    if (selected.size === pendingGoals.length) {
      setSelected(new Set());
    } else {
      setSelected(new Set(pendingGoals.map((g: Record<string, unknown>) => g.id as string)));
    }
  }

  const handleApprove = async (goalId: string) => {
    try {
      await approveGoal.mutateAsync({ id: goalId, action: "APPROVE" });
      toast.success("Goal approved!");
    } catch (err: unknown) {
      toast.error((err as Error).message);
    }
  };

  const handleReject = async () => {
    try {
      await approveGoal.mutateAsync({ id: rejectDialog.goalId, action: "REJECT", rejectReason: reason });
      toast.success("Goal rejected");
      setRejectDialog({ open: false, goalId: "", goalTitle: "" });
      setReason("");
    } catch (err: unknown) {
      toast.error((err as Error).message);
    }
  };

  const handleReturn = async () => {
    if (returnDialog.bulk) {
      bulkReturnMutation.mutate({ ids: Array.from(selected), returnReason: reason });
    } else {
      try {
        await approveGoal.mutateAsync({ id: returnDialog.goalId, action: "RETURN", returnReason: reason });
        toast.success("Goal returned for rework");
        setReturnDialog({ open: false, goalId: "", goalTitle: "" });
        setReason("");
      } catch (err: unknown) {
        toast.error((err as Error).message);
      }
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-48" />
        {[1, 2, 3].map((i) => <Skeleton key={i} className="h-28" />)}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Approval Queue</h1>
          <p className="text-sm text-slate-500 mt-1">{pendingGoals.length} goal(s) awaiting your review</p>
        </div>
        <div className="flex items-center gap-2">
          {selected.size > 0 && (
            <>
              <Button size="sm" className="gap-1 bg-green-600 hover:bg-green-700"
                onClick={() => bulkApproveMutation.mutate(Array.from(selected))}
                disabled={bulkApproveMutation.isPending}>
                <Check className="w-3 h-3" /> Approve {selected.size} Selected
              </Button>
              <Button size="sm" variant="outline" className="gap-1 text-amber-600 border-amber-200"
                onClick={() => setReturnDialog({ open: true, goalId: "", goalTitle: `${selected.size} goals`, bulk: true })}>
                <RotateCcw className="w-3 h-3" /> Return {selected.size} Selected
              </Button>
            </>
          )}
          {pendingGoals.length > 0 && (
            <Button size="sm" variant="outline" onClick={toggleAll} className="gap-1">
              <CheckSquare className="w-3 h-3" />
              {selected.size === pendingGoals.length ? "Deselect All" : "Select All"}
            </Button>
          )}
        </div>
      </div>

      {pendingGoals.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center py-12">
            <Check className="w-12 h-12 text-green-400 mb-4" />
            <p className="text-lg font-medium text-slate-600">All caught up!</p>
            <p className="text-sm text-slate-400">No goals awaiting approval</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {pendingGoals.map((goal: Record<string, unknown>) => {
            const isSelected = selected.has(goal.id as string);
            return (
              <Card key={goal.id as string}
                className={`transition-all ${isSelected ? "border-blue-400 dark:border-blue-600 shadow-sm" : "hover:shadow-md"}`}>
                <CardContent className="p-5">
                  <div className="flex items-start gap-4">
                    {/* Checkbox */}
                    <Checkbox
                      checked={isSelected}
                      onCheckedChange={() => toggleSelect(goal.id as string)}
                      className="mt-1 flex-shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-4 flex-wrap">
                        <div>
                          <div className="flex items-center gap-2 flex-wrap">
                            <h3 className="font-semibold text-base">{goal.title as string}</h3>
                            {/* Quality score badge */}
                            {aiResults[goal.id as string]?.result && (
                              <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold tabular-nums ${
                                aiResults[goal.id as string].result!.overall_score >= 8 ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400"
                                : aiResults[goal.id as string].result!.overall_score >= 6 ? "bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-400"
                                : "bg-red-50 text-red-700 dark:bg-red-500/15 dark:text-red-400"}`}>
                                {aiResults[goal.id as string].result!.overall_score}/10
                              </span>
                            )}
                          </div>
                          {!!goal.description && (
                            <p className="text-sm text-slate-500 mt-0.5 line-clamp-1">{String(goal.description)}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <Button size="sm" variant="outline" className="text-green-600 border-green-200 hover:bg-green-50"
                            onClick={() => handleApprove(goal.id as string)} disabled={approveGoal.isPending}>
                            <Check className="w-3.5 h-3.5 mr-1" /> Approve
                          </Button>
                          <Button size="sm" variant="outline" className="text-amber-600 border-amber-200 hover:bg-amber-50"
                            onClick={() => setReturnDialog({ open: true, goalId: goal.id as string, goalTitle: goal.title as string })}>
                            <RotateCcw className="w-3.5 h-3.5 mr-1" /> Return
                          </Button>
                          <Button size="sm" variant="outline" className="text-red-600 border-red-200 hover:bg-red-50"
                            onClick={() => setRejectDialog({ open: true, goalId: goal.id as string, goalTitle: goal.title as string })}>
                            <X className="w-3.5 h-3.5 mr-1" /> Reject
                          </Button>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 flex-wrap text-xs text-slate-500 mt-2">
                        <span className="font-medium text-slate-700 dark:text-slate-300">
                          {((goal.owner as Record<string, unknown>)?.name as string) || "Unknown"}
                        </span>
                        <span>·</span>
                        <span>{goal.thrustArea as string}</span>
                        <span>·</span>
                        <span>{getUoMLabel(goal.uomType as string)}</span>
                        {!!goal.target && (
                          <>
                            <span>·</span>
                            <span>Target: {Number(goal.target)} {String(goal.uomUnit ?? "")}</span>
                          </>
                        )}
                        <span>·</span>
                        <span className="font-medium">{goal.weightage as number}% weight</span>
                        {!!goal.submittedAt && (
                          <>
                            <span>·</span>
                            <span>Submitted {formatRelativeTime(goal.submittedAt as string)}</span>
                          </>
                        )}
                        {Number(goal.reworkCount) > 0 && (
                          <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-300">
                            Rework #{goal.reworkCount as number}
                          </Badge>
                        )}
                      </div>

                      {/* AI Analysis — toggle button + expandable panel */}
                      <div className="mt-3 border border-purple-100 dark:border-purple-900/50 rounded-lg overflow-hidden">
                        <button
                          type="button"
                          onClick={() => {
                            const id = goal.id as string;
                            if (!aiResults[id]) {
                              analyzeGoal(goal);
                            } else {
                              setAiExpanded((prev) => {
                                const next = new Set(prev);
                                if (next.has(id)) next.delete(id); else next.add(id);
                                return next;
                              });
                            }
                          }}
                          className="w-full flex items-center justify-between px-3 py-2 bg-slate-50 dark:bg-white/[0.03] hover:bg-slate-100 dark:hover:bg-white/[0.05] transition-colors text-xs font-semibold text-slate-600 dark:text-slate-400"
                        >
                          <span className="flex items-center gap-1.5">
                            <BarChart2 className="w-3.5 h-3.5" />
                            {aiResults[goal.id as string]?.analyzing
                              ? "Checking quality…"
                              : aiResults[goal.id as string]?.result
                              ? "Quality Analysis"
                              : "Check quality"}
                          </span>
                          {aiResults[goal.id as string]?.analyzing
                            ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            : aiResults[goal.id as string]?.result
                            ? (aiExpanded.has(goal.id as string)
                              ? <ChevronUp className="w-3.5 h-3.5" />
                              : <ChevronDown className="w-3.5 h-3.5" />)
                            : <BarChart2 className="w-3.5 h-3.5 opacity-30" />}
                        </button>
                        {aiExpanded.has(goal.id as string) && aiResults[goal.id as string]?.result && (
                          <div className="p-4 border-t border-slate-100 dark:border-white/[0.06]">
                            <AiAnalysisPanel result={aiResults[goal.id as string].result!} />
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Reject Dialog */}
      <Dialog open={rejectDialog.open} onOpenChange={(o) => setRejectDialog({ ...rejectDialog, open: o })}>
        <DialogContent>
          <DialogHeader><DialogTitle>Reject: &quot;{rejectDialog.goalTitle}&quot;</DialogTitle></DialogHeader>
          <div className="space-y-4">
            <Textarea placeholder="Reason for rejection (min 10 chars)..." value={reason} onChange={(e) => setReason(e.target.value)} rows={3} />
            <Button onClick={handleReject} disabled={reason.length < 10 || approveGoal.isPending} className="w-full bg-red-600 hover:bg-red-700">
              Confirm Rejection
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Return Dialog (single + bulk) */}
      <Dialog open={returnDialog.open} onOpenChange={(o) => setReturnDialog({ ...returnDialog, open: o })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Return for Rework: {returnDialog.goalTitle}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <Textarea placeholder="Reason for returning (min 10 chars)..." value={reason} onChange={(e) => setReason(e.target.value)} rows={3} />
            <Button
              onClick={handleReturn}
              disabled={reason.length < 10 || approveGoal.isPending || bulkReturnMutation.isPending}
              className="w-full bg-amber-600 hover:bg-amber-700">
              {bulkReturnMutation.isPending ? "Returning..." : "Confirm Return"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
