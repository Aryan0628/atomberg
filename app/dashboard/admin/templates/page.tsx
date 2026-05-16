// Admin Goal Templates — CRUD table with usage counts
"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Plus, Trash2, BookTemplate, BarChart3 } from "lucide-react";
import { getUoMLabel } from "@/lib/utils";
import { toast } from "sonner";

const THRUST_AREAS = ["Sales Revenue", "Customer Experience", "Operational Excellence", "Safety & Compliance", "People Development", "Cost Efficiency", "Innovation", "Digital Transformation"];
const UOM_TYPES = [
  { value: "NUMERIC_MIN", label: "Numeric (Higher is Better)" },
  { value: "NUMERIC_MAX", label: "Numeric (Lower is Better)" },
  { value: "PERCENTAGE", label: "Percentage (0-100%)" },
  { value: "TIMELINE", label: "Timeline (Date-based)" },
  { value: "ZERO", label: "Zero Incidents" },
];

function useTemplates() {
  return useQuery({
    queryKey: ["templates"],
    queryFn: async () => {
      const res = await fetch("/api/templates");
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    staleTime: 30_000,
  });
}

const EMPTY_FORM = {
  title: "", description: "", thrustArea: "", uomType: "NUMERIC_MIN",
  uomUnit: "", suggestedTarget: "", suggestedWeightage: "20",
};

export default function AdminTemplatesPage() {
  const { data: templates, isLoading } = useTemplates();
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const queryClient = useQueryClient();

  const createMutation = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const res = await fetch("/api/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) { const err = await res.json(); throw new Error(err.error || "Failed"); }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["templates"] });
      toast.success("Template created");
      setShowCreate(false);
      setForm(EMPTY_FORM);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/templates/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["templates"] });
      toast.success("Template deleted");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const payload: Record<string, unknown> = {
      title: form.title,
      description: form.description || undefined,
      thrustArea: form.thrustArea,
      uomType: form.uomType,
      uomUnit: form.uomUnit || undefined,
      suggestedWeightage: parseFloat(form.suggestedWeightage),
    };
    if (form.suggestedTarget) payload.suggestedTarget = parseFloat(form.suggestedTarget);
    createMutation.mutate(payload);
  }

  // Group by thrust area
  const byThrust: Record<string, Record<string, unknown>[]> = {};
  if (templates) {
    for (const t of templates) {
      if (!byThrust[t.thrustArea]) byThrust[t.thrustArea] = [];
      byThrust[t.thrustArea].push(t);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Goal Templates</h1>
          <p className="text-sm text-slate-500 mt-1">Reusable goal templates for employees — reduces setup time</p>
        </div>
        <Button onClick={() => setShowCreate(true)} className="gap-2">
          <Plus className="w-4 h-4" /> New Template
        </Button>
      </div>

      {isLoading && (
        <div className="space-y-4">{[1, 2, 3].map((i) => <Skeleton key={i} className="h-24" />)}</div>
      )}

      {!isLoading && templates?.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center py-12">
            <BookTemplate className="w-12 h-12 text-blue-400 mb-4" />
            <p className="text-lg font-medium">No templates yet</p>
            <p className="text-sm text-slate-400 mb-4">Create templates to help employees quickly set up standard goals</p>
            <Button onClick={() => setShowCreate(true)} className="gap-2"><Plus className="w-4 h-4" /> Create First Template</Button>
          </CardContent>
        </Card>
      )}

      {Object.entries(byThrust).map(([thrustArea, tmplts]) => (
        <div key={thrustArea} className="space-y-3">
          <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide">{thrustArea}</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {tmplts.map((t) => (
              <Card key={t.id as string} className="group hover:border-blue-300 dark:hover:border-blue-700 transition-colors">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1.5 flex-1 min-w-0">
                      <p className="font-medium truncate">{String(t.title)}</p>
                      {!!t.description && <p className="text-xs text-slate-400 line-clamp-2">{String(t.description)}</p>}
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="outline" className="text-xs">{getUoMLabel(String(t.uomType))}</Badge>
                        {!!t.suggestedTarget && (
                          <span className="text-xs text-slate-400">Target: {Number(t.suggestedTarget)} {String(t.uomUnit ?? "")}</span>
                        )}
                        <span className="text-xs text-slate-400">Wtg: {Number(t.suggestedWeightage)}%</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <div className="flex items-center gap-1 text-xs text-slate-400">
                        <BarChart3 className="w-3 h-3" />
                        <span>{Number(t.usageCount)} uses</span>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="text-red-400 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={() => deleteMutation.mutate(t.id as string)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      ))}

      {/* Create Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Create Goal Template</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Title *</Label>
              <Input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g., Quarterly Revenue Achievement" />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Thrust Area *</Label>
                <Select required value={form.thrustArea} onValueChange={(v) => v && setForm({ ...form, thrustArea: v })}>
                  <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                  <SelectContent>{THRUST_AREAS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}</SelectContent>
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
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Suggested Target</Label>
                <Input type="number" step="any" value={form.suggestedTarget} onChange={(e) => setForm({ ...form, suggestedTarget: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Unit (optional)</Label>
                <Input value={form.uomUnit} onChange={(e) => setForm({ ...form, uomUnit: e.target.value })} placeholder="L, %, hrs..." />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Suggested Weightage %</Label>
              <Input type="number" min="10" max="100" value={form.suggestedWeightage} onChange={(e) => setForm({ ...form, suggestedWeightage: e.target.value })} />
            </div>
            <div className="flex gap-2">
              <Button type="submit" className="flex-1" disabled={!form.title || !form.thrustArea || createMutation.isPending}>
                {createMutation.isPending ? "Creating..." : "Create Template"}
              </Button>
              <Button type="button" variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
