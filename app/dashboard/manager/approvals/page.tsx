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

  // Bulk approve
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
        <Skeleton className="h-10 w-48 rounded-lg" />
        {[1, 2, 3].map((i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Approval Queue</h1>
          <p className="text-sm text-muted-foreground mt-1">{pendingGoals.length} goal(s) awaiting your review</p>
        </div>
        <div className="flex items-center gap-3">
          {selected.size > 0 && (
            <>
              <Button size="sm" className="gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white"
                onClick={() => bulkApproveMutation.mutate(Array.from(selected))}
                disabled={bulkApproveMutation.isPending}>
                <Check className="w-4 h-4" /> Approve {selected.size} Selected
              </Button>
              <Button size="sm" variant="outline" className="gap-1.5 text-amber-600 border-amber-500/30 hover:bg-amber-500/10"
                onClick={() => setReturnDialog({ open: true, goalId: "", goalTitle: `${selected.size} goals`, bulk: true })}>
                <RotateCcw className="w-4 h-4" /> Return {selected.size} Selected
              </Button>
            </>
          )}
          {pendingGoals.length > 0 && (
            <Button size="sm" variant="outline" onClick={toggleAll} className="gap-1.5">
              <CheckSquare className="w-4 h-4" />
              {selected.size === pendingGoals.length ? "Deselect All" : "Select All"}
            </Button>
          )}
        </div>
      </div>

      {pendingGoals.length === 0 ? (
        <Card className="border-border shadow-sm">
          <CardContent className="flex flex-col items-center py-16">
            <Check className="w-12 h-12 text-emerald-500 mb-4 opacity-50" />
            <p className="text-lg font-semibold text-foreground">All caught up!</p>
            <p className="text-sm text-muted-foreground">No goals awaiting approval</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {pendingGoals.map((goal: Record<string, unknown>) => {
            const isSelected = selected.has(goal.id as string);
            return (
              <Card key={goal.id as string}
                className={`transition-all shadow-sm ${isSelected ? "border-primary ring-1 ring-primary" : "border-border hover:shadow-md hover:border-primary/50"}`}>
                <CardContent className="p-6">
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
                          <div className="flex items-center gap-3 flex-wrap">
                            <h3 className="font-semibold text-base text-foreground leading-snug">{goal.title as string}</h3>
                            {/* Quality score badge */}
                            {aiResults[goal.id as string]?.result && (
                              <span className={`text-[10px] px-2 py-0.5 rounded font-semibold tabular-nums ${
                                aiResults[goal.id as string].result!.overall_score >= 8 ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                                : aiResults[goal.id as string].result!.overall_score >= 6 ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                                : "bg-destructive/10 text-destructive"}`}>
                                {aiResults[goal.id as string].result!.overall_score}/10
                              </span>
                            )}
                          </div>
                          {!!goal.description && (
                            <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{String(goal.description)}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <Button size="sm" variant="outline" className="text-emerald-600 border-emerald-500/30 hover:bg-emerald-500/10 hover:text-emerald-600"
                            onClick={() => handleApprove(goal.id as string)} disabled={approveGoal.isPending}>
                            <Check className="w-3.5 h-3.5 mr-1" /> Approve
                          </Button>
                          <Button size="sm" variant="outline" className="text-amber-600 border-amber-500/30 hover:bg-amber-500/10 hover:text-amber-600"
                            onClick={() => setReturnDialog({ open: true, goalId: goal.id as string, goalTitle: goal.title as string })}>
                            <RotateCcw className="w-3.5 h-3.5 mr-1" /> Return
                          </Button>
                          <Button size="sm" variant="outline" className="text-destructive border-destructive/30 hover:bg-destructive/10 hover:text-destructive"
                            onClick={() => setRejectDialog({ open: true, goalId: goal.id as string, goalTitle: goal.title as string })}>
                            <X className="w-3.5 h-3.5 mr-1" /> Reject
                          </Button>
                        </div>
                      </div>

                      <div className="flex items-center gap-3 flex-wrap text-xs text-muted-foreground mt-3">
                        <span className="font-semibold text-foreground">
                          {((goal.owner as Record<string, unknown>)?.name as string) || "Unknown"}
                        </span>
                        <span className="opacity-50">·</span>
                        <span className="font-medium">{goal.thrustArea as string}</span>
                        <span className="opacity-50">·</span>
                        <span className="bg-muted px-1.5 py-0.5 rounded font-medium">{getUoMLabel(goal.uomType as string)}</span>
                        {!!goal.target && (
                          <>
                            <span className="opacity-50">·</span>
                            <span className="font-medium">Target: {Number(goal.target)} {String(goal.uomUnit ?? "")}</span>
                          </>
                        )}
                        <span className="opacity-50">·</span>
                        <span className="font-semibold text-foreground">{goal.weightage as number}% weight</span>
                        {!!goal.submittedAt && (
                          <>
                            <span className="opacity-50">·</span>
                            <span>Submitted {formatRelativeTime(goal.submittedAt as string)}</span>
                          </>
                        )}
                        {Number(goal.reworkCount) > 0 && (
                          <Badge variant="outline" className="text-[10px] text-amber-600 border-amber-500/30 font-medium">
                            Rework #{goal.reworkCount as number}
                          </Badge>
                        )}
                      </div>

                      {/* AI Analysis — toggle button + expandable panel */}
                      <div className="mt-4 border border-border rounded-xl overflow-hidden">
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
                          className="w-full flex items-center justify-between px-4 py-3 bg-muted/30 hover:bg-muted/50 transition-colors text-xs font-semibold text-muted-foreground hover:text-foreground"
                        >
                          <span className="flex items-center gap-2">
                            <BarChart2 className="w-4 h-4" />
                            {aiResults[goal.id as string]?.analyzing
                              ? "Checking quality…"
                              : aiResults[goal.id as string]?.result
                              ? "Quality Analysis"
                              : "Check quality"}
                          </span>
                          {aiResults[goal.id as string]?.analyzing
                            ? <Loader2 className="w-4 h-4 animate-spin" />
                            : aiResults[goal.id as string]?.result
                            ? (aiExpanded.has(goal.id as string)
                              ? <ChevronUp className="w-4 h-4" />
                              : <ChevronDown className="w-4 h-4" />)
                            : <BarChart2 className="w-4 h-4 opacity-30" />}
                        </button>
                        {aiExpanded.has(goal.id as string) && aiResults[goal.id as string]?.result && (
                          <div className="p-5 border-t border-border bg-card">
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
            <Button onClick={handleReject} disabled={reason.length < 10 || approveGoal.isPending} className="w-full">
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
              className="w-full">
              {bulkReturnMutation.isPending ? "Returning..." : "Confirm Return"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
