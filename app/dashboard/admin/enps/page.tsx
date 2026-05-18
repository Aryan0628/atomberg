"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Smile, Plus, TrendingUp, TrendingDown, Minus } from "lucide-react";
import { format } from "date-fns";
import { RadialBarChart, RadialBar, ResponsiveContainer, Tooltip } from "recharts";

const STATUS_COLOR: Record<string, string> = {
  DRAFT: "bg-slate-100 text-slate-700",
  ACTIVE: "bg-green-100 text-green-700",
  CLOSED: "bg-gray-100 text-gray-500",
};

type ENPSSurvey = {
  id: string; title: string; status: string; question: string;
  startDate: string; endDate: string;
  _count: { responses: number };
};

type ENPSResults = {
  total: number; promoters: number; passives: number; detractors: number; nps: number;
  responses: { score: number; comment: string | null; createdAt: string }[];
};

function NPSGauge({ nps }: { nps: number }) {
  const clamped = Math.max(-100, Math.min(100, nps));
  const color = clamped >= 50 ? "#16a34a" : clamped >= 0 ? "#d97706" : "#dc2626";
  const data = [{ value: Math.abs(clamped), fill: color }];

  return (
    <div className="flex flex-col items-center">
      <div className="relative w-40 h-20">
        <ResponsiveContainer width="100%" height={80}>
          <RadialBarChart cx="50%" cy="100%" innerRadius="60%" outerRadius="100%"
            startAngle={180} endAngle={0} data={data}>
            <RadialBar background dataKey="value" cornerRadius={4} />
            <Tooltip formatter={(v) => [`${nps > 0 ? "+" : ""}${Math.round(nps)}`, "eNPS"]} />
          </RadialBarChart>
        </ResponsiveContainer>
        <div className="absolute inset-x-0 bottom-0 text-center">
          <span className="text-2xl font-bold" style={{ color }}>{nps > 0 ? "+" : ""}{Math.round(nps)}</span>
        </div>
      </div>
      <p className="text-xs text-muted-foreground mt-1">eNPS Score</p>
    </div>
  );
}

