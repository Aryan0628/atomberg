"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Calendar, CheckSquare, Square, Plus, Clock, User } from "lucide-react";
import { format } from "date-fns";

type AgendaItem = { id: string; title: string; done: boolean; goalId?: string };
type Meeting = {
  id: string; scheduledAt: string; completedAt: string | null; notes: string | null;
  manager: { id: string; name: string }; employee: { id: string; name: string };
  agendaItems: AgendaItem[];
};

export default function EmployeeMeetingsPage() {
  const qc = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [newItem, setNewItem] = useState("");
  const [notes, setNotes] = useState("");

  const { data: meetings = [], isLoading } = useQuery<Meeting[]>({
    queryKey: ["meetings"],
    queryFn: () => fetch("/api/meetings").then((r) => r.json()),
  });

  const selected = meetings.find((m) => m.id === selectedId);

  const toggleItem = useMutation({
    mutationFn: (itemId: string) => fetch(`/api/meetings/${selectedId}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ toggleAgendaItem: itemId }),
    }).then((r) => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["meetings"] }),
  });

  const addItem = useMutation({
    mutationFn: () => fetch(`/api/meetings/${selectedId}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ addAgendaItem: { title: newItem } }),
    }).then((r) => r.json()),
    onSuccess: () => { setNewItem(""); qc.invalidateQueries({ queryKey: ["meetings"] }); },
    onError: () => toast.error("Failed to add item"),
  });

  const saveNotes = useMutation({
    mutationFn: () => fetch(`/api/meetings/${selectedId}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notes }),
    }).then((r) => r.json()),
    onSuccess: () => toast.success("Notes saved"),
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">My 1:1 Meetings</h1>
        <p className="text-muted-foreground text-sm mt-1">Scheduled meetings with your manager</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="space-y-3">
          {isLoading ? (
            [1,2,3].map((i) => <div key={i} className="h-20 rounded-xl bg-muted animate-pulse" />)
          ) : meetings.length === 0 ? (
            <Card><CardContent className="py-12 text-center">
              <Calendar className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No meetings scheduled</p>
            </CardContent></Card>
          ) : meetings.map((m) => (
            <Card key={m.id} className={`cursor-pointer transition-all ${selectedId === m.id ? "ring-2 ring-primary" : "hover:shadow-md"}`}
              onClick={() => { setSelectedId(m.id); setNotes(m.notes ?? ""); }}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium">{format(new Date(m.scheduledAt), "MMM d, yyyy")}</span>
                  {m.completedAt ? <Badge variant="outline" className="text-xs text-green-600">Done</Badge>
                    : <Badge variant="outline" className="text-xs">Upcoming</Badge>}
                </div>
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Clock className="w-3 h-3" />{format(new Date(m.scheduledAt), "h:mm a")}
                  <span className="mx-1">·</span>
                  <User className="w-3 h-3" />{m.manager.name}
                </div>
                <p className="text-xs text-muted-foreground mt-1">{m.agendaItems.length} agenda items</p>
              </CardContent>
            </Card>
          ))}
        </div>

        <div className="lg:col-span-2">
          {selected ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">
                  {format(new Date(selected.scheduledAt), "EEEE, MMMM d 'at' h:mm a")}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-5">
                <div>
                  <p className="text-sm font-semibold mb-2">Agenda</p>
                  <div className="space-y-2">
                    {selected.agendaItems.map((item) => (
                      <div key={item.id} className="flex items-center gap-2 text-sm cursor-pointer"
                        onClick={() => toggleItem.mutate(item.id)}>
                        {item.done ? <CheckSquare className="w-4 h-4 text-green-500 flex-shrink-0" />
                          : <Square className="w-4 h-4 text-muted-foreground flex-shrink-0" />}
                        <span className={item.done ? "line-through text-muted-foreground" : ""}>{item.title}</span>
                      </div>
                    ))}
                  </div>
                  <div className="flex gap-2 mt-3">
                    <Input value={newItem} onChange={(e) => setNewItem(e.target.value)}
                      placeholder="Add agenda item…" className="text-sm"
                      onKeyDown={(e) => e.key === "Enter" && newItem && addItem.mutate()} />
                    <Button size="sm" onClick={() => addItem.mutate()} disabled={!newItem}><Plus className="w-4 h-4" /></Button>
                  </div>
                </div>
                <div>
                  <p className="text-sm font-semibold mb-2">Meeting Notes</p>
                  <Textarea value={notes} onChange={(e) => setNotes(e.target.value)}
                    placeholder="Capture key discussion points, decisions, and action items…" rows={5} />
                  <Button size="sm" className="mt-2" onClick={() => saveNotes.mutate()} disabled={saveNotes.isPending}>
                    Save Notes
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <Card><CardContent className="py-20 text-center">
              <Calendar className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
              <p className="text-muted-foreground">Select a meeting to view details</p>
            </CardContent></Card>
          )}
        </div>
      </div>
    </div>
  );
}
