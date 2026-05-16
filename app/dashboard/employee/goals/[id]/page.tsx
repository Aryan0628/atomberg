// Goal detail page with timeline, comments, and check-in
"use client";

import { useGoal } from "@/hooks/useGoals";
import { useParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { getGoalStatusColor, getUoMLabel, getUoMColor, formatDate, formatScore, formatRelativeTime } from "@/lib/utils";
import { getScoreColor, getScoreLabel } from "@/lib/scoring";
import { Target, Calendar, Weight, BarChart3, Clock, CheckCircle2, XCircle, RotateCcw, Lock, FileText, MessageSquare, ClipboardCheck } from "lucide-react";
import { GoalCommentThread } from "@/components/shared/GoalCommentThread";
import Link from "next/link";

export default function GoalDetailPage() {
  const params = useParams();
  const { data: goal, isLoading } = useGoal(params.id as string);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-40" />
        <Skeleton className="h-60" />
      </div>
    );
  }

  if (!goal) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-slate-400">Goal not found</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{goal.title}</h1>
          {goal.description && (
            <p className="text-slate-500 mt-1">{goal.description}</p>
          )}
        </div>
        <Badge className={`${getGoalStatusColor(goal.status)} text-sm px-3 py-1`}>
          {goal.status.replace("_", " ")}
        </Badge>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <MetricCard icon={Target} label="Thrust Area" value={goal.thrustArea} />
        <MetricCard icon={BarChart3} label="UoM Type" value={getUoMLabel(goal.uomType)} badge badgeClass={getUoMColor(goal.uomType)} />
        <MetricCard icon={Weight} label="Weightage" value={`${goal.weightage}%`} />
        <MetricCard
          icon={BarChart3}
          label="Score"
          value={goal.latestScore !== null ? formatScore(goal.latestScore) : "—"}
          valueClass={goal.latestScore !== null ? getScoreColor(goal.latestScore) : ""}
        />
      </div>

      {/* Target Details */}
      <Card>
        <CardHeader><CardTitle className="text-base">Target Details</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 text-sm">
            {goal.target !== null && (
              <div>
                <span className="text-slate-500">Target Value:</span>
                <span className="ml-2 font-medium">{goal.target} {goal.uomUnit || ""}</span>
              </div>
            )}
            {goal.targetDate && (
              <div>
                <span className="text-slate-500">Target Date:</span>
                <span className="ml-2 font-medium">{formatDate(goal.targetDate)}</span>
              </div>
            )}
            <div>
              <span className="text-slate-500">Owner:</span>
              <span className="ml-2 font-medium">{goal.owner?.name}</span>
            </div>
            {goal.approver && (
              <div>
                <span className="text-slate-500">Approved by:</span>
                <span className="ml-2 font-medium">{goal.approver.name}</span>
              </div>
            )}
            {goal.rejectReason && (
              <div className="col-span-2">
                <span className="text-red-500">Reject Reason:</span>
                <span className="ml-2">{goal.rejectReason}</span>
              </div>
            )}
            {goal.returnReason && (
              <div className="col-span-2">
                <span className="text-amber-500">Return Reason:</span>
                <span className="ml-2">{goal.returnReason}</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Check-ins */}
      {goal.checkins && goal.checkins.length > 0 && (
        <Card>
          <CardHeader><CardTitle className="text-base">Check-ins</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-4">
              {goal.checkins.map((checkin: Record<string, unknown>) => (
                <div key={checkin.id as string} className="p-4 rounded-lg border border-slate-200 dark:border-slate-800">
                  <div className="flex items-center justify-between mb-2">
                    <Badge variant="outline">{checkin.quarter as string}</Badge>
                    <span className={`font-bold ${getScoreColor(checkin.scorePercentage as number)}`}>
                      {formatScore(checkin.scorePercentage as number)}
                    </span>
                  </div>
                  {checkin.actualValue !== null && (
                    <p className="text-sm">Actual: <strong>{checkin.actualValue as number}</strong> {goal.uomUnit || ""}</p>
                  )}
                  {!!checkin.employeeNote && (
                    <p className="text-sm text-slate-500 mt-1">{String(checkin.employeeNote)}</p>
                  )}
                  {!!checkin.selfRating && (
                    <p className="text-sm mt-1">Self Rating: {"⭐".repeat(checkin.selfRating as number)}</p>
                  )}
                  {!!checkin.whatWentWell && (
                    <p className="text-sm text-green-600 mt-1">✓ {String(checkin.whatWentWell)}</p>
                  )}
                  {!!checkin.blockers && (
                    <p className="text-sm text-red-500 mt-1">⚠ {String(checkin.blockers)}</p>
                  )}
                  {!!checkin.managerCheckedIn && (
                    <div className="mt-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                      <p className="text-xs text-slate-400">Manager Review</p>
                      <p className="text-sm">{String(checkin.managerComment ?? "")}</p>
                      {!!checkin.managerRating && (
                        <p className="text-sm">Rating: {"⭐".repeat(checkin.managerRating as number)}</p>
                      )}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Goal Timeline */}
      <Card>
        <CardHeader><CardTitle className="text-base">Timeline</CardTitle></CardHeader>
        <CardContent>
          <div className="space-y-0">
            <TimelineEvent
              icon={FileText} color="blue"
              title="Goal Created"
              date={goal.createdAt}
              detail="Draft status"
            />
            {goal.submittedAt && (
              <TimelineEvent
                icon={CheckCircle2} color="blue"
                title="Submitted for Approval"
                date={goal.submittedAt}
              />
            )}
            {goal.approvedAt && (
              <TimelineEvent
                icon={CheckCircle2} color="green"
                title={`Approved by ${goal.approver?.name || "Manager"}`}
                date={goal.approvedAt}
              />
            )}
            {goal.rejectedAt && (
              <TimelineEvent
                icon={XCircle} color="red"
                title="Rejected"
                date={goal.rejectedAt}
                detail={goal.rejectReason}
              />
            )}
            {goal.returnedAt && (
              <TimelineEvent
                icon={RotateCcw} color="amber"
                title="Returned for Rework"
                date={goal.returnedAt}
                detail={goal.returnReason}
              />
            )}
            {goal.lockedAt && (
              <TimelineEvent
                icon={Lock} color="indigo"
                title="Locked"
                date={goal.lockedAt}
                detail="Goal setting window closed"
              />
            )}
            {goal.checkins?.map((c: Record<string, unknown>) => (
              <TimelineEvent
                key={c.id as string}
                icon={BarChart3} color="purple"
                title={`${c.quarter} Check-in (Score: ${formatScore(c.scorePercentage as number)})`}
                date={c.submittedAt as string}
              />
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Check-in Button (for locked goals) */}
      {goal.isLocked && (
        <div className="flex gap-3">
          <Link href={`/dashboard/employee/goals/${goal.id}/checkin`} className="flex-1">
            <button className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg py-2.5 px-4 text-sm font-medium transition-colors">
              <ClipboardCheck className="w-4 h-4" /> Submit / Update Check-in
            </button>
          </Link>
        </div>
      )}

      {/* Comment Thread */}
      <GoalCommentThread goalId={goal.id} />
    </div>
  );
}

function MetricCard({ icon: Icon, label, value, badge, badgeClass, valueClass }: {
  icon: React.ElementType; label: string; value: string; badge?: boolean; badgeClass?: string; valueClass?: string;
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center gap-2 mb-1">
          <Icon className="w-4 h-4 text-slate-400" />
          <span className="text-xs text-slate-500 uppercase">{label}</span>
        </div>
        {badge ? (
          <Badge className={badgeClass} variant="outline">{value}</Badge>
        ) : (
          <p className={`font-semibold ${valueClass || ""}`}>{value}</p>
        )}
      </CardContent>
    </Card>
  );
}

function TimelineEvent({ icon: Icon, color, title, date, detail }: {
  icon: React.ElementType; color: string; title: string; date: string; detail?: string;
}) {
  const colorMap: Record<string, string> = {
    blue: "bg-blue-500", green: "bg-green-500", red: "bg-red-500",
    amber: "bg-amber-500", indigo: "bg-indigo-500", purple: "bg-purple-500",
  };
  return (
    <div className="flex gap-3 pb-4 last:pb-0">
      <div className="flex flex-col items-center">
        <div className={`w-3 h-3 rounded-full ${colorMap[color] || colorMap.blue} flex-shrink-0 mt-1`} />
        <div className="w-px flex-1 bg-slate-200 dark:bg-slate-800" />
      </div>
      <div className="pb-2">
        <p className="text-sm font-medium">{title}</p>
        <p className="text-xs text-slate-400">{formatDate(date)}</p>
        {detail && <p className="text-xs text-slate-500 mt-0.5">{detail}</p>}
      </div>
    </div>
  );
}
