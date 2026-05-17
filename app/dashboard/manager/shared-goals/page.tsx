// Manager Shared Goals — create and manage departmental KPIs
"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Share2, Plus, Users } from "lucide-react";
import { getGoalStatusColor, getUoMLabel } from "@/lib/utils";
import { toast } from "sonner";

const THRUST_AREAS = ["Sales Revenue", "Customer Experience", "Operational Excellence", "Safety & Compliance", "People Development", "Cost Efficiency", "Innovation", "Digital Transformation"];
const UOM_TYPES = [
  { value: "NUMERIC_MIN", label: "Numeric (Higher is Better)" },
  { value: "NUMERIC_MAX", label: "Numeric (Lower is Better)" },
  { value: "PERCENTAGE", label: "Percentage (0-100%)" },
  { value: "TIMELINE", label: "Timeline (Date-based)" },
  { value: "ZERO", label: "Zero Incidents" },
];

function useSharedGoals() {
  return useQuery({
    queryKey: ["shared-goals"],
    queryFn: async () => {
      const res = await fetch("/api/shared-goals");
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    staleTime: 30_000,
  });
}

function useTeamMembers() {
  return useQuery({
    queryKey: ["team-members"],
    queryFn: async () => {
      const res = await fetch("/api/users");
      if (!res.ok) throw new Error("Failed");
      const users = await res.json();
      return users.filter((u: Record<string, unknown>) => u.role === "EMPLOYEE");
    },
    staleTime: 60_000,
  });
}

export default function ManagerSharedGoalsPage() {
  const { data: sharedGoals, isLoading } = useSharedGoals();
  const { data: teamMembers } = useTeamMembers();
  const [showCreate, setShowCreate] = useState(false);
  const queryClient = useQueryClient();

  const [form, setForm] = useState({
    title: "", description: "", thrustArea: "", uomType: "NUMERIC_MIN",
    uomUnit: "", target: "", targetDate: "", weightage: "20",
  });
  const [selectedRecipients, setSelectedRecipients] = useState<string[]>([]);

  const createMutation = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const res = await fetch("/api/shared-goals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) { const err = await res.json(); throw new Error(err.error || "Failed"); }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["shared-goals"] });
      toast.success("Shared goal created and assigned to team members");
      setShowCreate(false);
      setForm({ title: "", description: "", thrustArea: "", uomType: "NUMERIC_MIN", uomUnit: "", target: "", targetDate: "", weightage: "20" });
      setSelectedRecipients([]);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (selectedRecipients.length === 0) { toast.error("Select at least one recipient"); return; }

    const payload: Record<string, unknown> = {
      title: form.title, description: form.description || undefined,
      thrustArea: form.thrustArea, uomType: form.uomType,
      uomUnit: form.uomUnit || undefined,
      weightage: parseFloat(form.weightage),
      recipientIds: selectedRecipients,
    };

    if (["NUMERIC_MIN", "NUMERIC_MAX", "PERCENTAGE", "ZERO"].includes(form.uomType) && form.target) {
      payload.target = parseFloat(form.target);
    }
    if (form.uomType === "TIMELINE" && form.targetDate) {
      payload.targetDate = form.targetDate;
    }

    createMutation.mutate(payload);
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48" />
        <Skeleton className="h-32" />
        <Skeleton className="h-32" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Shared / Departmental Goals</h1>
          <p className="text-sm text-slate-500 mt-1">Create a shared KPI and assign it to multiple team members</p>
        </div>
        <Button onClick={() => setShowCreate(true)} className="gap-2">
          <Plus className="w-4 h-4" /> Create Shared Goal
        </Button>
      </div>

      {sharedGoals?.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center py-12">
            <Share2 className="w-12 h-12 text-purple-400 mb-4" />
            <p className="text-lg font-medium">No shared goals yet</p>
            <p className="text-sm text-slate-400">Create a departmental goal to assign it to multiple team members</p>
          </CardContent>
        </Card>
      )}

      <div className="space-y-4">
        {sharedGoals?.map((goal: Record<string, unknown>) => {
          const sharedWith = goal.sharedWith as Record<string, unknown>[];
          return (
            <Card key={goal.id as string}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-2 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge className="bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300">
                        <Share2 className="w-3 h-3 mr-1" /> Shared
                      </Badge>
                      <Badge className={getGoalStatusColor(goal.status as string)}>{goal.status as string}</Badge>
                      <Badge variant="outline">{getUoMLabel(goal.uomType as string)}</Badge>
                    </div>
                    <p className="font-semibold">{String(goal.title)}</p>
                    <p className="text-sm text-slate-500">{String(goal.thrustArea)} • Weightage: {Number(goal.weightage)}%</p>
                    {sharedWith?.length > 0 && (
                      <div className="flex items-center gap-1 text-xs text-slate-400">
                        <Users className="w-3 h-3" />
                        Assigned to: {sharedWith.map((u) => String(u.name)).join(", ")}
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Create Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Create Shared Goal</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Goal Title *</Label>
              <Input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g., Q2 Department Sales Target" />
            </div>
            <div className="space-y-2">
              <Label>Description</Label>
              <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={2} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label>Thrust Area *</Label>
                <Select value={form.thrustArea} onValueChange={(v) => v && setForm({ ...form, thrustArea: v })}>
                  <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                  <SelectContent>
                    {THRUST_AREAS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>UoM Type *</Label>
                <Select value={form.uomType} onValueChange={(v) => v && setForm({ ...form, uomType: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {UOM_TYPES.map((u) => <SelectItem key={u.value} value={u.value}>{u.label}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            {["NUMERIC_MIN", "NUMERIC_MAX", "PERCENTAGE", "ZERO"].includes(form.uomType) && (
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>Target Value *</Label>
                  <Input type="number" step="any" value={form.target} onChange={(e) => setForm({ ...form, target: e.target.value })} />
                </div>
                <div className="space-y-2">
                  <Label>Unit (optional)</Label>
                  <Input value={form.uomUnit} onChange={(e) => setForm({ ...form, uomUnit: e.target.value })} placeholder="e.g., L, %, hrs" />
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
              <Label>Suggested Weightage % *</Label>
              <Input type="number" min="10" max="100" value={form.weightage} onChange={(e) => setForm({ ...form, weightage: e.target.value })} />
            </div>

            {/* Recipients */}
            <div className="space-y-2">
              <Label>Assign to Team Members *</Label>
              <div className="space-y-2 max-h-40 overflow-y-auto border rounded-lg p-3">
                {teamMembers?.map((user: Record<string, unknown>) => (
                  <div key={user.id as string} className="flex items-center gap-2">
                    <Checkbox
                      id={user.id as string}
                      checked={selectedRecipients.includes(user.id as string)}
                      onCheckedChange={(checked) => {
                        setSelectedRecipients(checked
                          ? [...selectedRecipients, user.id as string]
                          : selectedRecipients.filter((id) => id !== user.id as string)
                        );
                      }}
                    />
                    <label htmlFor={user.id as string} className="text-sm cursor-pointer">
                      {String(user.name ?? "")}
                      {!!user.department && <span className="text-slate-400 ml-1">({String(user.department)})</span>}
                    </label>
                  </div>
                ))}
                {(!teamMembers || teamMembers.length === 0) && (
                  <p className="text-sm text-slate-400">No team members found</p>
                )}
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <Button type="submit" className="flex-1" disabled={createMutation.isPending}>
                {createMutation.isPending ? "Creating..." : "Create & Assign"}
              </Button>
              <Button type="button" variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
