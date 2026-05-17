// Employee Goals List — with filters, weightage meter, Browse Templates, and create form
"use client";

import { useGoals, useBulkSubmit, useCreateGoal } from "@/hooks/useGoals";
import { useCurrentCycle } from "@/hooks/useCycle";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Plus, Search, Send, Target, ArrowRight, BookTemplate, ChevronRight, BarChart2, Loader2 } from "lucide-react";
import { AiAnalysisPanel, type AiResult } from "@/components/goals/AiAnalysisPanel";
import { RedundancyWarning } from "@/components/goals/RedundancyWarning";
import Link from "next/link";
import { useState, useRef } from "react";
import type { RedundancyMatch } from "@/lib/ai-client";
import { getGoalStatusColor, getUoMLabel, getUoMColor, formatScore } from "@/lib/utils";
import { getScoreColor } from "@/lib/scoring";

const THRUST_AREAS = [
  "Sales Revenue", "Customer Experience", "Operational Excellence",
  "Safety & Compliance", "People Development", "Cost Efficiency",
  "Innovation", "Digital Transformation",
];

const UOM_TYPES = [
  { value: "NUMERIC_MIN", label: "Higher is Better (Numeric)" },
  { value: "NUMERIC_MAX", label: "Lower is Better (Numeric)" },
  { value: "TIMELINE", label: "Timeline (Date)" },
  { value: "ZERO", label: "Zero Target" },
  { value: "PERCENTAGE", label: "Percentage" },
];

const EMPTY_FORM = {
  title: "", description: "", thrustArea: "", uomType: "NUMERIC_MIN",
  uomUnit: "", target: "", targetDate: "", weightage: "20",
};