export default function ENPSPage() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [form, setForm] = useState({
    title: "", question: "How likely are you to recommend Atomberg as a great place to work? (0-10)",
    startDate: "", endDate: "",
  });

  const { data: surveys = [], isLoading } = useQuery<ENPSSurvey[]>({
    queryKey: ["enps-surveys"],
    queryFn: () => fetch("/api/enps").then((r) => r.json()),
  });

  const { data: results } = useQuery<ENPSResults>({
    queryKey: ["enps-results", selectedId],
    queryFn: () => fetch(`/api/enps/respond?surveyId=${selectedId}`).then((r) => r.json()),
    enabled: !!selectedId,
  });

  const create = useMutation({
    mutationFn: () => fetch("/api/enps", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    }).then((r) => r.json()),
    onSuccess: (data) => {
      if (data.error) { toast.error(data.error); return; }
      toast.success("eNPS survey created");
      setOpen(false);
      setForm({ title: "", question: "How likely are you to recommend Atomberg as a great place to work? (0-10)", startDate: "", endDate: "" });
      qc.invalidateQueries({ queryKey: ["enps-surveys"] });
    },
    onError: () => toast.error("Failed to create survey"),
  });

  const selected = surveys.find((s) => s.id === selectedId);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Employee NPS (eNPS)</h1>
          <p className="text-muted-foreground text-sm mt-1">Measure and track employee satisfaction and advocacy</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <Button onClick={() => setOpen(true)}><Plus className="w-4 h-4 mr-2" />New Survey</Button>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>Create eNPS Survey</DialogTitle></DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="space-y-1">
                <Label>Survey Title</Label>
                <Input value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                  placeholder="e.g., Q2 2026 eNPS Survey" />
              </div>
              <div className="space-y-1">
                <Label>Question</Label>
                <Textarea value={form.question} onChange={(e) => setForm((f) => ({ ...f, question: e.target.value }))} rows={3} />
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
              <div className="bg-muted/50 rounded-lg p-3 text-xs text-muted-foreground">
                <p className="font-medium mb-1">eNPS Scoring:</p>
                <p>9-10 = Promoters · 7-8 = Passives · 0-6 = Detractors</p>
                <p className="mt-1">eNPS = % Promoters − % Detractors (range: −100 to +100)</p>
              </div>
              <Button className="w-full" disabled={!form.title || !form.startDate || !form.endDate || create.isPending}
                onClick={() => create.mutate()}>
                {create.isPending ? "Creating…" : "Create Survey"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="space-y-3">
          {isLoading ? (
            [1,2].map((i) => <div key={i} className="h-24 bg-muted rounded-xl animate-pulse" />)
          ) : surveys.length === 0 ? (
            <Card><CardContent className="py-12 text-center">
              <Smile className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No surveys yet</p>
            </CardContent></Card>
          ) : surveys.map((s) => (
            <Card key={s.id}
              className={`cursor-pointer transition-all ${selectedId === s.id ? "ring-2 ring-primary" : "hover:shadow-md"}`}
              onClick={() => setSelectedId(s.id)}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium truncate pr-2">{s.title}</span>
                  <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${STATUS_COLOR[s.status]}`}>
                    {s.status}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {format(new Date(s.startDate), "MMM d")} – {format(new Date(s.endDate), "MMM d, yyyy")}
                </p>
                <p className="text-xs text-muted-foreground mt-1">{s._count.responses} responses</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="lg:col-span-2">
          {selected && results ? (
            <div className="space-y-4">
              <Card>
                <CardHeader className="pb-2">
                  <CardTitle>{selected.title}</CardTitle>
                  <p className="text-sm text-muted-foreground">{selected.question}</p>
                </CardHeader>
                <CardContent>
                  <div className="flex items-start gap-8">
                    <NPSGauge nps={results.nps} />
                    <div className="flex-1 grid grid-cols-3 gap-3">
                      <div className="text-center p-3 bg-green-50 rounded-lg">
                        <TrendingUp className="w-5 h-5 text-green-600 mx-auto mb-1" />
                        <p className="text-xl font-bold text-green-600">{results.promoters}</p>
                        <p className="text-xs text-muted-foreground">Promoters</p>
                        <p className="text-xs text-green-600">{results.total ? Math.round(results.promoters / results.total * 100) : 0}%</p>
                      </div>
                      <div className="text-center p-3 bg-amber-50 rounded-lg">
                        <Minus className="w-5 h-5 text-amber-600 mx-auto mb-1" />
                        <p className="text-xl font-bold text-amber-600">{results.passives}</p>
                        <p className="text-xs text-muted-foreground">Passives</p>
                        <p className="text-xs text-amber-600">{results.total ? Math.round(results.passives / results.total * 100) : 0}%</p>
                      </div>
                      <div className="text-center p-3 bg-red-50 rounded-lg">
                        <TrendingDown className="w-5 h-5 text-red-600 mx-auto mb-1" />
                        <p className="text-xl font-bold text-red-600">{results.detractors}</p>
                        <p className="text-xs text-muted-foreground">Detractors</p>
                        <p className="text-xs text-red-600">{results.total ? Math.round(results.detractors / results.total * 100) : 0}%</p>
                      </div>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground text-center mt-3">Total responses: {results.total}</p>
                </CardContent>
              </Card>

              {results.responses.filter((r) => r.comment).length > 0 && (
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-base">Comments ({results.responses.filter((r) => r.comment).length})</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3 max-h-60 overflow-y-auto">
                      {results.responses.filter((r) => r.comment).map((r, i) => (
                        <div key={i} className="flex items-start gap-3 text-sm border-b last:border-0 pb-3">
                          <Badge variant="outline" className={`text-xs flex-shrink-0 ${r.score >= 9 ? "border-green-300 text-green-700" : r.score >= 7 ? "border-amber-300 text-amber-700" : "border-red-300 text-red-700"}`}>
                            {r.score}
                          </Badge>
                          <p className="text-muted-foreground italic flex-1">&ldquo;{r.comment}&rdquo;</p>
                          <span className="text-xs text-muted-foreground flex-shrink-0">
                            {format(new Date(r.createdAt), "MMM d")}
                          </span>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          ) : selectedId ? (
            <Card><CardContent className="py-12 text-center">
              <div className="h-8 bg-muted rounded animate-pulse w-32 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">Loading results…</p>
            </CardContent></Card>
          ) : (
            <Card><CardContent className="py-20 text-center">
              <Smile className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground">Select a survey to view results</p>
            </CardContent></Card>
          )}
        </div>
      </div>
    </div>
  );
}
