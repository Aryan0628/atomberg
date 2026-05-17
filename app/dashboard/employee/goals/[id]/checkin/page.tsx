// Employee quarterly check-in form with live score preview
"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { useGoal, useCheckin } from "@/hooks/useGoals";
import { useCurrentCycle } from "@/hooks/useCycle";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { computeScore } from "@/lib/scoring";
import { getScoreColor, getScoreLabel, getScoreBgColor } from "@/lib/scoring";
import { getUoMLabel, formatDate } from "@/lib/utils";
import { ArrowLeft, Target, Calculator, Star, CheckCircle } from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";

const QUARTERS = ["Q1", "Q2", "Q3", "Q4"] as const;

function isWindowOpen(cycle: Record<string, unknown>, quarter: string): boolean {
  const now = new Date();
  const windows: Record<string, [Date, Date]> = {
    Q1: [new Date(cycle.q1Open as string), new Date(cycle.q1Close as string)],
    Q2: [new Date(cycle.q2Open as string), new Date(cycle.q2Close as string)],
    Q3: [new Date(cycle.q3Open as string), new Date(cycle.q3Close as string)],
    Q4: [new Date(cycle.q4Open as string), new Date(cycle.q4Close as string)],
  };
  const [open, close] = windows[quarter] ?? [];
  return open && close ? now >= open && now <= close : false;
}

