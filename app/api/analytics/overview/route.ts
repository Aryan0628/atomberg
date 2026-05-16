// app/api/analytics/overview/route.ts
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const cycle = await prisma.cycle.findFirst({ where: { isActive: true } });
  if (!cycle) return NextResponse.json({ error: "No active cycle" }, { status: 404 });

  const [totalEmployees, totalGoals, goalsSubmitted, goalsApproved, goalsLocked, checkins] = await Promise.all([
    prisma.user.count({ where: { role: "EMPLOYEE", isActive: true } }),
    prisma.goal.count({ where: { cycleId: cycle.id } }),
    prisma.goal.count({ where: { cycleId: cycle.id, status: { in: ["SUBMITTED", "APPROVED", "LOCKED"] } } }),
    prisma.goal.count({ where: { cycleId: cycle.id, status: { in: ["APPROVED", "LOCKED"] } } }),
    prisma.goal.count({ where: { cycleId: cycle.id, status: "LOCKED" } }),
    prisma.checkin.count({ where: { cycleId: cycle.id } }),
  ]);

  const goalsWithScores = await prisma.goal.findMany({
    where: { cycleId: cycle.id, latestScore: { not: null } },
    select: { latestScore: true },
  });

  const avgScore = goalsWithScores.length > 0
    ? goalsWithScores.reduce((sum, g) => sum + (g.latestScore || 0), 0) / goalsWithScores.length
    : 0;

  const totalLockedGoals = await prisma.goal.count({ where: { cycleId: cycle.id, status: "LOCKED" } });
  const checkinCompletionRate = totalLockedGoals > 0 ? checkins / (totalLockedGoals * 4) : 0;

  return NextResponse.json({
    totalEmployees,
    totalGoals,
    goalsSubmitted,
    goalsApproved,
    goalsLocked,
    avgScore: Math.round(avgScore * 10) / 10,
    checkinCompletionRate: Math.round(checkinCompletionRate * 1000) / 10,
    cycleName: cycle.name,
  });
}
