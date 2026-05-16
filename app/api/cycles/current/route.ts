// app/api/cycles/current/route.ts
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const cycle = await prisma.cycle.findFirst({
    where: { isActive: true },
    include: { _count: { select: { goals: true, checkins: true } } },
  });

  if (!cycle) return NextResponse.json({ error: "No active cycle" }, { status: 404 });
  return NextResponse.json(cycle);
}
