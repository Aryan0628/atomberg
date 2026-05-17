// app/api/cycles/current/route.ts
// COST: Called by every page that shows CycleBanner or CountdownTimer — i.e.,
// every dashboard route, every authenticated render. Cycle data changes at most
// once per admin action. 30s TTL with stale-while-revalidate means users always
// get a response in <1ms from cache while the background refresh happens silently.

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { withCache } from "@/lib/cache";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const cycle = await withCache("cycle:current", 30, () =>
    prisma.cycle.findFirst({
      where: { isActive: true },
      include: { _count: { select: { goals: true, checkins: true } } },
    })
  );

  if (!cycle) return NextResponse.json({ error: "No active cycle" }, { status: 404 });
  return NextResponse.json(cycle, {
    headers: { "Cache-Control": "private, max-age=30, stale-while-revalidate=15" },
  });
}
