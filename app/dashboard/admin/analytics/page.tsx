"use client";

import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { BarChart3 } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, Legend, ScatterChart, Scatter,
  ZAxis, ReferenceLine,
} from "recharts";

const COLORS = ["#3B82F6", "#10B981", "#F59E0B", "#8B5CF6", "#EC4899", "#06B6D4", "#6366F1", "#EF4444"];
const DEPT_COLORS = ["#3B82F6", "#10B981", "#F59E0B", "#8B5CF6", "#EC4899", "#06B6D4", "#6366F1", "#EF4444"];

// ─── Data Hooks ──────────────────────────────────────────────

function useOverview() {
  return useQuery({
    queryKey: ["analytics", "overview"],
    queryFn: async () => { const r = await fetch("/api/analytics/overview"); if (!r.ok) return null; return r.json(); },
    staleTime: 60_000,
  });
}
function useDistribution() {
  return useQuery({
    queryKey: ["analytics", "distribution"],
    queryFn: async () => { const r = await fetch("/api/analytics/distribution"); if (!r.ok) return null; return r.json(); },
    staleTime: 60_000,
  });
}
function useQoQ() {
  return useQuery({
    queryKey: ["analytics", "qoq"],
    queryFn: async () => { const r = await fetch("/api/analytics/qoq"); if (!r.ok) return null; return r.json(); },
    staleTime: 60_000,
  });
}
function useManagerEffectiveness() {
  return useQuery({
    queryKey: ["analytics", "mgr-effectiveness"],
    queryFn: async () => { const r = await fetch("/api/analytics/manager-effectiveness"); if (!r.ok) return null; return r.json(); },
    staleTime: 60_000,
  });
}

// ─── Commitment vs Achievement (scatter) ─────────────────────
function useCommitmentAchievement() {
  return useQuery({
    queryKey: ["analytics", "commitment-achievement"],
    queryFn: async () => {
      const checkinsRes = await fetch("/api/analytics/heatmap");
      const heatmap = checkinsRes.ok ? await checkinsRes.json() : { cells: [] };

      // Compute per-employee avg score and submission rate
      const empMap: Record<string, { name: string; department: string; scores: number[]; total: number; filled: number }> = {};
      for (const cell of heatmap.cells || []) {
        if (!empMap[cell.employeeId]) {
          empMap[cell.employeeId] = { name: cell.employeeName, department: cell.department, scores: [], total: 0, filled: 0 };
        }
        empMap[cell.employeeId].total++;
        if (cell.score >= 0) {
          empMap[cell.employeeId].scores.push(cell.score);
          empMap[cell.employeeId].filled++;
        }
      }

      return Object.entries(empMap).map(([id, d]) => ({
        id,
        name: d.name,
        department: d.department,
        achievementScore: d.scores.length > 0 ? Math.round(d.scores.reduce((a, b) => a + b, 0) / d.scores.length) : 0,
        commitmentRate: d.total > 0 ? Math.round((d.filled / d.total) * 100) : 0,
      }));
    },
    staleTime: 60_000,
  });
}

// ─── Main Page ───────────────────────────────────────────────

