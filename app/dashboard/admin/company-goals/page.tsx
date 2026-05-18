"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Building2, ChevronRight, ChevronDown, Target, Plus, Users } from "lucide-react";

const THRUST_AREAS = ["Sales Revenue", "Customer Experience", "Operational Excellence", "Safety & Compliance",
  "People Development", "Cost Efficiency", "Innovation", "Digital Transformation"];

const LEVEL_COLOR: Record<string, string> = {
  COMPANY: "bg-purple-100 text-purple-700",
  DEPARTMENT: "bg-blue-100 text-blue-700",
  INDIVIDUAL: "bg-green-100 text-green-700",
};

type ChildGoal = {
  id: string; title: string; goalLevel: string; status: string;
  latestScore: number | null; weightage: number;
  owner: { id: string; name: string; department: string | null };
};

type CompanyGoal = {
  id: string; title: string; description: string | null; goalLevel: string;
  thrustArea: string; status: string; weightage: number; latestScore: number | null;
  childGoals: ChildGoal[];
  owner: { id: string; name: string; department: string | null };
};

function GoalRow({ goal }: { goal: CompanyGoal }) {
  const [expanded, setExpanded] = useState(true);
  const childCount = goal.childGoals?.length ?? 0;
  const avgChildScore = childCount > 0
    ? Math.round(goal.childGoals.filter((c) => c.latestScore !== null).reduce((s, c) => s + (c.latestScore ?? 0), 0) / childCount)
    : null;

  return (
    <div className="border rounded-lg overflow-hidden">
      <div className="flex items-center gap-3 p-4 bg-muted/30 cursor-pointer hover:bg-muted/50 transition-colors"
        onClick={() => setExpanded(!expanded)}>
        <button className="flex-shrink-0">
          {childCount > 0
            ? expanded ? <ChevronDown className="w-4 h-4 text-muted-foreground" /> : <ChevronRight className="w-4 h-4 text-muted-foreground" />
            : <span className="w-4 h-4 inline-block" />}
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${LEVEL_COLOR[goal.goalLevel]}`}>
              {goal.goalLevel}
            </span>
            <p className="text-sm font-semibold truncate">{goal.title}</p>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">{goal.thrustArea} · {goal.owner.name}</p>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          {avgChildScore !== null && (
            <span className={`text-sm font-semibold ${avgChildScore >= 80 ? "text-green-600" : avgChildScore >= 60 ? "text-amber-600" : "text-red-600"}`}>
              {avgChildScore}% avg
            </span>
          )}
          <Badge variant="outline" className="text-xs">{goal.status}</Badge>
          {childCount > 0 && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Users className="w-3 h-3" />{childCount}
            </span>
          )}
        </div>
      </div>

      {expanded && childCount > 0 && (
        <div className="divide-y divide-border border-t">
          {goal.childGoals.map((child) => (
            <div key={child.id} className="flex items-center gap-3 px-4 py-3 pl-10 hover:bg-muted/20">
              <ChevronRight className="w-3 h-3 text-muted-foreground flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm truncate">{child.title}</p>
                <p className="text-xs text-muted-foreground">{child.owner.name} · {child.weightage}% weight</p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                {child.latestScore !== null && (
                  <span className={`text-xs font-medium ${child.latestScore >= 80 ? "text-green-600" : child.latestScore >= 60 ? "text-amber-600" : "text-red-600"}`}>
                    {Math.round(child.latestScore)}%
                  </span>
                )}
                <Badge variant="outline" className="text-[10px]">{child.status}</Badge>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function CompanyGoalsPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    title: "", description: "", thrustArea: "", goalLevel: "COMPANY", weightage: 30,
  });

  const { data: goals = [], isLoading } = useQuery<CompanyGoal[]>({
    queryKey: ["company-goals"],
    queryFn: () => fetch("/api/company-goals").then((r) => r.json()),
  });

  const create = useMutation({
    mutationFn: () => fetch("/api/company-goals", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, uomType: "PERCENTAGE", target: 100 }),
    }).then((r) => r.json()),
    onSuccess: (data) => {
      if (data.error) { toast.error(data.error); return; }
      toast.success("Goal created");
      setOpen(false);
      setForm({ title: "", description: "", thrustArea: "", goalLevel: "COMPANY", weightage: 30 });
      qc.invalidateQueries({ queryKey: ["company-goals"] });
    },
    onError: () => toast.error("Failed to create goal"),
  });

  const companyGoals = goals.filter((g) => g.goalLevel === "COMPANY");
  const deptGoals = goals.filter((g) => g.goalLevel === "DEPARTMENT");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Company & Department Goals</h1>
          <p className="text-muted-foreground text-sm mt-1">Cascading OKR-style goals linked to individual employee targets</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <Button onClick={() => setOpen(true)}><Plus className="w-4 h-4 mr-2" />Create Goal</Button>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>Create Company / Department Goal</DialogTitle></DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="space-y-1">
                <Label>Level</Label>
                <Select value={form.goalLevel} onValueChange={(v) => v && setForm((f) => ({ ...f, goalLevel: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="COMPANY">Company</SelectItem>
                    <SelectItem value="DEPARTMENT">Department</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Title</Label>
                <Input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  placeholder="e.g., Achieve ₹500Cr Revenue in FY26" />
              </div>
              <div className="space-y-1">
                <Label>Description</Label>
                <Textarea value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                  placeholder="Strategic context…" rows={2} />
              </div>
              <div className="space-y-1">
                <Label>Thrust Area</Label>
                <Select value={form.thrustArea} onValueChange={(v) => v && setForm((f) => ({ ...f, thrustArea: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select…" /></SelectTrigger>
                  <SelectContent>
                    {THRUST_AREAS.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Weightage (%)</Label>
                <Input type="number" min={10} max={100} value={form.weightage}
                  onChange={(e) => setForm((f) => ({ ...f, weightage: Number(e.target.value) }))} />
              </div>
              <Button className="w-full" disabled={!form.title || !form.thrustArea || create.isPending}
                onClick={() => create.mutate()}>
                {create.isPending ? "Creating…" : "Create Goal"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-3 gap-4">
        {[
          { label: "Company Goals", count: companyGoals.length, color: "text-purple-600" },
          { label: "Department Goals", count: deptGoals.length, color: "text-blue-600" },
          { label: "Total Linked", count: goals.reduce((s, g) => s + (g.childGoals?.length ?? 0), 0), color: "text-green-600" },
        ].map(({ label, count, color }) => (
          <Card key={label}>
            <CardContent className="pt-4 pb-3">
              <p className={`text-2xl font-bold ${color}`}>{count}</p>
              <p className="text-xs text-muted-foreground">{label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-3">{[1,2,3].map((i) => <div key={i} className="h-20 rounded-xl bg-muted animate-pulse" />)}</div>
      ) : goals.length === 0 ? (
        <Card><CardContent className="py-20 text-center">
          <Building2 className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">No company or department goals yet</p>
          <p className="text-xs text-muted-foreground mt-1">Create top-level goals that cascade down to individual employees</p>
        </CardContent></Card>
      ) : (
        <div className="space-y-6">
          {companyGoals.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Target className="w-4 h-4 text-purple-600" />
                <h2 className="text-sm font-semibold text-purple-600 uppercase tracking-wide">Company Goals</h2>
              </div>
              <div className="space-y-3">
                {companyGoals.map((g) => <GoalRow key={g.id} goal={g} />)}
              </div>
            </div>
          )}
          {deptGoals.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-3">
                <Building2 className="w-4 h-4 text-blue-600" />
                <h2 className="text-sm font-semibold text-blue-600 uppercase tracking-wide">Department Goals</h2>
              </div>
              <div className="space-y-3">
                {deptGoals.map((g) => <GoalRow key={g.id} goal={g} />)}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
