// Admin Users — full CRUD: list, create, edit role/manager/dept, deactivate
"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Search, UserPlus, Shield, Pencil, UserX } from "lucide-react";
import { toast } from "sonner";
import { getInitials, formatRelativeTime } from "@/lib/utils";

const ROLES = ["EMPLOYEE", "MANAGER", "ADMIN", "HR"];
const DEPTS = ["Sales", "Operations", "Engineering", "HR", "Finance", "Marketing", "Product"];

function useUsers() {
  return useQuery({
    queryKey: ["users"],
    queryFn: async () => {
      const res = await fetch("/api/users");
      if (!res.ok) throw new Error("Failed");
      return res.json();
    },
    staleTime: 30_000,
  });
}

const EMPTY_FORM = { name: "", email: "", password: "", role: "EMPLOYEE", department: "", designation: "", managerId: "" };

export default function AdminUsersPage() {
  const { data: users, isLoading } = useUsers();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [editUser, setEditUser] = useState<Record<string, unknown> | null>(null);
  const [form, setForm] = useState(EMPTY_FORM);

  const createMutation = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const res = await fetch("/api/users", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error || "Failed"); }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      toast.success("User created and welcome email queued");
      setShowCreate(false);
      setForm(EMPTY_FORM);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Record<string, unknown> }) => {
      const res = await fetch(`/api/users/${id}`, {
        method: "PUT", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error || "Failed"); }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      toast.success("User updated");
      setEditUser(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deactivateMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/users/${id}`, { method: "DELETE" });
      if (!res.ok) { const e = await res.json(); throw new Error(e.error || "Failed"); }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["users"] });
      toast.success("User deactivated");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const filtered = (users || []).filter((u: Record<string, unknown>) => {
    if (!search) return true;
    const s = search.toLowerCase();
    return (u.name as string).toLowerCase().includes(s) ||
      (u.email as string).toLowerCase().includes(s) ||
      ((u.department as string) || "").toLowerCase().includes(s);
  });

  const roleCounts = (users || []).reduce((acc: Record<string, number>, u: Record<string, unknown>) => {
    acc[u.role as string] = (acc[u.role as string] || 0) + 1;
    return acc;
  }, {});

  function openEdit(u: Record<string, unknown>) {
    setEditUser(u);
    setForm({
      name: String(u.name ?? ""),
      email: String(u.email ?? ""),
      password: "",
      role: String(u.role ?? "EMPLOYEE"),
      department: String(u.department ?? ""),
      designation: String(u.designation ?? ""),
      managerId: String((u.manager as Record<string, unknown>)?.id ?? ""),
    });
  }

  function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    createMutation.mutate({ ...form, managerId: form.managerId || undefined });
  }

  function handleUpdate(e: React.FormEvent) {
    e.preventDefault();
    if (!editUser) return;
    updateMutation.mutate({
      id: editUser.id as string,
      data: {
        name: form.name, role: form.role,
        department: form.department || undefined,
        designation: form.designation || undefined,
        managerId: form.managerId || null,
      },
    });
  }

  const roleColors: Record<string, string> = {
    ADMIN: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
    HR: "bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300",
    MANAGER: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
    EMPLOYEE: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
  };

  const managerOptions = (users || []).filter((u: Record<string, unknown>) =>
    ["MANAGER", "ADMIN"].includes(u.role as string) && u.isActive
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">User Management</h1>
          <p className="text-sm text-slate-500 mt-1">{(users || []).length} users in the system</p>
        </div>
        <Button onClick={() => setShowCreate(true)} className="gap-2">
          <UserPlus className="w-4 h-4" /> Add User
        </Button>
      </div>

      {/* Role Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {Object.entries(roleCounts).map(([role, count]) => (
          <Card key={role}>
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950/50 flex items-center justify-center">
                <Shield className="w-4 h-4 text-blue-600" />
              </div>
              <div>
                <p className="text-lg font-bold">{Number(count)}</p>
                <p className="text-xs text-slate-500">{role}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <Input placeholder="Search by name, email, or department..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
      </div>

      {/* Users Table */}
      <Card>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200 dark:border-slate-800">
                  {["User", "Role", "Department", "Manager", "Goals", "Last Login", "Status", ""].map((h) => (
                    <th key={h} className="text-left p-4 text-xs font-medium text-slate-500 uppercase">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  [1, 2, 3, 4, 5].map((i) => (
                    <tr key={i}><td colSpan={8} className="p-4"><Skeleton className="h-10" /></td></tr>
                  ))
                ) : filtered.length === 0 ? (
                  <tr><td colSpan={8} className="p-8 text-center text-slate-400">No users found</td></tr>
                ) : (
                  filtered.map((user: Record<string, unknown>) => (
                    <tr key={user.id as string} className={`border-b border-slate-100 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900 transition-colors ${!user.isActive ? "opacity-50" : ""}`}>
                      <td className="p-4">
                        <div className="flex items-center gap-3">
                          <Avatar className="w-8 h-8">
                            <AvatarFallback className="bg-blue-100 text-blue-700 text-xs font-medium">{getInitials(user.name as string)}</AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium text-sm">{user.name as string}</p>
                            <p className="text-xs text-slate-400">{user.email as string}</p>
                          </div>
                        </div>
                      </td>
                      <td className="p-4">
                        <Badge className={roleColors[user.role as string] || ""} variant="outline">{user.role as string}</Badge>
                      </td>
                      <td className="p-4 text-sm text-slate-600">{(user.department as string) || "—"}</td>
                      <td className="p-4 text-sm text-slate-600">{((user.manager as Record<string, unknown>)?.name as string) || "—"}</td>
                      <td className="p-4 text-sm">{((user._count as Record<string, number>)?.ownedGoals) || 0}</td>
                      <td className="p-4 text-xs text-slate-400">
                        {user.lastLoginAt ? formatRelativeTime(user.lastLoginAt as string) : "Never"}
                      </td>
                      <td className="p-4">
                        <Badge className={!!user.isActive ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}>
                          {user.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </td>
                      <td className="p-4">
                        <div className="flex items-center gap-1">
                          <Button size="icon" variant="ghost" className="w-7 h-7" onClick={() => openEdit(user)}>
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                          {!!user.isActive && (
                            <Button size="icon" variant="ghost" className="w-7 h-7 text-red-400 hover:text-red-600"
                              onClick={() => {
                                if (!confirm(`Deactivate ${user.name}? They will lose portal access.`)) return;
                                deactivateMutation.mutate(user.id as string);
                              }}>
                              <UserX className="w-3.5 h-3.5" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Create User Dialog */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Add New User</DialogTitle></DialogHeader>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2 col-span-2">
                <Label>Full Name *</Label>
                <Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="Rahul Sharma" />
              </div>
              <div className="space-y-2 col-span-2">
                <Label>Email *</Label>
                <Input required type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="rahul@atomberg.com" />
              </div>
              <div className="space-y-2 col-span-2">
                <Label>Temporary Password *</Label>
                <Input required type="password" minLength={6} value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} placeholder="Min 6 characters" />
              </div>
              <div className="space-y-2">
                <Label>Role *</Label>
                <Select value={form.role} onValueChange={(v) => v && setForm({ ...form, role: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{ROLES.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Department</Label>
                <Select value={form.department} onValueChange={(v) => v && setForm({ ...form, department: v })}>
                  <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                  <SelectContent>{DEPTS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2 col-span-2">
                <Label>Manager</Label>
                <Select value={form.managerId} onValueChange={(v) => v && setForm({ ...form, managerId: v })}>
                  <SelectTrigger><SelectValue placeholder="No manager" /></SelectTrigger>
                  <SelectContent>
                    {managerOptions.map((m: Record<string, unknown>) => (
                      <SelectItem key={m.id as string} value={m.id as string}>{m.name as string}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex gap-2">
              <Button type="submit" className="flex-1" disabled={createMutation.isPending}>
                {createMutation.isPending ? "Creating..." : "Create User"}
              </Button>
              <Button type="button" variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Edit User Dialog */}
      <Dialog open={!!editUser} onOpenChange={(o) => !o && setEditUser(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>Edit User — {editUser?.name as string}</DialogTitle></DialogHeader>
          <form onSubmit={handleUpdate} className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2 col-span-2">
                <Label>Full Name *</Label>
                <Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Role *</Label>
                <Select value={form.role} onValueChange={(v) => v && setForm({ ...form, role: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{ROLES.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Department</Label>
                <Select value={form.department} onValueChange={(v) => v && setForm({ ...form, department: v })}>
                  <SelectTrigger><SelectValue placeholder="Select..." /></SelectTrigger>
                  <SelectContent>{DEPTS.map((d) => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-2 col-span-2">
                <Label>Manager</Label>
                <Select value={form.managerId} onValueChange={(v) => v && setForm({ ...form, managerId: v })}>
                  <SelectTrigger><SelectValue placeholder="No manager" /></SelectTrigger>
                  <SelectContent>
                    {managerOptions
                      .filter((m: Record<string, unknown>) => m.id !== editUser?.id)
                      .map((m: Record<string, unknown>) => (
                        <SelectItem key={m.id as string} value={m.id as string}>{m.name as string}</SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex gap-2">
              <Button type="submit" className="flex-1" disabled={updateMutation.isPending}>
                {updateMutation.isPending ? "Saving..." : "Save Changes"}
              </Button>
              <Button type="button" variant="outline" onClick={() => setEditUser(null)}>Cancel</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
