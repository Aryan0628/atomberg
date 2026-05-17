// lib/cycle.ts
// Shared helper: fetch the active cycle from Redis cache before hitting the DB.
// Called by 15+ routes — without this, each route makes its own DB trip even
// though the active cycle changes at most once per admin action.
// TTL: 60s. On cycle activate/deactivate, call invalidateActiveCycle().

import { prisma } from "@/lib/db";
import { withCache, invalidateCache } from "@/lib/cache";

export async function getActiveCycle() {
  return withCache("cycle:current", 60, () =>
    prisma.cycle.findFirst({ where: { isActive: true } })
  );
}

export async function invalidateActiveCycle() {
  await invalidateCache("cycle:current");
}