export default function AdminAnalyticsPage() {
  const { data: overview, isLoading: ovLoading } = useOverview();
  const { data: dist } = useDistribution();
  const { data: qoq } = useQoQ();
  const { data: mgr } = useManagerEffectiveness();
  const { data: commitData } = useCommitmentAchievement();

  if (ovLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48" />
        <div className="grid grid-cols-4 gap-4">{[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-24" />)}</div>
        <Skeleton className="h-80" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <BarChart3 className="w-6 h-6 text-slate-600 dark:text-slate-400" />
        <h1 className="text-2xl font-bold">Analytics</h1>
        {overview?.cycleName && <Badge variant="outline">{overview.cycleName}</Badge>}
      </div>

      {/* KPI Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPI label="Total Goals" value={overview?.totalGoals ?? "—"} />
        <KPI label="Avg Score" value={overview?.avgScore ? `${overview.avgScore}%` : "—"} color={overview?.avgScore >= 80 ? "green" : overview?.avgScore >= 60 ? "amber" : "red"} />
        <KPI label="Check-in Rate" value={overview?.checkinCompletionRate ? `${overview.checkinCompletionRate}%` : "—"} />
        <KPI label="Employees" value={overview?.totalEmployees ?? "—"} />
      </div>

      <Tabs defaultValue="overview">
        <TabsList className="flex-wrap h-auto">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="qoq">QoQ Trends</TabsTrigger>
          <TabsTrigger value="manager">Manager Effectiveness</TabsTrigger>
          <TabsTrigger value="quadrant">Performance Quadrant</TabsTrigger>
          <TabsTrigger value="distribution">Distribution</TabsTrigger>
        </TabsList>

        {/* ── Overview Tab ── */}
        <TabsContent value="overview" className="space-y-6 mt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader><CardTitle className="text-base">Goal Status Distribution</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={dist?.byStatus || []}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="name" fontSize={10} />
                    <YAxis fontSize={10} />
                    <Tooltip />
                    <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                      {(dist?.byStatus || []).map((_: unknown, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base">Goals by Thrust Area</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={280}>
                  <PieChart>
                    <Pie
                      data={dist?.byThrustArea || []}
                      cx="50%" cy="50%"
                      outerRadius={100}
                      dataKey="count"
                      fontSize={10}
                    >
                      {(dist?.byThrustArea || []).map((_: unknown, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card className="md:col-span-2">
              <CardHeader><CardTitle className="text-base">Score Distribution</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={dist?.scoreDistribution || []}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="range" fontSize={11} />
                    <YAxis fontSize={11} />
                    <Tooltip />
                    <Bar dataKey="count" name="Goals" fill="#8B5CF6" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* ── QoQ Trends Tab ── */}
        <TabsContent value="qoq" className="mt-6">
          <Card>
            <CardHeader><CardTitle className="text-base">Quarter-over-Quarter Achievement by Department</CardTitle></CardHeader>
            <CardContent>
              {!qoq?.data || qoq.data.length === 0 ? (
                <p className="text-sm text-slate-400 py-8 text-center">No check-in data yet for QoQ trends</p>
              ) : (
                <ResponsiveContainer width="100%" height={380}>
                  <LineChart data={qoq.data}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="department" fontSize={11} />
                    <YAxis domain={[0, 100]} fontSize={11} unit="%" />
                    <Tooltip formatter={(v) => `${v}%`} />
                    <Legend />
                    {["Q1", "Q2", "Q3", "Q4"].map((q, i) => (
                      <Line
                        key={q}
                        type="monotone"
                        dataKey={q}
                        stroke={DEPT_COLORS[i]}
                        strokeWidth={2}
                        dot={{ r: 4 }}
                      />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Manager Effectiveness Tab ── */}
        <TabsContent value="manager" className="mt-6">
          <Card>
            <CardHeader><CardTitle className="text-base">Manager Effectiveness — Check-in Review Rate</CardTitle></CardHeader>
            <CardContent>
              {!mgr || mgr.length === 0 ? (
                <p className="text-sm text-slate-400 py-8 text-center">No manager data available</p>
              ) : (
                <ResponsiveContainer width="100%" height={350}>
                  <BarChart data={mgr} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis type="number" domain={[0, 100]} fontSize={11} unit="%" />
                    <YAxis dataKey="managerName" type="category" fontSize={11} width={120} />
                    <Tooltip formatter={(v) => `${v}%`} />
                    <Legend />
                    <Bar dataKey="checkinCompletionRate" name="Check-in Rate" radius={[0, 4, 4, 0]}>
                      {mgr.map((m: Record<string, unknown>, i: number) => {
                        const rate = m.checkinCompletionRate as number;
                        const color = rate >= 80 ? "#10B981" : rate >= 50 ? "#F59E0B" : "#EF4444";
                        return <Cell key={i} fill={color} />;
                      })}
                    </Bar>
                    <Bar dataKey="reviewCompletionRate" name="Review Rate" fill="#8B5CF6" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Performance Quadrant Tab ── */}
        <TabsContent value="quadrant" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Commitment vs Achievement Quadrant</CardTitle>
              <p className="text-xs text-slate-400">X = check-in completion rate (commitment), Y = avg achievement score</p>
            </CardHeader>
            <CardContent>
              {!commitData || commitData.length === 0 ? (
                <p className="text-sm text-slate-400 py-8 text-center">No employee data available yet</p>
              ) : (
                <div className="relative">
                  {/* Quadrant labels */}
                  <div className="absolute inset-0 grid grid-cols-2 grid-rows-2 pointer-events-none" style={{ top: 20, bottom: 30, left: 60, right: 20 }}>
                    <div className="border-r border-b border-dashed border-slate-200 dark:border-slate-700 flex items-start justify-start p-2">
                      <span className="text-[10px] text-blue-400 font-medium">⚡ Coasting Stars</span>
                    </div>
                    <div className="border-b border-dashed border-slate-200 dark:border-slate-700 flex items-start justify-end p-2">
                      <span className="text-[10px] text-green-500 font-medium">⭐ True Stars</span>
                    </div>
                    <div className="border-r border-dashed border-slate-200 dark:border-slate-700 flex items-end justify-start p-2">
                      <span className="text-[10px] text-red-400 font-medium">⚠ At Risk</span>
                    </div>
                    <div className="flex items-end justify-end p-2">
                      <span className="text-[10px] text-amber-500 font-medium">💪 Struggling Stars</span>
                    </div>
                  </div>
                  <ResponsiveContainer width="100%" height={420}>
                    <ScatterChart margin={{ top: 20, right: 20, bottom: 30, left: 60 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                      <XAxis
                        type="number" dataKey="commitmentRate"
                        domain={[0, 100]} name="Commitment %"
                        fontSize={11} unit="%"
                        label={{ value: "Commitment (Check-in Rate %)", position: "insideBottom", offset: -10, fontSize: 11 }}
                      />
                      <YAxis
                        type="number" dataKey="achievementScore"
                        domain={[0, 100]} name="Achievement %"
                        fontSize={11} unit="%"
                        label={{ value: "Achievement Score %", angle: -90, position: "insideLeft", fontSize: 11 }}
                      />
                      <ZAxis range={[80, 80]} />
                      <Tooltip
                        cursor={{ strokeDasharray: "3 3" }}
                        content={({ payload }) => {
                          if (!payload?.length) return null;
                          const d = payload[0].payload;
                          return (
                            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-lg p-3 shadow-lg text-xs">
                              <p className="font-semibold">{d.name}</p>
                              <p className="text-slate-500">{d.department}</p>
                              <p>Commitment: <strong>{d.commitmentRate}%</strong></p>
                              <p>Achievement: <strong>{d.achievementScore}%</strong></p>
                            </div>
                          );
                        }}
                      />
                      <ReferenceLine x={70} stroke="#94a3b8" strokeDasharray="4 4" />
                      <ReferenceLine y={70} stroke="#94a3b8" strokeDasharray="4 4" />
                      <Scatter
                        data={commitData}
                        fill="#3B82F6"
                        fillOpacity={0.8}
                        shape={(props: { cx?: number; cy?: number; payload?: { commitmentRate: number; achievementScore: number } }) => {
                          const { cx = 0, cy = 0, payload = { commitmentRate: 0, achievementScore: 0 } } = props;
                          const color = payload.commitmentRate >= 70 && payload.achievementScore >= 70 ? "#10B981"
                            : payload.commitmentRate < 70 && payload.achievementScore >= 70 ? "#3B82F6"
                            : payload.commitmentRate >= 70 && payload.achievementScore < 70 ? "#F59E0B"
                            : "#EF4444";
                          return <circle cx={cx} cy={cy} r={8} fill={color} fillOpacity={0.8} stroke="#fff" strokeWidth={1.5} />;
                        }}
                      />
                    </ScatterChart>
                  </ResponsiveContainer>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* ── Distribution Tab ── */}
        <TabsContent value="distribution" className="mt-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardHeader><CardTitle className="text-base">Goals by UoM Type</CardTitle></CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={dist?.byUoM || []}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                    <XAxis dataKey="name" fontSize={10} />
                    <YAxis fontSize={10} />
                    <Tooltip />
                    <Bar dataKey="count" fill="#6366F1" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader><CardTitle className="text-base">Top Thrust Areas</CardTitle></CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {(dist?.byThrustArea || []).slice(0, 8).map((item: Record<string, unknown>, i: number) => (
                    <div key={item.name as string} className="flex items-center gap-3">
                      <div className="w-3 h-3 rounded-sm flex-shrink-0" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between mb-0.5">
                          <span className="text-sm truncate">{item.name as string}</span>
                          <span className="text-sm font-medium ml-2">{item.count as number}</span>
                        </div>
                        <div className="h-1.5 bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full"
                            style={{
                              width: `${((item.count as number) / (dist?.byThrustArea?.[0]?.count || 1)) * 100}%`,
                              backgroundColor: COLORS[i % COLORS.length],
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function KPI({ label, value, color }: { label: string; value: string | number; color?: "green" | "amber" | "red" }) {
  const colorClass = color === "green" ? "text-green-600" : color === "amber" ? "text-amber-600" : color === "red" ? "text-red-600" : "text-slate-900 dark:text-white";
  return (
    <Card>
      <CardContent className="p-4">
        <p className={`text-2xl font-bold ${colorClass}`}>{value}</p>
        <p className="text-xs text-slate-500 mt-0.5">{label}</p>
      </CardContent>
    </Card>
  );
}
