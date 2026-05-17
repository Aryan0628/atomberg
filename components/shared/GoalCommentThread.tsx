// GoalCommentThread — inline comment thread for goal detail pages
"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useSession } from "next-auth/react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { MessageSquare, Lock, Send } from "lucide-react";
import { formatRelativeTime, getInitials } from "@/lib/utils";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { toast } from "sonner";

interface Comment {
  id: string;
  content: string;
  isInternal: boolean;
  createdAt: string;
  author: { id: string; name: string; role: string };
}

export function GoalCommentThread({ goalId }: { goalId: string }) {
  const { data: session } = useSession();
  const [content, setContent] = useState("");
  const [isInternal, setIsInternal] = useState(false);
  const queryClient = useQueryClient();

  const { data: comments = [], isLoading } = useQuery({
    queryKey: ["goal-comments", goalId],
    queryFn: async () => {
      const res = await fetch(`/api/goals/${goalId}/comments`);
      if (!res.ok) return [];
      return res.json() as Promise<Comment[]>;
    },
    staleTime: 30_000,
  });

  const addComment = useMutation({
    mutationFn: async (data: { content: string; isInternal: boolean }) => {
      const res = await fetch(`/api/goals/${goalId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) { const err = await res.json(); throw new Error(err.error || "Failed"); }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["goal-comments", goalId] });
      queryClient.invalidateQueries({ queryKey: ["goal", goalId] });
      setContent("");
      toast.success("Comment added");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const isManager = session?.user?.role && ["MANAGER", "ADMIN", "HR"].includes(session.user.role);

  return (
    <Card className="border-border shadow-sm">
      <CardHeader className="pb-3 border-b border-border">
        <CardTitle className="text-base font-semibold flex items-center gap-2">
          <MessageSquare className="w-4 h-4" /> Discussion
          {comments.length > 0 && <Badge variant="secondary" className="font-normal">{comments.length}</Badge>}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6 pt-6">
        {/* Thread */}
        {!isLoading && comments.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-8 bg-muted/30 rounded-xl border border-dashed border-border">
            No comments yet. Start the discussion below.
          </p>
        )}

        <div className="space-y-4">
          {comments.map((c) => {
            const isSelf = c.author.id === session?.user?.id;
            return (
              <div key={c.id} className={`flex gap-3 ${isSelf ? "flex-row-reverse" : ""}`}>
                <Avatar className="w-8 h-8 flex-shrink-0">
                  <AvatarFallback className="text-xs font-semibold bg-primary/10 text-primary">
                    {getInitials(c.author.name)}
                  </AvatarFallback>
                </Avatar>
                <div className={`flex-1 max-w-[85%] ${isSelf ? "items-end" : "items-start"} flex flex-col gap-1.5`}>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-semibold text-foreground">{c.author.name}</span>
                    <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{c.author.role}</span>
                    {c.isInternal && (
                      <Badge variant="outline" className="text-[10px] h-5 px-1.5 gap-1 border-amber-500/30 text-amber-600 dark:text-amber-400">
                        <Lock className="w-2.5 h-2.5" /> Internal
                      </Badge>
                    )}
                    <span className="text-[10px] text-muted-foreground opacity-70">{formatRelativeTime(c.createdAt)}</span>
                  </div>
                  <div className={`rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                    isSelf
                      ? "bg-primary text-primary-foreground rounded-tr-sm"
                      : c.isInternal
                      ? "bg-amber-500/10 border border-amber-500/20 text-foreground rounded-tl-sm"
                      : "bg-muted/50 border border-border text-foreground rounded-tl-sm"
                  }`}>
                    {c.content}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Compose */}
        <div className="space-y-3 pt-4 border-t border-border">
          <Textarea
            placeholder="Write a comment..."
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={3}
            className="resize-none bg-muted/30 focus:bg-card transition-colors"
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.ctrlKey || e.metaKey) && content.trim()) {
                addComment.mutate({ content, isInternal });
              }
            }}
          />
          <div className="flex items-center justify-between">
            {isManager ? (
              <div className="flex items-center gap-2">
                <Switch id="internal" checked={isInternal} onCheckedChange={setIsInternal} />
                <Label htmlFor="internal" className="text-xs text-muted-foreground flex items-center gap-1 cursor-pointer">
                  <Lock className="w-3 h-3" /> Internal note (hidden from employee)
                </Label>
              </div>
            ) : (
              <span className="text-xs text-muted-foreground opacity-70">Ctrl+Enter to send</span>
            )}
            <Button
              size="sm"
              className="gap-2 shadow-sm"
              disabled={!content.trim() || addComment.isPending}
              onClick={() => addComment.mutate({ content, isInternal })}
            >
              <Send className="w-3.5 h-3.5" />
              {addComment.isPending ? "Sending..." : "Send"}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
