"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Calendar, Plus, Clock, User, CheckSquare, Square, CheckCircle } from "lucide-react";
import { format } from "date-fns";

type AgendaItem = { id: string; title: string; done: boolean; goalId?: string };
type Meeting = {
  id: string; scheduledAt: string; completedAt: string | null; notes: string | null;
  manager: { id: string; name: string }; employee: { id: string; name: string };
  agendaItems: AgendaItem[];
};

export default function ManagerMeetingsPage() {
  const qc = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [notes, setNotes] = useState("");
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ employeeId: "", scheduledAt: "", agendaItems: [""] });

  const { data: meetings = [], isLoading } = useQuery<Meeting[]>({
    queryKey: ["manager-meetings"],
    queryFn: () => fetch("/api/meetings").then((r) => r.json()),
  });

  const { data: reports = [] } = useQuery<{ id: string; name: string; department: string }[]>({
    queryKey: ["team-reports"],
    queryFn: () => fetch("/api/users?myReports=true").then((r) => r.json()),
  });

  const selected = meetings.find((m) => m.id === selectedId);

  const createMeeting = useMutation({
    mutationFn: () => fetch("/api/meetings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        employeeId: form.employeeId,
        scheduledAt: form.scheduledAt,
        agendaItems: form.agendaItems.filter(Boolean).map((title) => ({ title })),
      }),
    }).then((r) => r.json()),
    onSuccess: (data) => {
      if (data.error) { toast.error(data.error); return; }
      toast.success("Meeting scheduled");
      setOpen(false);
      setForm({ employeeId: "", scheduledAt: "", agendaItems: [""] });
      qc.invalidateQueries({ queryKey: ["manager-meetings"] });
    },
    onError: () => toast.error("Failed to schedule meeting"),
  });

  const toggleItem = useMutation({
    mutationFn: (itemId: string) => fetch(`/api/meetings/${selectedId}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ toggleAgendaItem: itemId }),
    }).then((r) => r.json()),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["manager-meetings"] }),
  });

  const saveNotes = useMutation({
    mutationFn: () => fetch(`/api/meetings/${selectedId}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ notes }),
    }).then((r) => r.json()),
    onSuccess: () => toast.success("Notes saved"),
  });

  const completeMeeting = useMutation({
    mutationFn: () => fetch(`/api/meetings/${selectedId}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ complete: true }),
    }).then((r) => r.json()),
    onSuccess: () => {
      toast.success("Meeting marked as complete");
      qc.invalidateQueries({ queryKey: ["manager-meetings"] });
    },
  });

  const upcoming = meetings.filter((m) => !m.completedAt);
  const completed = meetings.filter((m) => m.completedAt);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">1:1 Meetings</h1>
          <p className="text-muted-foreground text-sm mt-1">Schedule and manage your team 1:1s</p>
        </div>
        <Dialog open={open} onOpenChange={setOpen}>
          <Button onClick={() => setOpen(true)}><Plus className="w-4 h-4 mr-2" />Schedule Meeting</Button>
          <DialogContent className="max-w-md">
            <DialogHeader><DialogTitle>Schedule 1:1 Meeting</DialogTitle></DialogHeader>
            <div className="space-y-4 pt-2">
              <div className="space-y-1">
                <Label>Team Member</Label>
                <Select value={form.employeeId} onValueChange={(v) => v && setForm((f) => ({ ...f, employeeId: v }))}>
                  <SelectTrigger><SelectValue placeholder="Select employee…" /></SelectTrigger>
                  <SelectContent>
                    {reports.map((r) => (
                      <SelectItem key={r.id} value={r.id}>{r.name} — {r.department}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Date & Time</Label>
                <Input type="datetime-local" value={form.scheduledAt}
                  onChange={(e) => setForm((f) => ({ ...f, scheduledAt: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Agenda Items</Label>
                {form.agendaItems.map((item, i) => (
                  <Input key={i} value={item} placeholder={`Item ${i + 1}…`}
                    onChange={(e) => setForm((f) => ({
                      ...f,
                      agendaItems: f.agendaItems.map((x, j) => j === i ? e.target.value : x),
                    }))} />
                ))}
                <Button variant="outline" size="sm" onClick={() => setForm((f) => ({ ...f, agendaItems: [...f.agendaItems, ""] }))}>
                  <Plus className="w-3 h-3 mr-1" />Add Item
                </Button>
              </div>
              <Button className="w-full" disabled={!form.employeeId || !form.scheduledAt || createMeeting.isPending}
                onClick={() => createMeeting.mutate()}>
                {createMeeting.isPending ? "Scheduling…" : "Schedule Meeting"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="space-y-4">
          {isLoading ? (
            [1,2,3].map((i) => <div key={i} className="h-24 rounded-xl bg-muted animate-pulse" />)
          ) : meetings.length === 0 ? (
            <Card><CardContent className="py-12 text-center">
              <Calendar className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
              <p className="text-sm text-muted-foreground">No meetings yet</p>
            </CardContent></Card>
          ) : (
            <>
              {upcoming.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Upcoming ({upcoming.length})</p>
                  <div className="space-y-2">
                    {upcoming.map((m) => (
                      <Card key={m.id} className={`cursor-pointer transition-all ${selectedId === m.id ? "ring-2 ring-primary" : "hover:shadow-md"}`}
                        onClick={() => { setSelectedId(m.id); setNotes(m.notes ?? ""); }}>
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm font-medium">{format(new Date(m.scheduledAt), "MMM d, yyyy")}</span>
                            <Badge variant="outline" className="text-xs">Upcoming</Badge>
                          </div>
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Clock className="w-3 h-3" />{format(new Date(m.scheduledAt), "h:mm a")}
                            <span className="mx-1">·</span>
                            <User className="w-3 h-3" />{m.employee.name}
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">{m.agendaItems.length} items</p>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}
              {completed.length > 0 && (
                <div>
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">Completed ({completed.length})</p>
                  <div className="space-y-2">
                    {completed.map((m) => (
                      <Card key={m.id} className={`cursor-pointer transition-all opacity-70 ${selectedId === m.id ? "ring-2 ring-primary" : "hover:shadow-md"}`}
                        onClick={() => { setSelectedId(m.id); setNotes(m.notes ?? ""); }}>
                        <CardContent className="p-4">
                          <div className="flex items-center justify-between mb-1">
                            <span className="text-sm font-medium">{format(new Date(m.scheduledAt), "MMM d, yyyy")}</span>
                            <Badge variant="outline" className="text-xs text-green-600">Done</Badge>
                          </div>
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <User className="w-3 h-3" />{m.employee.name}
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        <div className="lg:col-span-2">
          {selected ? (
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg">
                      {format(new Date(selected.scheduledAt), "EEEE, MMMM d 'at' h:mm a")}
                    </CardTitle>
                    <p className="text-sm text-muted-foreground mt-0.5">with {selected.employee.name}</p>
                  </div>
                  {!selected.completedAt && (
                    <Button size="sm" variant="outline" onClick={() => completeMeeting.mutate()}
                      disabled={completeMeeting.isPending}>
                      <CheckCircle className="w-4 h-4 mr-1" />Mark Complete
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-5">
                <div>
                  <p className="text-sm font-semibold mb-2">Agenda</p>
                  <div className="space-y-2">
                    {selected.agendaItems.length === 0 ? (
                      <p className="text-sm text-muted-foreground">No agenda items</p>
                    ) : selected.agendaItems.map((item) => (
                      <div key={item.id} className="flex items-center gap-2 text-sm cursor-pointer"
                        onClick={() => toggleItem.mutate(item.id)}>
                        {item.done
                          ? <CheckSquare className="w-4 h-4 text-green-500 flex-shrink-0" />
                          : <Square className="w-4 h-4 text-muted-foreground flex-shrink-0" />}
                        <span className={item.done ? "line-through text-muted-foreground" : ""}>{item.title}</span>
                      </div>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground mt-2">
                    {selected.agendaItems.filter((i) => i.done).length}/{selected.agendaItems.length} completed
                  </p>
                </div>
                <div>
                  <p className="text-sm font-semibold mb-2">Meeting Notes</p>
                  <Textarea value={notes} onChange={(e) => setNotes(e.target.value)}
                    placeholder="Key discussion points, decisions, action items…" rows={6}
                    disabled={!!selected.completedAt} />
                  {!selected.completedAt && (
                    <Button size="sm" className="mt-2" onClick={() => saveNotes.mutate()} disabled={saveNotes.isPending}>
                      Save Notes
                    </Button>
                  )}
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
