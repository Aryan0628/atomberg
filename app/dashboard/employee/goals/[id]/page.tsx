// Goal detail page with timeline, comments, and check-in
"use client";

import { useGoal } from "@/hooks/useGoals";
import { useParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { getGoalStatusColor, getUoMLabel, getUoMColor, formatDate, formatScore } from "@/lib/utils";
import { getScoreColor } from "@/lib/scoring";
import { Target, Weight, BarChart3, CheckCircle2, XCircle, RotateCcw, Lock, FileText, ClipboardCheck } from "lucide-react";
import { GoalCommentThread } from "@/components/shared/GoalCommentThread";
import Link from "next/link";

export default function GoalDetailPage() {
  const params = useParams();
  const { data: goal, isLoading } = useGoal(params.id as string);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-64 rounded-lg" />
        <Skeleton className="h-40 rounded-xl" />
        <Skeleton className="h-60 rounded-xl" />
      </div>
    );
  }

  if (!goal) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-muted-foreground">Goal not found</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">{goal.title}</h1>
          {goal.description && (
            <p className="text-muted-foreground mt-1">{goal.description}</p>
          )}
        </div>
        <Badge className={`${getGoalStatusColor(goal.status)} font-normal text-sm px-3 py-1`} variant="secondary">
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
      <Card className="border-border shadow-sm">
        <CardHeader className="pb-3"><CardTitle className="text-base font-semibold">Target Details</CardTitle></CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4 text-sm">
            {goal.target !== null && (
              <div>
                <span className="text-muted-foreground">Target Value:</span>
                <span className="ml-2 font-medium">{goal.target} {goal.uomUnit || ""}</span>
              </div>
            )}
            {goal.targetDate && (
              <div>
                <span className="text-muted-foreground">Target Date:</span>
                <span className="ml-2 font-medium">{formatDate(goal.targetDate)}</span>
              </div>
            )}
            <div>
              <span className="text-muted-foreground">Owner:</span>
              <span className="ml-2 font-medium">{goal.owner?.name}</span>
            </div>
            {goal.approver && (
              <div>
                <span className="text-muted-foreground">Approved by:</span>
                <span className="ml-2 font-medium">{goal.approver.name}</span>
              </div>
            )}
            {goal.rejectReason && (
              <div className="col-span-2">
                <span className="text-destructive font-medium">Reject Reason:</span>
                <span className="ml-2 text-destructive/80">{goal.rejectReason}</span>
              </div>
            )}
            {goal.returnReason && (
              <div className="col-span-2">
                <span className="text-amber-600 dark:text-amber-500 font-medium">Return Reason:</span>
                <span className="ml-2 text-amber-600/80 dark:text-amber-500/80">{goal.returnReason}</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Check-ins */}
      {goal.checkins && goal.checkins.length > 0 && (
        <Card className="border-border shadow-sm">
          <CardHeader className="pb-3"><CardTitle className="text-base font-semibold">Check-ins</CardTitle></CardHeader>
          <CardContent>
            <div className="space-y-4">
              {goal.checkins.map((checkin: Record<string, unknown>) => (
                <div key={checkin.id as string} className="p-4 rounded-xl border border-border bg-card">
                  <div className="flex items-center justify-between mb-3">
                    <Badge variant="secondary" className="font-medium text-xs">{checkin.quarter as string}</Badge>
                    <span className={`font-semibold ${getScoreColor(checkin.scorePercentage as number)}`}>
                      {formatScore(checkin.scorePercentage as number)}
                    </span>
                  </div>
                  {checkin.actualValue !== null && (
                    <p className="text-sm">Actual: <span className="font-semibold">{checkin.actualValue as number}</span> {goal.uomUnit || ""}</p>
                  )}
                  {!!checkin.employeeNote && (
                    <p className="text-sm text-muted-foreground mt-2">{String(checkin.employeeNote)}</p>
                  )}
                  {!!checkin.selfRating && (
                    <p className="text-sm mt-2 text-muted-foreground">Self Rating: {"⭐".repeat(checkin.selfRating as number)}</p>
                  )}
                  {!!checkin.whatWentWell && (
                    <p className="text-sm text-emerald-600 dark:text-emerald-400 mt-2">✓ {String(checkin.whatWentWell)}</p>
                  )}
                  {!!checkin.blockers && (
                    <p className="text-sm text-destructive mt-1">⚠ {String(checkin.blockers)}</p>
                  )}
                  {!!checkin.managerCheckedIn && (
                    <div className="mt-4 pt-3 border-t border-border">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-1">Manager Review</p>
                      <p className="text-sm text-foreground">{String(checkin.managerComment ?? "")}</p>
                      {!!checkin.managerRating && (
                        <p className="text-sm text-muted-foreground mt-1">Rating: {"⭐".repeat(checkin.managerRating as number)}</p>
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
      <Card className="border-border shadow-sm">
        <CardHeader className="pb-3"><CardTitle className="text-base font-semibold">Timeline</CardTitle></CardHeader>
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
            <button className="w-full flex items-center justify-center gap-2 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg py-3 px-4 text-sm font-medium transition-colors shadow-sm">
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
    <Card className="border-border shadow-sm">
      <CardContent className="p-5">
        <div className="flex items-center gap-2 mb-2">
          <Icon className="w-4 h-4 text-muted-foreground" />
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">{label}</span>
        </div>
        {badge ? (
          <Badge className={`font-medium ${badgeClass}`} variant="outline">{value}</Badge>
        ) : (
          <p className={`text-xl font-semibold tracking-tight ${valueClass || "text-foreground"}`}>{value}</p>
        )}
      </CardContent>
    </Card>
  );
}

function TimelineEvent({ icon: Icon, color, title, date, detail }: {
  icon: React.ElementType; color: string; title: string; date: string; detail?: string;
}) {
  const colorMap: Record<string, string> = {
    blue: "bg-primary", green: "bg-emerald-500", red: "bg-destructive",
    amber: "bg-amber-500", indigo: "bg-indigo-500", purple: "bg-purple-500",
  };
  return (
    <div className="flex gap-4 pb-6 last:pb-0 group">
      <div className="flex flex-col items-center">
        <div className={`w-3.5 h-3.5 rounded-full ${colorMap[color] || colorMap.blue} flex-shrink-0 mt-1 shadow-sm ring-4 ring-background group-hover:scale-110 transition-transform`} />
        <div className="w-px flex-1 bg-border my-1 group-last:hidden" />
      </div>
      <div className="pb-2 flex-1">
        <p className="text-sm font-semibold text-foreground">{title}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{formatDate(date)}</p>
        {detail && <p className="text-sm text-muted-foreground mt-2 bg-muted/50 p-3 rounded-lg border border-border inline-block">{detail}</p>}
      </div>
    </div>
  );
}