function useTemplates() {
  return useQuery({
    queryKey: ["templates"],
    queryFn: async () => {
      const res = await fetch("/api/templates");
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    staleTime: 60_000,
  });
}

export default function EmployeeGoalsPage() {
  const { data: goals, isLoading } = useGoals();
  const { data: cycle } = useCurrentCycle();
  const { data: templates } = useTemplates();
  const bulkSubmit = useBulkSubmit();
  const createGoal = useCreateGoal();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [templateDialogOpen, setTemplateDialogOpen] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [aiResult, setAiResult] = useState<AiResult | null>(null);
  const [redundancyMatches, setRedundancyMatches] = useState<RedundancyMatch[]>([]);
  const [redundancyDismissed, setRedundancyDismissed] = useState(false);
  const redundancyTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounced redundancy check — fires 1.5s after the user stops typing the title
  function triggerRedundancyCheck(title: string, thrustArea: string) {
    if (redundancyTimer.current) clearTimeout(redundancyTimer.current);
    if (!title || title.length < 10 || !cycle?.id) return;
    redundancyTimer.current = setTimeout(async () => {
      try {
        const res = await fetch("/api/ai/redundancy", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ title, description: form.description, thrustArea, cycleId: cycle.id }),
        });
        if (!res.ok) return;
        const data = await res.json();
        if (data.has_redundancy && data.matches?.length) {
          setRedundancyMatches(data.matches);
          setRedundancyDismissed(false);
        } else {
          setRedundancyMatches([]);
        }
      } catch { /* silent — redundancy check is advisory only */ }
    }, 1500);
  }

  const aiEvaluate = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/ai/evaluate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: form.title, description: form.description,
          uom_type: form.uomType, target: form.target ? parseFloat(form.target) : null,
          weightage: parseFloat(form.weightage || "20"), thrust_area: form.thrustArea,
        }),
      });
      if (!res.ok) throw new Error("AI evaluation failed");
      return res.json();
    },
    onSuccess: (data) => setAiResult(data),
    onError: () => toast.error("Quality check unavailable — please try again"),
  });

  const incrementUsage = useMutation({
    mutationFn: async (id: string) => {
      await fetch(`/api/templates/${id}`, { method: "POST" });
    },
  });

  // Weightage rebalancer — proportionally distributes remaining % across other draft goals
  const rebalanceMutation = useMutation({
    mutationFn: async (updates: { id: string; weightage: number }[]) => {
      const results = await Promise.all(updates.map(({ id, weightage }) =>
        fetch(`/api/goals/${id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ weightage }),
        })
      ));
      const failed = results.filter((r) => !r.ok);
      if (failed.length > 0) throw new Error(`${failed.length} update(s) failed during rebalance`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["goals"] });
      toast.success("Weightages rebalanced to 100%");
    },
    onError: () => toast.error("Rebalance failed"),
  });

  const allGoals = goals || [];
  // REJECTED goals are excluded from weightage — they're dead and the slot is freed up
  const activeGoals = allGoals.filter((g: Record<string, unknown>) => g.status !== "REJECTED");
  const totalWeightage = activeGoals.reduce((sum: number, g: Record<string, unknown>) => sum + (g.weightage as number || 0), 0);
  const draftGoals = activeGoals.filter((g: Record<string, unknown>) => g.status === "DRAFT");
  const nonDraftWeightage = activeGoals
    .filter((g: Record<string, unknown>) => g.status !== "DRAFT")
    .reduce((sum: number, g: Record<string, unknown>) => sum + (g.weightage as number || 0), 0);
  const remainingForDraft = Math.max(0, 100 - nonDraftWeightage);
  const canSubmit = draftGoals.length > 0 && Math.abs(totalWeightage - 100) < 0.01;

  const filteredGoals = allGoals.filter((g: Record<string, unknown>) => {
    if (statusFilter !== "ALL" && g.status !== statusFilter) return false;
    if (search) {
      const s = search.toLowerCase();
      return (g.title as string).toLowerCase().includes(s) || (g.thrustArea as string).toLowerCase().includes(s);
    }
    return true;
  });

  // Group templates by thrust area for the browse modal
  const templatesByThrust: Record<string, Record<string, unknown>[]> = {};
  if (templates) {
    for (const t of templates) {
      if (!templatesByThrust[t.thrustArea]) templatesByThrust[t.thrustArea] = [];
      templatesByThrust[t.thrustArea].push(t);
    }
  }

  function applyTemplate(t: Record<string, unknown>) {
    setForm({
      title: String(t.title ?? ""),
      description: String(t.description ?? ""),
      thrustArea: String(t.thrustArea ?? ""),
      uomType: String(t.uomType ?? "NUMERIC_MIN"),
      uomUnit: String(t.uomUnit ?? ""),
      target: t.suggestedTarget ? String(t.suggestedTarget) : "",
      targetDate: "",
      weightage: String(t.suggestedWeightage ?? 20),
    });
    incrementUsage.mutate(t.id as string);
    setTemplateDialogOpen(false);
    setDialogOpen(true);
  }

  const handleBulkSubmit = async () => {
    if (!cycle?.id) return;
    try {
      await bulkSubmit.mutateAsync(cycle.id);
      toast.success(`${draftGoals.length} goals submitted for review!`);
    } catch (err: unknown) {
      toast.error((err as Error).message || "Failed to submit goals");
    }
  };

  const handleCreateGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    const data: Record<string, unknown> = {
      title: form.title,
      description: form.description || undefined,
      thrustArea: form.thrustArea,
      uomType: form.uomType,
      uomUnit: form.uomUnit || undefined,
      weightage: parseFloat(form.weightage),
    };
    if (form.target) data.target = parseFloat(form.target);
    if (form.targetDate) data.targetDate = form.targetDate;

    try {
      await createGoal.mutateAsync(data);
      toast.success("Goal created!");
      setDialogOpen(false);
      setForm(EMPTY_FORM);
    } catch (err: unknown) {
      toast.error((err as Error).message || "Failed to create goal");
    }
  };

  return (
    <div className="space-y-6">
      {/* Weightage Meter */}
      <Card className="shadow-sm border-border">
        <CardContent className="p-6">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm font-semibold text-foreground">
              Total Weightage: {totalWeightage}%
            </span>
            <span className={`text-xs font-semibold ${Math.abs(totalWeightage - 100) < 0.01 ? "text-emerald-500" : "text-amber-500"}`}>
              {Math.abs(totalWeightage - 100) < 0.01 ? "✓ Complete" : `${100 - totalWeightage}% remaining`}
            </span>
          </div>
          <Progress value={Math.min(totalWeightage, 100)} className="h-2" />
          <div className="flex items-center gap-3 mt-4 flex-wrap">
            <span className="text-xs font-medium text-muted-foreground">{activeGoals.length}/8 goals</span>
            {draftGoals.length >= 1 && Math.abs(totalWeightage - 100) > 0.01 && remainingForDraft > 0 && (
              <>
                <span className="text-xs text-amber-600 dark:text-amber-400 font-medium ml-2">
                  Auto-balance {draftGoals.length} draft goal{draftGoals.length > 1 ? "s" : ""} to fill remaining {remainingForDraft}%?
                </span>
                <Button
                  size="sm" variant="outline"
                  className="h-7 text-xs px-3 border-amber-500/20 text-amber-600 dark:text-amber-400 hover:bg-amber-500/10"
                  disabled={rebalanceMutation.isPending}
                  onClick={() => {
                    // Distribute only the remaining % (after non-draft goals) across draft goals
                    const perGoal = Math.round((remainingForDraft / draftGoals.length) * 10) / 10;
                    const updates = draftGoals.map((g: Record<string, unknown>, i: number) => ({
                      id: g.id as string,
                      weightage: i === draftGoals.length - 1
                        ? Math.round((remainingForDraft - perGoal * (draftGoals.length - 1)) * 10) / 10
                        : perGoal,
                    }));
                    rebalanceMutation.mutate(updates);
                  }}
                >
                  Yes, auto-balance
                </Button>
              </>
            )}
            {nonDraftWeightage > 100 && (
              <span className="text-xs text-red-500 font-medium ml-2">
                Approved/submitted goals already exceed 100% — contact your manager to adjust.
              </span>
            )}
            <Button
              size="sm"
              onClick={handleBulkSubmit}
              disabled={bulkSubmit.isPending || !canSubmit}
              className="ml-auto"
              title={!canSubmit ? (draftGoals.length === 0 ? "No draft goals to submit" : `Total weightage must be 100% (currently ${totalWeightage}%)`) : ""}
            >
              <Send className="w-3.5 h-3.5 mr-1.5" />
              {bulkSubmit.isPending ? "Submitting..." : "Submit All Goals"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Filters & Actions */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search goals..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 h-10 bg-card" />
        </div>
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v || "ALL")}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Status</SelectItem>
            <SelectItem value="DRAFT">Draft</SelectItem>
            <SelectItem value="SUBMITTED">Submitted</SelectItem>
            <SelectItem value="APPROVED">Approved</SelectItem>
            <SelectItem value="LOCKED">Locked</SelectItem>
            <SelectItem value="REJECTED">Rejected</SelectItem>
            <SelectItem value="RETURNED">Returned</SelectItem>
          </SelectContent>
        </Select>

        {/* Browse Templates */}
        <Button variant="outline" onClick={() => setTemplateDialogOpen(true)} disabled={activeGoals.length >= 8} className="gap-2">
          <BookTemplate className="w-4 h-4" /> Browse Templates
        </Button>

        {/* New Goal (blank form) */}
        <Button disabled={activeGoals.length >= 8} onClick={() => setDialogOpen(true)}>
          <Plus className="w-4 h-4 mr-1" /> New Goal
        </Button>
        <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) { setForm(EMPTY_FORM); setAiResult(null); setRedundancyMatches([]); setRedundancyDismissed(false); } }}>
          <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create New Goal</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreateGoal} className="space-y-4">
              <div className="space-y-2">
                <Label>Title *</Label>
                <Input
                  required
                  minLength={3}
                  value={form.title}
                  onChange={(e) => {
                    const title = e.target.value;
                    setForm({ ...form, title });
                    triggerRedundancyCheck(title, form.thrustArea);
                  }}
                  placeholder="e.g., Quarterly Sales Revenue"
                />
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} placeholder="Describe the goal..." rows={2} />
              </div>
              {/* Redundancy warning — appears automatically after typing the title */}
              {redundancyMatches.length > 0 && !redundancyDismissed && (
                <RedundancyWarning
                  matches={redundancyMatches}
                  onDismiss={() => setRedundancyDismissed(true)}
                />
              )}

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Thrust Area *</Label>
                  <Select required value={form.thrustArea} onValueChange={(v) => { if (v) { setForm({ ...form, thrustArea: v }); triggerRedundancyCheck(form.title, v); } }}>
                    <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                    <SelectContent>{THRUST_AREAS.map((ta) => <SelectItem key={ta} value={ta}>{ta}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>UoM Type *</Label>
                  <Select value={form.uomType} onValueChange={(v) => v && setForm({ ...form, uomType: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>{UOM_TYPES.map((u) => <SelectItem key={u.value} value={u.value}>{u.label}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              {["NUMERIC_MIN", "NUMERIC_MAX", "PERCENTAGE", "ZERO"].includes(form.uomType) && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label>Target</Label>
                    <Input type="number" step="0.01" placeholder="e.g., 50" value={form.target} onChange={(e) => setForm({ ...form, target: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Unit (optional)</Label>
                    <Input placeholder="e.g., Lakhs, %" value={form.uomUnit} onChange={(e) => setForm({ ...form, uomUnit: e.target.value })} />
                  </div>
                </div>
              )}
              {form.uomType === "TIMELINE" && (
                <div className="space-y-2">
                  <Label>Target Date *</Label>
                  <Input type="date" value={form.targetDate} onChange={(e) => setForm({ ...form, targetDate: e.target.value })} />
                </div>
              )}
              <div className="space-y-2">
                <Label>Weightage % *</Label>
                <Input type="number" min={10} max={100} step={5} required value={form.weightage} onChange={(e) => setForm({ ...form, weightage: e.target.value })} />
                <p className="text-xs text-slate-400">Remaining: {Math.max(0, 100 - totalWeightage)}% · All goals must total 100%</p>
              </div>
              {/* Quality Check */}
              <div className="border border-slate-200 dark:border-white/[0.08] rounded-lg overflow-hidden">
                <div className="flex items-center justify-between px-3 py-2.5 bg-slate-50 dark:bg-white/[0.03]">
                  <span className="text-xs font-semibold text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
                    <BarChart2 className="w-3.5 h-3.5" /> Quality Check
                  </span>
                  <Button type="button" size="sm" variant="outline"
                    className="h-7 text-xs gap-1.5 border-slate-200 dark:border-white/[0.1] text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-white/[0.05]"
                    onClick={() => aiEvaluate.mutate()}
                    disabled={aiEvaluate.isPending || !form.title || !form.thrustArea}>
                    {aiEvaluate.isPending
                      ? <><Loader2 className="w-3 h-3 animate-spin" /> Checking…</>
                      : aiResult ? "Re-check" : "Check quality"}
                  </Button>
                </div>
                {aiEvaluate.isPending && (
                  <div className="flex items-center gap-2 px-4 py-6 text-xs text-slate-400">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Evaluating against SMART criteria…
                  </div>
                )}
                {aiResult && !aiEvaluate.isPending && (
                  <div className="p-4">
                    <AiAnalysisPanel
                      result={aiResult}
                      currentTitle={form.title}
                      onApplyTitle={(t) => setForm({ ...form, title: t })}
                    />
                  </div>
                )}
                {!aiResult && !aiEvaluate.isPending && (
                  <p className="px-4 py-3 text-xs text-slate-400">
                    Enter a title and thrust area, then run a quality check for SMART scoring and improvement suggestions.
                  </p>
                )}
              </div>

              <Button type="submit" className="w-full" disabled={!form.title || !form.thrustArea || createGoal.isPending}>
                {createGoal.isPending ? "Creating..." : "Create Goal"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Goals Grid */}
      {isLoading ? (
        <div className="grid gap-6 md:grid-cols-2">
          {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-40 rounded-xl" />)}
        </div>
      ) : filteredGoals.length === 0 ? (
        <Card className="border-border shadow-sm">
          <CardContent className="flex flex-col items-center py-16">
            <Target className="w-12 h-12 text-muted-foreground mb-4 opacity-50" />
            <p className="text-lg font-semibold text-foreground">No goals found</p>
            <p className="text-sm text-muted-foreground mb-6">Create your first goal to get started</p>
            <div className="flex gap-3">
              <Button variant="outline" onClick={() => setTemplateDialogOpen(true)} className="gap-2">
                <BookTemplate className="w-4 h-4" /> Browse Templates
              </Button>
              <Button onClick={() => setDialogOpen(true)} className="gap-2">
                <Plus className="w-4 h-4" /> New Goal
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-6 md:grid-cols-2">
          {filteredGoals.map((goal: Record<string, unknown>) => (
            <Link key={goal.id as string} href={`/dashboard/employee/goals/${goal.id}`}>
              <Card className="hover:shadow-md transition-all hover:border-primary/50 cursor-pointer group h-full shadow-sm">
                <CardHeader className="pb-4 pt-6 px-6">
                  <div className="flex items-start justify-between gap-3">
                    <CardTitle className="text-base font-semibold text-foreground group-hover:text-primary transition-colors line-clamp-2 leading-snug">
                      {goal.title as string}
                    </CardTitle>
                    <Badge className={`font-normal ${getGoalStatusColor(goal.status as string)}`} variant="secondary">
                      {(goal.status as string).replace(/_/g, " ")}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4 px-6 pb-6">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" className="text-xs text-muted-foreground border-border font-medium">
                      {goal.thrustArea as string}
                    </Badge>
                    <Badge variant="outline" className={`text-xs font-medium border-border ${getUoMColor(goal.uomType as string)}`}>
                      {getUoMLabel(goal.uomType as string)}
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Weight: <span className="font-semibold text-foreground">{goal.weightage as number}%</span></span>
                    {goal.latestScore !== null && goal.latestScore !== undefined && (
                      <span className={`font-semibold ${getScoreColor(goal.latestScore as number)}`}>
                        Score: {formatScore(goal.latestScore as number)}
                      </span>
                    )}
                    {!!goal.target && (
                      <span className="text-muted-foreground">Target: <span className="font-semibold text-foreground">{goal.target as number}{goal.uomUnit ? ` ${goal.uomUnit}` : ""}</span></span>
                    )}
                  </div>
                  <div className="flex items-center justify-end">
                    <ArrowRight className="w-4 h-4 text-muted-foreground opacity-50 group-hover:opacity-100 group-hover:text-primary transition-all group-hover:translate-x-1" />
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}

      {/* Browse Templates Modal */}
      <Dialog open={templateDialogOpen} onOpenChange={setTemplateDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
          <DialogHeader className="mb-4">
            <DialogTitle className="flex items-center gap-2 text-xl">
              <BookTemplate className="w-5 h-5 text-primary" /> Goal Templates Library
            </DialogTitle>
            <p className="text-sm text-muted-foreground">Select a template to pre-fill the goal creation form. You can edit any field after.</p>
          </DialogHeader>
          <div className="space-y-6">
            {Object.keys(templatesByThrust).length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-12">No templates available yet</p>
            )}
            {Object.entries(templatesByThrust).map(([thrustArea, tmplts]) => (
              <div key={thrustArea} className="space-y-3">
                <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{thrustArea}</h3>
                <div className="grid grid-cols-1 gap-3">
                  {tmplts.map((t) => (
                    <button
                      key={t.id as string}
                      type="button"
                      onClick={() => applyTemplate(t)}
                      className="w-full text-left p-4 rounded-xl border border-border bg-card hover:border-primary/50 hover:bg-muted/30 transition-all group shadow-sm"
                    >
                      <div className="flex items-center justify-between gap-4">
                        <div className="space-y-1.5 flex-1 min-w-0">
                          <p className="font-semibold text-sm truncate text-foreground group-hover:text-primary transition-colors">
                            {String(t.title)}
                          </p>
                          <div className="flex items-center gap-3 text-xs text-muted-foreground flex-wrap">
                            <span className="font-medium bg-muted px-2 py-0.5 rounded">{getUoMLabel(String(t.uomType))}</span>
                            {!!t.suggestedTarget && <span className="font-medium">Target: {Number(t.suggestedTarget)} {String(t.uomUnit ?? "")}</span>}
                            <span className="font-medium">Wt: {Number(t.suggestedWeightage)}%</span>
                            <span className="opacity-50">·</span>
                            <span>{Number(t.usageCount)} uses</span>
                          </div>
                        </div>
                        <ChevronRight className="w-5 h-5 text-muted-foreground opacity-50 group-hover:opacity-100 group-hover:text-primary group-hover:translate-x-1 transition-all flex-shrink-0" />
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
