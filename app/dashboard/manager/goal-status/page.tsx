"use client";

import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatDistanceToNow, format } from "date-fns";
import { Search, Target, Clock, TrendingUp } from "lucide-react";

const STATUS_COLOR: Record<string, string> = {
  DRAFT: "bg-slate-100 text-slate-700",
  SUBMITTED: "bg-blue-100 text-blue-700",
  APPROVED: "bg-green-100 text-green-700",
  REJECTED: "bg-red-100 text-red-700",
  RETURNED: "bg-amber-100 text-amber-700",
  LOCKED: "bg-purple-100 text-purple-700",
  CANCELLED: "bg-gray-100 text-gray-500",
};

type Goal = {
  id: string; title: string; status: string; weightage: number;
  latestScore: number | null; updatedAt: string; thrustArea: string;
  owner: { id: string; name: string; department: string };
};

export default function GoalStatusReportPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");

  const { data: goals = [], isLoading } = useQuery<Goal[]>({
    queryKey: ["team-goals"],
    queryFn: () => fetch("/api/goals").then((r) => r.json()),
  });

  const filtered = goals.filter((g) => {
    const matchSearch = g.title.toLowerCase().includes(search.toLowerCase()) ||
      g.owner.name.toLowerCase().includes(search.toLowerCase());
    const matchStatus = statusFilter === "ALL" || g.status === statusFilter;
    return matchSearch && matchStatus;
  });

  // Group by employee
  const grouped = filtered.reduce<Record<string, { employee: Goal["owner"]; goals: Goal[] }>>((acc, g) => {
    if (!acc[g.owner.id]) acc[g.owner.id] = { employee: g.owner, goals: [] };
    acc[g.owner.id].goals.push(g);
    return acc;
  }, {});

  const staleDays = 7;
  // Capture once per render cycle — avoids calling Date.now() on every list item
  // and prevents hydration mismatch between server and client render.
  const now = useMemo(() => Date.now(), []);
  const isStale = (updatedAt: string) => {
    const diff = (now - new Date(updatedAt).getTime()) / (1000 * 60 * 60 * 24);
    return diff > staleDays;
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Goal Status Report</h1>
        <p className="text-muted-foreground text-sm mt-1">All direct reports — goals, progress, and last activity</p>
      </div>

      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search employee or goal…" className="pl-9" />
        </div>
        <Select value={statusFilter} onValueChange={(v) => v && setStatusFilter(v)}>
          <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Statuses</SelectItem>
            {["DRAFT","SUBMITTED","APPROVED","LOCKED","REJECTED","RETURNED","CANCELLED"].map((s) => (
              <SelectItem key={s} value={s}>{s}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="space-y-4">{[1,2,3].map((i) => <div key={i} className="h-40 rounded-xl bg-muted animate-pulse" />)}</div>
      ) : Object.keys(grouped).length === 0 ? (
        <Card><CardContent className="py-16 text-center">
          <Target className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">No goals found</p>
        </CardContent></Card>
      ) : (
        <div className="space-y-4">
          {Object.values(grouped).map(({ employee, goals: empGoals }) => (
            <Card key={employee.id}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-base">{employee.name}</CardTitle>
                    <p className="text-xs text-muted-foreground">{employee.department}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-muted-foreground">{empGoals.length} goal{empGoals.length !== 1 ? "s" : ""}</p>
                    <p className="text-sm font-semibold">
                      {empGoals.filter((g) => g.latestScore).length > 0
                        ? Math.round(empGoals.reduce((s, g) => s + (g.latestScore ?? 0), 0) / empGoals.filter((g) => g.latestScore !== null).length) + "% avg"
                        : "—"}
                    </p>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="divide-y divide-border">
                  {empGoals.map((g) => (
                    <div key={g.id} className="py-2.5 flex items-center gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium truncate">{g.title}</p>
                          {isStale(g.updatedAt) && <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full whitespace-nowrap">No update {staleDays}d+</span>}
                        </div>
                        <p className="text-xs text-muted-foreground">{g.thrustArea} · {g.weightage}% weight</p>
                      </div>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        {g.latestScore !== null && (
                          <div className="flex items-center gap-1 text-xs">
                            <TrendingUp className="w-3 h-3" />
                            <span className={g.latestScore >= 80 ? "text-green-600" : g.latestScore >= 60 ? "text-amber-600" : "text-red-600"}>
                              {Math.round(g.latestScore)}%
                            </span>
                          </div>
                        )}
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${STATUS_COLOR[g.status] ?? ""}`}>{g.status}</span>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Clock className="w-3 h-3" />
                          {formatDistanceToNow(new Date(g.updatedAt), { addSuffix: true })}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
