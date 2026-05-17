// Manager Check-in Review Hub
"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatScore } from "@/lib/utils";
import { getScoreColor } from "@/lib/scoring";
import { ClipboardCheck, Star, CheckCircle, Clock } from "lucide-react";
import { toast } from "sonner";
import { formatDate } from "@/lib/utils";

interface Checkin {
  id: string;
  quarter: string;
  scorePercentage: number | null;
  progressStatus: string;
  actualValue: number | null;
  employeeNote: string | null;
  selfRating: number | null;
  whatWentWell: string | null;
  blockers: string | null;
  managerCheckedIn: boolean;
  managerComment: string | null;
  managerRating: number | null;
  submittedAt: string | null;
  goal: { id: string; title: string; uomType: string; uomUnit: string | null; target: number | null };
  employee: { id: string; name: string; department: string | null };
}

function useTeamCheckins() {
  return useQuery({
    queryKey: ["manager-checkins"],
    queryFn: async () => {
      // Fetch all team goals then get their checkins
      const res = await fetch("/api/goals?scope=team");
      if (!res.ok) throw new Error("Failed");
      const goals = await res.json();

      // Flatten to checkins with goal + employee context
      const checkins: Checkin[] = [];
      for (const goal of goals) {
        if (!goal.checkins) continue;
        for (const c of goal.checkins) {
          if (c.submittedAt) {
            checkins.push({
              ...c,
              goal: { id: goal.id, title: goal.title, uomType: goal.uomType, uomUnit: goal.uomUnit, target: goal.target },
              employee: goal.owner,
            });
          }
        }
      }
      return checkins.sort((a, b) => {
        // Unreviewed first
        if (!a.managerCheckedIn && b.managerCheckedIn) return -1;
        if (a.managerCheckedIn && !b.managerCheckedIn) return 1;
        return new Date(b.submittedAt!).getTime() - new Date(a.submittedAt!).getTime();
      });
    },
    staleTime: 30_000,
  });
}