export default function CheckinPage() {
  const params = useParams();
  const router = useRouter();
  const goalId = params.id as string;

  const { data: goal, isLoading: goalLoading } = useGoal(goalId);
  const { data: cycle, isLoading: cycleLoading } = useCurrentCycle();
  const checkin = useCheckin();

  const [selectedQuarter, setSelectedQuarter] = useState<string>("");
  const [actualValue, setActualValue] = useState<string>("");
  const [actualDate, setActualDate] = useState<string>("");
  const [progressStatus, setProgressStatus] = useState<string>("ON_TRACK");
  const [employeeNote, setEmployeeNote] = useState<string>("");
  const [selfRating, setSelfRating] = useState<number>(0);
  const [whatWentWell, setWhatWentWell] = useState<string>("");
  const [blockers, setBlockers] = useState<string>("");
  const [liveScore, setLiveScore] = useState<number | null>(null);

  // Compute live score as user types
  useEffect(() => {
    if (!goal) return;
    const score = computeScore({
      uomType: goal.uomType,
      target: goal.target,
      targetDate: goal.targetDate ? new Date(goal.targetDate) : null,
      actualValue: actualValue !== "" ? parseFloat(actualValue) : null,
      actualDate: actualDate ? new Date(actualDate) : null,
    });
    setLiveScore(actualValue !== "" || actualDate !== "" ? score : null);
  }, [actualValue, actualDate, goal]);

  // Auto-select an open quarter
  useEffect(() => {
    if (!cycle) return;
    const open = QUARTERS.find((q) => isWindowOpen(cycle, q));
    if (open) setSelectedQuarter(open);
  }, [cycle]);

  const existingCheckin = goal?.checkins?.find((c: Record<string, unknown>) => c.quarter === selectedQuarter);

  // Pre-fill from existing check-in if editing
  useEffect(() => {
    if (existingCheckin) {
      setActualValue(existingCheckin.actualValue != null ? String(existingCheckin.actualValue) : "");
      setActualDate(existingCheckin.actualDate ? new Date(existingCheckin.actualDate).toISOString().slice(0, 10) : "");
      setProgressStatus(existingCheckin.progressStatus || "ON_TRACK");
      setEmployeeNote(existingCheckin.employeeNote || "");
      setSelfRating(existingCheckin.selfRating || 0);
      setWhatWentWell(existingCheckin.whatWentWell || "");
      setBlockers(existingCheckin.blockers || "");
    }
  }, [existingCheckin]);

  if (goalLoading || cycleLoading) {
    return (
      <div className="space-y-6 max-w-2xl">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-48" />
        <Skeleton className="h-64" />
      </div>
    );
  }

  if (!goal) {
    return <div className="flex items-center justify-center h-64"><p className="text-slate-400">Goal not found</p></div>;
  }

  if (!goal.isLocked) {
    return (
      <div className="max-w-2xl space-y-4">
        <Link href={`/dashboard/employee/goals/${goalId}`} className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700">
          <ArrowLeft className="w-4 h-4" /> Back to Goal
        </Link>
        <Card>
          <CardContent className="py-12 text-center">
            <Target className="w-12 h-12 text-amber-400 mx-auto mb-4" />
            <p className="text-lg font-medium">Goal not yet locked</p>
            <p className="text-sm text-slate-400">Check-ins are only available after the goal setting window closes and your goal is locked.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const openQuarters = cycle ? QUARTERS.filter((q) => isWindowOpen(cycle, q)) : [];
  const noOpenWindow = openQuarters.length === 0;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedQuarter) { toast.error("Please select a quarter"); return; }

    try {
      const data = {
        goalId,
        quarter: selectedQuarter,
        progressStatus,
        employeeNote: employeeNote || undefined,
        selfRating: selfRating > 0 ? selfRating : undefined,
        whatWentWell: whatWentWell || undefined,
        blockers: blockers || undefined,
        actualValue: ["NUMERIC_MIN", "NUMERIC_MAX", "PERCENTAGE", "ZERO"].includes(goal.uomType) && actualValue !== ""
          ? parseFloat(actualValue) : undefined,
        actualDate: goal.uomType === "TIMELINE" ? actualDate || undefined : undefined,
      } as { goalId: string; quarter: string; progressStatus: string; employeeNote?: string; selfRating?: number; whatWentWell?: string; blockers?: string; actualValue?: number; actualDate?: string };

      const result = await checkin.mutateAsync(data);
      toast.success(`${selectedQuarter} check-in submitted! Score: ${result.score.toFixed(1)}%`);
      router.push(`/dashboard/employee/goals/${goalId}`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to submit check-in");
    }
  }

  return (
    <div className="space-y-6 max-w-2xl">
      <div className="flex items-center gap-3">
        <Link href={`/dashboard/employee/goals/${goalId}`} className="flex items-center gap-2 text-sm text-slate-500 hover:text-slate-700 dark:hover:text-slate-300">
          <ArrowLeft className="w-4 h-4" /> Back to Goal
        </Link>
      </div>

      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Quarterly Check-in</h1>
        <p className="text-slate-500 mt-1">{goal.title}</p>
      </div>

      {/* Goal Context Card */}
      <Card>
        <CardContent className="p-4">
          <div className="grid grid-cols-3 gap-4 text-sm">
            <div>
              <p className="text-slate-400 text-xs mb-1">UoM Type</p>
              <Badge variant="outline">{getUoMLabel(goal.uomType)}</Badge>
            </div>
            {goal.target !== null && (
              <div>
                <p className="text-slate-400 text-xs mb-1">Target</p>
                <p className="font-semibold">{goal.target} {goal.uomUnit || ""}</p>
              </div>
            )}
            {goal.targetDate && (
              <div>
                <p className="text-slate-400 text-xs mb-1">Due Date</p>
                <p className="font-semibold">{formatDate(goal.targetDate)}</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {noOpenWindow ? (
        <Card>
          <CardContent className="py-12 text-center">
            <CheckCircle className="w-12 h-12 text-slate-300 mx-auto mb-4" />
            <p className="text-lg font-medium text-slate-600">No check-in window is currently open</p>
            <p className="text-sm text-slate-400">Check-in windows open on the quarter start dates configured by your admin.</p>
          </CardContent>
        </Card>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Quarter Selection */}
          <Card>
            <CardHeader><CardTitle className="text-base">Select Quarter</CardTitle></CardHeader>
            <CardContent>
              <div className="flex gap-2">
                {QUARTERS.map((q) => {
                  const isOpen = cycle ? isWindowOpen(cycle, q) : false;
                  const hasCheckin = goal.checkins?.some((c: Record<string, unknown>) => c.quarter === q);
                  return (
                    <button
                      key={q}
                      type="button"
                      disabled={!isOpen}
                      onClick={() => setSelectedQuarter(q)}
                      className={`flex-1 py-2 px-4 rounded-lg border text-sm font-medium transition-all ${
                        selectedQuarter === q
                          ? "bg-blue-600 text-white border-blue-600"
                          : isOpen
                          ? "border-blue-200 text-blue-700 hover:bg-blue-50 dark:border-blue-800 dark:text-blue-400"
                          : "border-slate-200 text-slate-400 cursor-not-allowed dark:border-slate-800"
                      }`}
                    >
                      {q}
                      {hasCheckin && <span className="ml-1 text-xs">(edit)</span>}
                      {!isOpen && <span className="block text-[10px] opacity-50">Closed</span>}
                    </button>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Actual Values */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Calculator className="w-4 h-4" /> Actual Performance
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {["NUMERIC_MIN", "NUMERIC_MAX", "PERCENTAGE", "ZERO"].includes(goal.uomType) && (
                <div className="space-y-2">
                  <Label htmlFor="actualValue">
                    Actual Value {goal.uomUnit ? `(${goal.uomUnit})` : ""}
                  </Label>
                  <Input
                    id="actualValue"
                    type="number"
                    step="any"
                    placeholder={`Target: ${goal.target} ${goal.uomUnit || ""}`}
                    value={actualValue}
                    onChange={(e) => setActualValue(e.target.value)}
                  />
                </div>
              )}

              {goal.uomType === "TIMELINE" && (
                <div className="space-y-2">
                  <Label htmlFor="actualDate">Actual Completion Date</Label>
                  <Input
                    id="actualDate"
                    type="date"
                    value={actualDate}
                    onChange={(e) => setActualDate(e.target.value)}
                  />
                  <p className="text-xs text-slate-400">Target: {formatDate(goal.targetDate)}</p>
                </div>
              )}

              {/* Live Score Preview */}
              {liveScore !== null && (
                <div className={`rounded-lg p-4 ${getScoreBgColor(liveScore)} border`}>
                  <p className="text-xs text-slate-500 mb-1 flex items-center gap-1">
                    <Calculator className="w-3 h-3" /> Live Score Preview
                  </p>
                  <p className={`text-2xl font-bold ${getScoreColor(liveScore)}`}>
                    {liveScore.toFixed(1)}%
                  </p>
                  <p className={`text-sm font-medium ${getScoreColor(liveScore)}`}>
                    {getScoreLabel(liveScore)}
                  </p>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="progressStatus">Progress Status</Label>
                <Select value={progressStatus} onValueChange={(v) => v && setProgressStatus(v)}>
                  <SelectTrigger id="progressStatus">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="NOT_STARTED">Not Started</SelectItem>
                    <SelectItem value="ON_TRACK">On Track</SelectItem>
                    <SelectItem value="AT_RISK">At Risk</SelectItem>
                    <SelectItem value="COMPLETED">Completed</SelectItem>
                    <SelectItem value="OVERDUE">Overdue</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Self Assessment */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Star className="w-4 h-4" /> Self Assessment
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Self Rating</Label>
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setSelfRating(selfRating === n ? 0 : n)}
                      className={`text-2xl transition-all hover:scale-110 ${n <= selfRating ? "text-amber-400" : "text-slate-200 dark:text-slate-700"}`}
                    >
                      ★
                    </button>
                  ))}
                  {selfRating > 0 && <span className="text-sm text-slate-500 self-center ml-2">{selfRating}/5</span>}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="employeeNote">Progress Notes</Label>
                <Textarea
                  id="employeeNote"
                  placeholder="Summarize your progress this quarter..."
                  value={employeeNote}
                  onChange={(e) => setEmployeeNote(e.target.value)}
                  rows={3}
                  maxLength={500}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="whatWentWell">What went well? ✓</Label>
                <Textarea
                  id="whatWentWell"
                  placeholder="Highlight your wins and what contributed to them..."
                  value={whatWentWell}
                  onChange={(e) => setWhatWentWell(e.target.value)}
                  rows={2}
                  maxLength={500}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="blockers">Blockers ⚠</Label>
                <Textarea
                  id="blockers"
                  placeholder="Any challenges, dependencies, or blockers you faced..."
                  value={blockers}
                  onChange={(e) => setBlockers(e.target.value)}
                  rows={2}
                  maxLength={500}
                />
              </div>
            </CardContent>
          </Card>

          <div className="flex gap-3">
            <Button type="submit" disabled={!selectedQuarter || checkin.isPending} className="flex-1">
              {checkin.isPending ? "Submitting..." : existingCheckin ? "Update Check-in" : "Submit Check-in"}
            </Button>
            <Button type="button" variant="outline" onClick={() => router.push(`/dashboard/employee/goals/${goalId}`)}>
              Cancel
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
