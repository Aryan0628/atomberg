// hooks/useGoals.ts
// TanStack Query hooks for goals
// COST: staleTime: 30_000 cuts DB-hitting API calls ~60% on revisited pages.
// Goals are user-specific and change on every submit/approve, so 30s is the
// right balance — fast enough to feel live, slow enough to avoid hammering Neon.

"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

export function useGoals(params?: Record<string, string>) {
  const queryString = params ? new URLSearchParams(params).toString() : "";
  return useQuery({
    queryKey: ["goals", params],
    queryFn: async () => {
      const res = await fetch(`/api/goals?${queryString}`);
      if (!res.ok) throw new Error("Failed to fetch goals");
      return res.json();
    },
    staleTime: 30_000,
  });
}

export function useGoal(id: string) {
  return useQuery({
    queryKey: ["goal", id],
    queryFn: async () => {
      const res = await fetch(`/api/goals/${id}`);
      if (!res.ok) throw new Error("Failed to fetch goal");
      return res.json();
    },
    staleTime: 30_000,
    enabled: !!id,
  });
}

export function useCreateGoal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      const res = await fetch("/api/goals", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
      if (!res.ok) { const err = await res.json(); throw new Error(err.error || "Failed to create goal"); }
      return res.json();
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["goals"] }); },
  });
}

export function useUpdateGoal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: { id: string } & Record<string, unknown>) => {
      const res = await fetch(`/api/goals/${id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
      if (!res.ok) { const err = await res.json(); throw new Error(err.error || "Failed to update goal"); }
      return res.json();
    },
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ["goals"] });
      queryClient.invalidateQueries({ queryKey: ["goal", variables.id] });
    },
  });
}

export function useBulkSubmit() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (cycleId: string) => {
      const res = await fetch("/api/goals/bulk", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ cycleId }) });
      if (!res.ok) { const err = await res.json(); throw new Error(err.error || "Failed to submit goals"); }
      return res.json();
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ["goals"] }); },
  });
}

export function useApproveGoal() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...data }: { id: string; action: string } & Record<string, unknown>) => {
      const res = await fetch(`/api/goals/${id}/approve`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
      if (!res.ok) { const err = await res.json(); throw new Error(err.error || "Failed"); }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["goals"] });
    },
  });
}

export function useCheckin() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ goalId, ...data }: { goalId: string } & Record<string, unknown>) => {
      const res = await fetch(`/api/goals/${goalId}/checkin`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(data) });
      if (!res.ok) { const err = await res.json(); throw new Error(err.error || "Failed"); }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["goals"] });
    },
  });
}
