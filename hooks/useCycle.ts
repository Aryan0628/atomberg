// hooks/useCycle.ts
"use client";

import { useQuery } from "@tanstack/react-query";

export function useCurrentCycle() {
  return useQuery({
    queryKey: ["cycle", "current"],
    queryFn: async () => {
      const res = await fetch("/api/cycles/current");
      if (!res.ok) throw new Error("Failed to fetch cycle");
      return res.json();
    },
    staleTime: 60_000,
  });
}

export function useCycles() {
  return useQuery({
    queryKey: ["cycles"],
    queryFn: async () => {
      const res = await fetch("/api/cycles");
      if (!res.ok) throw new Error("Failed to fetch cycles");
      return res.json();
    },
    staleTime: 60_000,
  });
}
