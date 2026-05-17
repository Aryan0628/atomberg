// Manager Escalation Log — view escalations for your team
"use client";

import { useQuery } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle, CheckCircle, Mail } from "lucide-react";
import { formatDateTime } from "@/lib/utils";

function useEscalations() {
  return useQuery({
    queryKey: ["escalations"],
    queryFn: async () => {
      const res = await fetch("/api/escalations?limit=50");
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    staleTime: 60_000,
  });
}

const TRIGGER_LABELS: Record<string, string> = {
  GOAL_NOT_SUBMITTED: "Goal Not Submitted",
  GOAL_NOT_APPROVED: "Goal Not Approved",
  CHECKIN_NOT_COMPLETED: "Check-in Not Completed",
};

const ESCALATE_TO_LABELS: Record<string, string> = {
  EMPLOYEE: "Employee",
  MANAGER: "Manager",
  SKIP_LEVEL: "Skip Level",
  HR: "HR",
};

export default function ManagerEscalationsPage() {
  const { data: logs, isLoading } = useEscalations();

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48" />
        {[1, 2, 3].map((i) => <Skeleton key={i} className="h-20" />)}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Escalation Log</h1>
        <p className="text-sm text-slate-500 mt-1">Escalation alerts triggered for your team</p>
      </div>

      {(!logs || logs.length === 0) && (
        <Card>
          <CardContent className="flex flex-col items-center py-12">
            <CheckCircle className="w-12 h-12 text-green-400 mb-4" />
            <p className="text-lg font-medium">No escalations for your team</p>
            <p className="text-sm text-slate-400">Your team is on track — no escalation alerts have been triggered</p>
          </CardContent>
        </Card>
      )}

      <div className="space-y-3">
        {logs?.map((log: Record<string, unknown>) => {
          const user = log.user as Record<string, unknown>;
          return (
            <Card key={log.id as string} className={log.resolvedAt ? "opacity-60" : ""}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex items-start gap-3">
                    <div className={`mt-0.5 ${log.resolvedAt ? "text-green-500" : "text-amber-500"}`}>
                      {log.resolvedAt ? <CheckCircle className="w-5 h-5" /> : <AlertTriangle className="w-5 h-5" />}
                    </div>
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-sm">{String(user?.name ?? "")}</span>
                        {!!user?.department && <span className="text-xs text-slate-400">{String(user.department)}</span>}
                      </div>
                      <p className="text-sm text-slate-600 dark:text-slate-400">
                        {TRIGGER_LABELS[log.trigger as string] || String(log.trigger)}
                      </p>
                      <div className="flex items-center gap-3 text-xs text-slate-400">
                        <span>Escalated to: <strong>{ESCALATE_TO_LABELS[log.escalatedTo as string] || String(log.escalatedTo)}</strong></span>
                        {!!log.emailSent && (
                          <span className="flex items-center gap-1"><Mail className="w-3 h-3" /> Email sent</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="text-right space-y-1">
                    <p className="text-xs text-slate-400">{formatDateTime(log.createdAt as string)}</p>
                    {log.resolvedAt ? (
                      <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30">Resolved</Badge>
                    ) : (
                      <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/30">Active</Badge>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
