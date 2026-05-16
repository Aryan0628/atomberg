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
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <MessageSquare className="w-4 h-4" /> Discussion
          {comments.length > 0 && <Badge variant="outline">{comments.length}</Badge>}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Thread */}
        {!isLoading && comments.length === 0 && (
          <p className="text-sm text-slate-400 text-center py-4">
            No comments yet. Start the discussion below.
          </p>
        )}

        <div className="space-y-3">
          {comments.map((c) => {
            const isSelf = c.author.id === session?.user?.id;
            return (
              <div key={c.id} className={`flex gap-3 ${isSelf ? "flex-row-reverse" : ""}`}>
                <Avatar className="w-7 h-7 flex-shrink-0">
                  <AvatarFallback className="text-[10px] bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300">
                    {getInitials(c.author.name)}
                  </AvatarFallback>
                </Avatar>
                <div className={`flex-1 max-w-[75%] ${isSelf ? "items-end" : "items-start"} flex flex-col gap-1`}>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-xs font-medium text-slate-600 dark:text-slate-400">{c.author.name}</span>
                    <span className="text-[10px] text-slate-400">{c.author.role}</span>
                    {c.isInternal && (
                      <Badge variant="outline" className="text-[10px] h-4 px-1 gap-0.5">
                        <Lock className="w-2.5 h-2.5" /> Internal
                      </Badge>
                    )}
                    <span className="text-[10px] text-slate-300 dark:text-slate-600">{formatRelativeTime(c.createdAt)}</span>
                  </div>
                  <div className={`rounded-xl px-3 py-2 text-sm ${
                    isSelf
                      ? "bg-blue-600 text-white rounded-tr-none"
                      : c.isInternal
                      ? "bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-tl-none"
                      : "bg-slate-100 dark:bg-slate-800 rounded-tl-none"
                  }`}>
                    {c.content}
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Compose */}
        <div className="space-y-2 pt-2 border-t border-slate-100 dark:border-slate-800">
          <Textarea
            placeholder="Write a comment..."
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={2}
            className="resize-none"
            onKeyDown={(e) => {
              if (e.key === "Enter" && (e.ctrlKey || e.metaKey) && content.trim()) {
                addComment.mutate({ content, isInternal });
              }
            }}
          />
          <div className="flex items-center justify-between">
            {isManager && (
              <div className="flex items-center gap-2">
                <Switch id="internal" checked={isInternal} onCheckedChange={setIsInternal} />
                <Label htmlFor="internal" className="text-xs text-slate-500 flex items-center gap-1 cursor-pointer">
                  <Lock className="w-3 h-3" /> Internal note (hidden from employee)
                </Label>
              </div>
            )}
            {!isManager && <span className="text-xs text-slate-400">Ctrl+Enter to send</span>}
            <Button
              size="sm"
              className="gap-1.5"
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