export default function ManagerCheckinsPage() {
  const { data: checkins, isLoading } = useTeamCheckins();
  const [selected, setSelected] = useState<Checkin | null>(null);
  const [comment, setComment] = useState("");
  const [rating, setRating] = useState(0);
  const queryClient = useQueryClient();

  const reviewMutation = useMutation({
    mutationFn: async ({ goalId, quarter, managerComment, managerRating }: { goalId: string; quarter: string; managerComment: string; managerRating: number }) => {
      const res = await fetch(`/api/goals/${goalId}/manager-checkin`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ quarter, managerComment, managerRating }),
      });
      if (!res.ok) { const err = await res.json(); throw new Error(err.error || "Failed"); }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["manager-checkins"] });
      queryClient.invalidateQueries({ queryKey: ["goals"] });
      toast.success("Check-in reviewed successfully");
      setSelected(null);
      setComment("");
      setRating(0);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  function openReview(c: Checkin) {
    setSelected(c);
    setComment(c.managerComment || "");
    setRating(c.managerRating || 0);
  }

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48" />
        {[1, 2, 3].map((i) => <Skeleton key={i} className="h-32" />)}
      </div>
    );
  }

  const pending = checkins?.filter((c) => !c.managerCheckedIn) || [];
  const reviewed = checkins?.filter((c) => c.managerCheckedIn) || [];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Check-in Hub</h1>
        <div className="flex gap-2">
          {pending.length > 0 && (
            <Badge className="bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
              {pending.length} pending review
            </Badge>
          )}
          <Badge variant="outline">{reviewed.length} reviewed</Badge>
        </div>
      </div>

      {checkins?.length === 0 && (
        <Card className="border-border shadow-sm">
          <CardContent className="flex flex-col items-center py-16">
            <ClipboardCheck className="w-12 h-12 text-muted-foreground opacity-50 mb-4" />
            <p className="text-lg font-semibold text-foreground">No check-ins submitted yet</p>
            <p className="text-sm text-muted-foreground">Team check-ins will appear here during quarterly review periods</p>
          </CardContent>
        </Card>
      )}

      {/* Pending Reviews */}
      {pending.length > 0 && (
        <div className="space-y-4">
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Awaiting Your Review</h2>
          {pending.map((c) => (
            <CheckinCard key={`${c.id}`} checkin={c} onReview={openReview} />
          ))}
        </div>
      )}

      {/* Reviewed */}
      {reviewed.length > 0 && (
        <div className="space-y-3">
          <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wide">Reviewed</h2>
          {reviewed.map((c) => (
            <CheckinCard key={`${c.id}`} checkin={c} onReview={openReview} />
          ))}
        </div>
      )}

      {/* Review Dialog */}
      <Dialog open={!!selected} onOpenChange={(open) => { if (!open) setSelected(null); }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Review Check-in</DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-4">
              <div className="rounded-lg bg-slate-50 dark:bg-slate-900 p-4 space-y-2 text-sm">
                <p className="font-semibold">{selected.goal.title}</p>
                <p className="text-slate-500">{selected.employee.name} — {selected.quarter}</p>
                {selected.scorePercentage !== null && (
                  <p className={`font-bold ${getScoreColor(selected.scorePercentage)}`}>
                    Score: {selected.scorePercentage.toFixed(1)}%
                  </p>
                )}
                {selected.actualValue !== null && (
                  <p>Actual: <strong>{selected.actualValue} {selected.goal.uomUnit || ""}</strong> / Target: {selected.goal.target}</p>
                )}
                {selected.employeeNote && <p className="text-slate-600">{selected.employeeNote}</p>}
                {selected.whatWentWell && <p className="text-green-600">✓ {selected.whatWentWell}</p>}
                {selected.blockers && <p className="text-red-500">⚠ {selected.blockers}</p>}
                {selected.selfRating && <p>Self-rating: {"⭐".repeat(selected.selfRating)}</p>}
              </div>

              <div className="space-y-2">
                <Label>Your Rating</Label>
                <div className="flex gap-2">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button
                      key={n}
                      type="button"
                      onClick={() => setRating(rating === n ? 0 : n)}
                      className={`text-2xl transition-all hover:scale-110 ${n <= rating ? "text-amber-400" : "text-slate-200 dark:text-slate-700"}`}
                    >
                      ★
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="managerComment">Your Comment</Label>
                <Textarea
                  id="managerComment"
                  placeholder="Add your assessment and feedback..."
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  rows={3}
                  minLength={5}
                />
              </div>

              <div className="flex gap-2">
                <Button
                  className="flex-1"
                  disabled={!comment || comment.length < 5 || rating === 0 || reviewMutation.isPending}
                  onClick={() => reviewMutation.mutate({ goalId: selected.goal.id, quarter: selected.quarter, managerComment: comment, managerRating: rating })}
                >
                  {reviewMutation.isPending ? "Saving..." : selected.managerCheckedIn ? "Update Review" : "Submit Review"}
                </Button>
                <Button variant="outline" onClick={() => setSelected(null)}>Cancel</Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function CheckinCard({ checkin, onReview }: { checkin: Checkin; onReview: (c: Checkin) => void }) {
  return (
    <Card className="hover:border-primary/50 transition-colors shadow-sm">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1.5 flex-1">
            <div className="flex items-center gap-3 flex-wrap">
              <Badge variant="secondary" className="font-medium text-xs">{checkin.quarter}</Badge>
              <span className="font-semibold text-sm text-foreground">{checkin.employee.name}</span>
              {checkin.employee.department && <span className="text-xs text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{checkin.employee.department}</span>}
            </div>
            <p className="text-sm text-muted-foreground truncate">{checkin.goal.title}</p>
            <div className="flex items-center gap-3 text-xs text-muted-foreground mt-2">
              {checkin.scorePercentage !== null && (
                <span className={`font-semibold ${getScoreColor(checkin.scorePercentage)}`}>
                  {checkin.scorePercentage.toFixed(1)}%
                </span>
              )}
              {checkin.actualValue !== null && (
                <span className="font-medium">Actual: {checkin.actualValue} {checkin.goal.uomUnit || ""}</span>
              )}
              <span className="opacity-50">·</span>
              {checkin.submittedAt && <span>Submitted {formatDate(checkin.submittedAt)}</span>}
            </div>
            {checkin.managerCheckedIn && checkin.managerComment && (
              <p className="text-xs text-muted-foreground mt-2 italic bg-muted/50 p-2 rounded border border-border">Your review: {checkin.managerComment.slice(0, 60)}{checkin.managerComment.length > 60 ? "..." : ""}</p>
            )}
          </div>
          <div className="flex items-center gap-3 flex-shrink-0">
            {checkin.managerCheckedIn ? (
              <CheckCircle className="w-4 h-4 text-emerald-500" />
            ) : (
              <Clock className="w-4 h-4 text-amber-500" />
            )}
            <Button size="sm" variant="outline" onClick={() => onReview(checkin)}>
              {checkin.managerCheckedIn ? "Edit Review" : "Review"}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
