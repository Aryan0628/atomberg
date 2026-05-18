"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { MessageSquare, Send, User, Lock, Star } from "lucide-react";
import { formatDistanceToNow } from "date-fns";

const DEFAULT_QUESTIONS = [
  "What are this person's key strengths?",
  "What areas could they improve?",
  "How effectively do they collaborate with others?",
];

export default function FeedbackPage() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<"received" | "given">("received");
  const [open, setOpen] = useState(false);
  const [receiverId, setReceiverId] = useState("");
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [message, setMessage] = useState("");
  const [answers, setAnswers] = useState(DEFAULT_QUESTIONS.map((q) => ({ question: q, answer: "", rating: undefined as number | undefined })));

  const { data: feedbacks = [], isLoading } = useQuery({
    queryKey: ["feedback", tab],
    queryFn: () => fetch(`/api/feedback?direction=${tab}`).then((r) => r.json()),
  });

  const { data: users = [] } = useQuery({
    queryKey: ["users-list"],
    queryFn: () => fetch("/api/users?forFeedback=true").then((r) => r.json()),
  });

  const submit = useMutation({
    mutationFn: () => fetch("/api/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ receiverId, isAnonymous, message, answers, type: "PEER" }),
    }).then((r) => r.json()),
    onSuccess: () => {
      toast.success("Feedback submitted");
      setOpen(false);
      setReceiverId(""); setMessage(""); setIsAnonymous(false);
      setAnswers(DEFAULT_QUESTIONS.map((q) => ({ question: q, answer: "", rating: undefined })));
      qc.invalidateQueries({ queryKey: ["feedback"] });
    },
    onError: () => toast.error("Failed to submit feedback"),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Peer Feedback</h1>
          <p className="text-muted-foreground text-sm mt-1">Give and receive feedback from your peers</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <Button onClick={() => setOpen(true)}><Send className="w-4 h-4 mr-2" />Give Feedback</Button>
          <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
            <DialogHeader><DialogTitle>Give Peer Feedback</DialogTitle></DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="space-y-1">
                <Label>Recipient</Label>
                <Select value={receiverId} onValueChange={(v) => v && setReceiverId(v)}>
                  <SelectTrigger><SelectValue placeholder="Select colleague…" /></SelectTrigger>
                  <SelectContent>
                    {users.map((u: { id: string; name: string; department: string }) => (
                      <SelectItem key={u.id} value={u.id}>{u.name} — {u.department}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center justify-between">
                <Label className="text-sm">Submit anonymously</Label>
                <Switch checked={isAnonymous} onCheckedChange={setIsAnonymous} />
              </div>
              <div className="space-y-1">
                <Label>General message (optional)</Label>
                <Textarea value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Any overall thoughts…" rows={2} />
              </div>
              {answers.map((a, i) => (
                <div key={i} className="space-y-1">
                  <Label className="text-xs text-muted-foreground">{a.question}</Label>
                  <Textarea
                    value={a.answer}
                    onChange={(e) => setAnswers((prev) => prev.map((x, j) => j === i ? { ...x, answer: e.target.value } : x))}
                    rows={2}
                    placeholder="Your answer…"
                  />
                  <div className="flex gap-1 mt-1">
                    {[1,2,3,4,5].map((n) => (
                      <button key={n} onClick={() => setAnswers((prev) => prev.map((x, j) => j === i ? { ...x, rating: n } : x))}
                        className={`p-1 rounded transition-colors ${a.rating === n ? "text-amber-500" : "text-muted-foreground hover:text-amber-400"}`}>
                        <Star className={`w-4 h-4 ${a.rating && n <= a.rating ? "fill-current" : ""}`} />
                      </button>
                    ))}
                  </div>
                </div>
              ))}
              <Button className="w-full" disabled={!receiverId || submit.isPending} onClick={() => submit.mutate()}>
                {submit.isPending ? "Submitting…" : "Submit Feedback"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex gap-2">
        {(["received", "given"] as const).map((t) => (
          <Button key={t} variant={tab === t ? "default" : "outline"} size="sm" onClick={() => setTab(t)}>
            {t === "received" ? "Received" : "Given"}
          </Button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-3">{[1,2,3].map((i) => <div key={i} className="h-24 rounded-xl bg-muted animate-pulse" />)}</div>
      ) : feedbacks.length === 0 ? (
        <Card><CardContent className="py-16 text-center">
          <MessageSquare className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-muted-foreground">No feedback {tab} yet</p>
        </CardContent></Card>
      ) : (
        <div className="space-y-3">
          {feedbacks.map((f: { id: string; giver: { name: string } | null; isAnonymous: boolean; type: string; message: string; answers: { question: string; answer: string; rating?: number }[]; createdAt: string }) => (
            <Card key={f.id}>
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {f.isAnonymous ? (
                      <><Lock className="w-4 h-4 text-muted-foreground" /><span className="text-sm font-medium text-muted-foreground">Anonymous</span></>
                    ) : (
                      <><User className="w-4 h-4 text-muted-foreground" /><span className="text-sm font-medium">{f.giver?.name ?? "—"}</span></>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">{f.type}</Badge>
                    <span className="text-xs text-muted-foreground">{formatDistanceToNow(new Date(f.createdAt), { addSuffix: true })}</span>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                {f.message && <p className="text-sm text-muted-foreground italic">&ldquo;{f.message}&rdquo;</p>}
                {f.answers.map((a, i) => a.answer && (
                  <div key={i} className="text-sm">
                    <p className="text-xs font-medium text-muted-foreground mb-0.5">{a.question}</p>
                    <p>{a.answer}</p>
                    {a.rating && <div className="flex gap-0.5 mt-1">{[1,2,3,4,5].map((n) => <Star key={n} className={`w-3 h-3 ${n <= a.rating! ? "fill-amber-400 text-amber-400" : "text-muted"}`} />)}</div>}
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
