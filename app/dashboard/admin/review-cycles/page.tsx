"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { ClipboardList, Plus, Trash2, ChevronRight, Users, MessageSquare } from "lucide-react";
import { format } from "date-fns";

const STATUS_COLOR: Record<string, string> = {
  DRAFT: "bg-slate-100 text-slate-700",
  ACTIVE: "bg-green-100 text-green-700",
  COMPLETED: "bg-blue-100 text-blue-700",
  ARCHIVED: "bg-gray-100 text-gray-500",
};

const QUESTION_TYPES = [
  { value: "TEXT", label: "Open Text" },
  { value: "RATING", label: "Rating (1-5)" },
  { value: "MULTIPLE_CHOICE", label: "Multiple Choice" },
];

type Question = { text: string; questionType: string; isRequired: boolean };

type ReviewCycle = {
  id: string; name: string; cadence: string; status: string;
  startDate: string; endDate: string;
  _count: { questions: number; responses: number };
};

export default function ReviewCyclesPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "", cadence: "ANNUAL", startDate: "", endDate: "",
    questions: [{ text: "", questionType: "TEXT", isRequired: true }] as Question[],
  });

  const { data: cycles = [], isLoading } = useQuery<ReviewCycle[]>({
    queryKey: ["review-cycles"],
    queryFn: () => fetch("/api/review-cycles").then((r) => r.json()),
  });

  const { data: selectedCycle } = useQuery({
    queryKey: ["review-cycle", selected],
    queryFn: () => fetch(`/api/review-cycles/${selected}`).then((r) => r.json()),
    enabled: !!selected,
  });

  const create = useMutation({
    mutationFn: () => fetch("/api/review-cycles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    }).then((r) => r.json()),
    onSuccess: (data) => {
      if (data.error) { toast.error(JSON.stringify(data.error)); return; }
      toast.success("Review cycle created");
      setOpen(false);
      setForm({ name: "", cadence: "ANNUAL", startDate: "", endDate: "",
        questions: [{ text: "", questionType: "TEXT", isRequired: true }] });
      qc.invalidateQueries({ queryKey: ["review-cycles"] });
    },
    onError: () => toast.error("Failed to create cycle"),
  });

  const updateStatus = useMutation({
    mutationFn: ({ id, status }: { id: string; status: string }) =>
      fetch(`/api/review-cycles/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      }).then((r) => r.json()),
    onSuccess: () => {
      toast.success("Status updated");
      qc.invalidateQueries({ queryKey: ["review-cycles"] });
    },
  });

  const addQuestion = () =>
    setForm((f) => ({ ...f, questions: [...f.questions, { text: "", questionType: "TEXT", isRequired: true }] }));

  const removeQuestion = (i: number) =>
    setForm((f) => ({ ...f, questions: f.questions.filter((_, j) => j !== i) }));

  const updateQuestion = (i: number, field: keyof Question, value: string | boolean) =>
    setForm((f) => ({ ...f, questions: f.questions.map((q, j) => j === i ? { ...q, [field]: value } : q) }));

  const STATUS_TRANSITIONS: Record<string, string | null> = {
    DRAFT: "ACTIVE", ACTIVE: "COMPLETED", COMPLETED: "ARCHIVED", ARCHIVED: null,
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Performance Review Cycles</h1>
          <p className="text-muted-foreground text-sm mt-1">Create and manage structured performance reviews with custom questions</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <Button onClick={() => setOpen(true)}><Plus className="w-4 h-4 mr-2" />New Review Cycle</Button>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Create Review Cycle</DialogTitle></DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="space-y-1">
                <Label>Cycle Name</Label>
                <Input value={form.name} onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
                  placeholder="e.g., Annual Review FY 2026-27" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Cadence</Label>
                  <Select value={form.cadence} onValueChange={(v) => v && setForm((f) => ({ ...f, cadence: v }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ANNUAL">Annual</SelectItem>
                      <SelectItem value="SEMI_ANNUAL">Semi-Annual</SelectItem>
                      <SelectItem value="QUARTERLY">Quarterly</SelectItem>
                      <SelectItem value="MONTHLY">Monthly</SelectItem>
                      <SelectItem value="AD_HOC">Ad-hoc</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <Label>Start Date</Label>
                  <Input type="date" value={form.startDate} onChange={(e) => setForm((f) => ({ ...f, startDate: e.target.value }))} />
                </div>
                <div className="space-y-1">
                  <Label>End Date</Label>
                  <Input type="date" value={form.endDate} onChange={(e) => setForm((f) => ({ ...f, endDate: e.target.value }))} />
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label>Review Questions</Label>
                  <Button type="button" variant="outline" size="sm" onClick={addQuestion}>
                    <Plus className="w-3 h-3 mr-1" />Add
                  </Button>
                </div>
                {form.questions.map((q, i) => (
                  <div key={i} className="border rounded-lg p-3 space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground w-4">{i + 1}.</span>
                      <Input value={q.text} onChange={(e) => updateQuestion(i, "text", e.target.value)}
                        placeholder="Question text…" className="flex-1 text-sm" />
                      {form.questions.length > 1 && (
                        <button onClick={() => removeQuestion(i)} className="text-destructive hover:opacity-70">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                    <div className="flex items-center gap-3 pl-6">
                      <Select value={q.questionType} onValueChange={(v) => v && updateQuestion(i, "questionType", v)}>
                        <SelectTrigger className="w-36 h-7 text-xs"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {QUESTION_TYPES.map((t) => <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>)}
                        </SelectContent>
                      </Select>
                      <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                        <input type="checkbox" checked={q.isRequired} onChange={(e) => updateQuestion(i, "isRequired", e.target.checked)} />
                        Required
                      </label>
                    </div>
                  </div>
                ))}
              </div>

              <Button className="w-full" disabled={!form.name || !form.startDate || !form.endDate || create.isPending}
                onClick={() => create.mutate()}>
                {create.isPending ? "Creating…" : "Create Review Cycle"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="space-y-3">
          {isLoading ? (
            [1,2,3].map((i) => <div key={i} className="h-24 bg-muted rounded-xl animate-pulse" />)
          ) : cycles.length === 0 ? (
            <Card><CardContent className="py-12 text-center">
              <ClipboardList className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No review cycles yet</p>
            </CardContent></Card>
          ) : cycles.map((cycle) => (
            <Card key={cycle.id}
              className={`cursor-pointer transition-all ${selected === cycle.id ? "ring-2 ring-primary" : "hover:shadow-md"}`}
              onClick={() => setSelected(cycle.id)}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium truncate pr-2">{cycle.name}</span>
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full whitespace-nowrap ${STATUS_COLOR[cycle.status]}`}>
                    {cycle.status}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">{cycle.cadence} · {format(new Date(cycle.startDate), "MMM d")} – {format(new Date(cycle.endDate), "MMM d, yyyy")}</p>
                <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><MessageSquare className="w-3 h-3" />{cycle._count.questions} questions</span>
                  <span className="flex items-center gap-1"><Users className="w-3 h-3" />{cycle._count.responses} responses</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="lg:col-span-2">
          {selectedCycle && !selectedCycle.error ? (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>{selectedCycle.name}</CardTitle>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      {format(new Date(selectedCycle.startDate), "MMM d")} – {format(new Date(selectedCycle.endDate), "MMM d, yyyy")}
                    </p>
                  </div>
                  {STATUS_TRANSITIONS[selectedCycle.status] && (
                    <Button size="sm" variant="outline"
                      onClick={() => updateStatus.mutate({ id: selectedCycle.id, status: STATUS_TRANSITIONS[selectedCycle.status]! })}>
                      Move to {STATUS_TRANSITIONS[selectedCycle.status]}
                      <ChevronRight className="w-3 h-3 ml-1" />
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-sm font-semibold mb-3">Review Questions ({selectedCycle.questions?.length ?? 0})</p>
                  <div className="space-y-2">
                    {(selectedCycle.questions ?? []).map((q: { id: string; text: string; questionType: string; isRequired: boolean; order: number }, i: number) => (
                      <div key={q.id} className="border rounded-lg p-3">
                        <div className="flex items-start gap-3">
                          <span className="text-xs text-muted-foreground mt-0.5 w-5">{i + 1}.</span>
                          <div className="flex-1">
                            <p className="text-sm">{q.text}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <Badge variant="outline" className="text-[10px]">{q.questionType}</Badge>
                              {q.isRequired && <span className="text-[10px] text-red-500">Required</span>}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="border-t pt-4">
                  <p className="text-sm font-semibold mb-2">Response Summary</p>
                  <p className="text-sm text-muted-foreground">{selectedCycle._count?.responses ?? 0} responses submitted</p>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card><CardContent className="py-20 text-center">
              <ClipboardList className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground">Select a review cycle to view details</p>
            </CardContent></Card>
          )}
        </div>
      </div>
    </div>
  );
}
