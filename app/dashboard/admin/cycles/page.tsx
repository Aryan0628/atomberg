// Admin Cycles — full CRUD with create form, clone, activate, lock goals
"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Calendar, Check, Plus, Copy, Lock, Play, Pause } from "lucide-react";
import { formatDate } from "@/lib/utils";
import { toast } from "sonner";

function useCycles() {
  return useQuery({
    queryKey: ["cycles"],
    queryFn: async () => {
      const res = await fetch("/api/cycles");
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    staleTime: 30_000,
  });
}

const EMPTY_CYCLE = {
  name: "", fiscalYear: "",
  goalSettingOpen: "", goalSettingClose: "",
  q1Open: "", q1Close: "",
  q2Open: "", q2Close: "",
  q3Open: "", q3Close: "",
  q4Open: "", q4Close: "",
};

type CycleForm = typeof EMPTY_CYCLE;

function DatePair({ prefix, label, form, setForm }: {
  prefix: string; label: string;
  form: CycleForm; setForm: (f: CycleForm) => void;
}) {
  const openKey = `${prefix}Open` as keyof CycleForm;
  const closeKey = `${prefix}Close` as keyof CycleForm;
  return (
    <div className="grid grid-cols-2 gap-2">
      <div className="space-y-1">
        <Label className="text-xs text-slate-500">{label} Open</Label>
        <Input type="date" required value={form[openKey]} onChange={(e) => setForm({ ...form, [openKey]: e.target.value })} />
      </div>
      <div className="space-y-1">
        <Label className="text-xs text-slate-500">{label} Close</Label>
        <Input type="date" required value={form[closeKey]} onChange={(e) => setForm({ ...form, [closeKey]: e.target.value })} />
      </div>
    </div>
  );
}

export default function AdminCyclesPage() {
  const { data: cycles, isLoading } = useCycles();
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState(EMPTY_CYCLE);

  const createMutation = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const res = await fetch("/api/cycles", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error || "Failed"); }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cycles"] });
      toast.success("Cycle created successfully");
      setShowCreate(false);
      setForm(EMPTY_CYCLE);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const patchMutation = useMutation({
    mutationFn: async ({ id, patch }: { id: string; patch: Record<string, unknown> }) => {
      const res = await fetch(`/api/cycles/${id}`, {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error || "Failed"); }
      return res.json();
    },
    onSuccess: (data: Record<string, unknown>, { patch }) => {
      queryClient.invalidateQueries({ queryKey: ["cycles"] });
      if (patch.lockGoals) toast.success(`${data.locked} goal(s) locked`);
      else if (patch.isActive === true) toast.success("Cycle activated");
      else toast.success("Cycle deactivated");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const cloneMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/cycles/${id}/clone`, { method: "POST" });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error || "Failed"); }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cycles"] });
      toast.success("Cycle cloned as next FY — activate it when ready");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    createMutation.mutate({ ...form });
  }

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-48" />
        {[1, 2].map((i) => <Skeleton key={i} className="h-48" />)}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Performance Cycles</h1>
          <p className="text-sm text-slate-500 mt-1">Manage fiscal year cycles and their date windows</p>
        </div>
        <Button onClick={() => setShowCreate(true)} className="gap-2">
          <Plus className="w-4 h-4" /> New Cycle
        </Button>
      </div>

      <div className="space-y-4">
        {(cycles || []).map((c: Record<string, unknown>) => {
          const count = (c._count as Record<string, number>)?.goals ?? 0;
          return (
            <Card key={c.id as string} className={c.isActive ? "border-blue-300 dark:border-blue-700 shadow-sm" : ""}>
              <CardContent className="p-5">
                <div className="flex items-start justify-between gap-4 flex-wrap">
                  <div className="flex items-center gap-3">
                    <Calendar className="w-5 h-5 text-slate-400 flex-shrink-0" />
                    <div>
                      <h3 className="font-semibold text-lg">{c.name as string}</h3>
                      <p className="text-sm text-slate-500">FY {c.fiscalYear as string} · {count} goals</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    {!!c.isActive
                      ? <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300"><Check className="w-3 h-3 mr-1" /> Active</Badge>
                      : <Badge variant="outline">Inactive</Badge>
                    }
                    {!c.isActive ? (
                      <Button size="sm" variant="outline" className="gap-1"
                        onClick={() => patchMutation.mutate({ id: c.id as string, patch: { isActive: true } })}
                        disabled={patchMutation.isPending}>
                        <Play className="w-3 h-3" /> Activate
                      </Button>
                    ) : (
                      <Button size="sm" variant="outline" className="gap-1"
                        onClick={() => patchMutation.mutate({ id: c.id as string, patch: { isActive: false } })}
                        disabled={patchMutation.isPending}>
                        <Pause className="w-3 h-3" /> Deactivate
                      </Button>
                    )}
                    <Button size="sm" variant="outline" className="gap-1 text-amber-600 hover:text-amber-700 border-amber-200"
                      onClick={() => {
                        if (!confirm("Lock all APPROVED goals in this cycle? This cannot be undone.")) return;
                        patchMutation.mutate({ id: c.id as string, patch: { lockGoals: true } });
                      }}
                      disabled={patchMutation.isPending}>
                      <Lock className="w-3 h-3" /> Lock Goals Now
                    </Button>
                    <Button size="sm" variant="outline" className="gap-1"
                      onClick={() => cloneMutation.mutate(c.id as string)}
                      disabled={cloneMutation.isPending}>
                      <Copy className="w-3 h-3" /> Clone as next FY
                    </Button>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-3 text-sm">
                  {[
                    { label: "Goal Setting", open: c.goalSettingOpen, close: c.goalSettingClose },
                    { label: "Q1 Check-in", open: c.q1Open, close: c.q1Close },
                    { label: "Q2 Check-in", open: c.q2Open, close: c.q2Close },
                    { label: "Q3 Check-in", open: c.q3Open, close: c.q3Close },
                    { label: "Q4 Check-in", open: c.q4Open, close: c.q4Close },
                  ].map(({ label, open, close }) => (
                    <div key={label} className="bg-slate-50 dark:bg-slate-900 rounded-lg p-3">
                      <p className="text-xs font-medium text-slate-500 mb-1">{label}</p>
                      <p className="text-xs">{formatDate(open as string)}</p>
                      <p className="text-xs text-slate-400">→ {formatDate(close as string)}</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Create Cycle Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create New Performance Cycle</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Cycle Name *</Label>
                <Input required placeholder="FY 2027-28" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Fiscal Year *</Label>
                <Input required placeholder="2027-28" value={form.fiscalYear} onChange={(e) => setForm({ ...form, fiscalYear: e.target.value })} />
              </div>
            </div>

            <div className="space-y-3">
              <p className="text-sm font-semibold text-slate-700 dark:text-slate-300">Date Windows</p>
              <DatePair prefix="goalSetting" label="Goal Setting" form={form} setForm={setForm} />
              <DatePair prefix="q1" label="Q1" form={form} setForm={setForm} />
              <DatePair prefix="q2" label="Q2" form={form} setForm={setForm} />
              <DatePair prefix="q3" label="Q3" form={form} setForm={setForm} />
              <DatePair prefix="q4" label="Q4" form={form} setForm={setForm} />
            </div>

            <div className="flex gap-2 pt-2">
              <Button type="submit" className="flex-1" disabled={createMutation.isPending}>
                {createMutation.isPending ? "Creating..." : "Create Cycle"}
              </Button>
              <Button type="button" variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
