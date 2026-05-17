// app/api/action-items/route.ts
// GET — role-scoped proactive action items (server-side, zero polling delay)
// Returns: [{severity, message, link, category}]
// COST: Runs 4-7 Prisma queries per role, called on every dashboard mount.
// Cached 60s per user — keyed by userId so user A's items never leak to user B.
// Employee: 60s TTL (goal state changes are infrequent within a minute).
// Manager/Admin: 60s TTL (approval queue counts shift only on approval actions).

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { withCache } from "@/lib/cache";
import { NextResponse } from "next/server";
import type { Session } from "next-auth";

type ActionItem = { severity: "high" | "medium" | "low"; message: string; link: string; category: string };

async function computeActionItems(session: Session): Promise<ActionItem[]> {
  const activeCycle = await prisma.cycle.findFirst({ where: { isActive: true } });
  const items: ActionItem[] = [];

  if (!activeCycle) {
    if (["ADMIN", "HR"].includes(session.user.role as string)) {
      items.push({ severity: "high", message: "No active cycle. Create and activate a cycle to start.", link: "/dashboard/admin/cycles", category: "Cycle" });
    }
    return items;
  }

  const now = new Date();
  const goalWindowOpen = now >= activeCycle.goalSettingOpen && now <= activeCycle.goalSettingClose;
  const goalWindowDaysLeft = Math.ceil((activeCycle.goalSettingClose.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

  // ─── EMPLOYEE ITEMS ───────────────────────────────────────
  if (session.user.role === "EMPLOYEE") {
    const myGoals = await prisma.goal.findMany({
      where: { ownerId: session.user.id, cycleId: activeCycle.id },
      include: { checkins: { where: { cycleId: activeCycle.id } } },
    });

    const draftGoals = myGoals.filter((g) => g.status === "DRAFT");
    const returnedGoals = myGoals.filter((g) => g.status === "RETURNED");
    const totalWeightage = myGoals.reduce((s, g) => s + g.weightage, 0);
    const lockedGoals = myGoals.filter((g) => g.isLocked);

    if (goalWindowOpen && draftGoals.length > 0) {
      const severity = goalWindowDaysLeft <= 2 ? "high" : goalWindowDaysLeft <= 7 ? "medium" : "low";
      items.push({ severity, message: `${draftGoals.length} goal(s) not yet submitted. Goal window closes in ${goalWindowDaysLeft}d.`, link: "/dashboard/employee/goals", category: "Goals" });
    }

    if (goalWindowOpen && Math.abs(totalWeightage - 100) > 0.01 && myGoals.length > 0) {
      items.push({ severity: "high", message: `Weightage totals ${totalWeightage.toFixed(1)}%. Must be exactly 100% before submitting.`, link: "/dashboard/employee/goals", category: "Weightage" });
    }

    if (returnedGoals.length > 0) {
      items.push({ severity: "high", message: `${returnedGoals.length} goal(s) returned for rework. Click to review reasons.`, link: "/dashboard/employee/goals", category: "Goals" });
    }

    const quarters = ["Q1", "Q2", "Q3", "Q4"] as const;
    const windowFields: Record<string, [Date, Date]> = {
      Q1: [activeCycle.q1Open, activeCycle.q1Close],
      Q2: [activeCycle.q2Open, activeCycle.q2Close],
      Q3: [activeCycle.q3Open, activeCycle.q3Close],
      Q4: [activeCycle.q4Open, activeCycle.q4Close],
    };

    for (const q of quarters) {
      const [open, close] = windowFields[q];
      if (now >= open && now <= close) {
        const daysLeft = Math.ceil((close.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        const pending = lockedGoals.filter((g) => !g.checkins.some((c) => c.quarter === q));
        if (pending.length > 0) {
          items.push({ severity: daysLeft <= 3 ? "high" : "medium", message: `${q} check-in due for ${pending.length} goal(s). Window closes in ${daysLeft}d.`, link: "/dashboard/employee/goals", category: "Check-in" });
        }
      }
    }
  }

  // ─── MANAGER ITEMS ────────────────────────────────────────
  if (session.user.role === "MANAGER") {
    const reports = await prisma.user.findMany({
      where: { managerId: session.user.id, isActive: true },
      include: {
        ownedGoals: {
          where: { cycleId: activeCycle.id, status: "SUBMITTED" },
          select: { id: true, submittedAt: true, owner: { select: { name: true } } },
        },
      },
    });

    const pendingApprovals = reports.flatMap((r) => r.ownedGoals);
    if (pendingApprovals.length > 0) {
      const oldest = [...pendingApprovals].sort((a, b) => new Date(a.submittedAt!).getTime() - new Date(b.submittedAt!).getTime())[0];
      const daysWaiting = Math.floor((now.getTime() - new Date(oldest.submittedAt!).getTime()) / (1000 * 60 * 60 * 24));
      items.push({ severity: daysWaiting >= 5 ? "high" : daysWaiting >= 2 ? "medium" : "low", message: `${pendingApprovals.length} goal(s) awaiting approval. Oldest: ${daysWaiting}d ago.`, link: "/dashboard/manager/approvals", category: "Approvals" });
    }

    const notSubmitted = await prisma.user.findMany({
      where: { managerId: session.user.id, isActive: true, ownedGoals: { none: { cycleId: activeCycle.id, status: { in: ["SUBMITTED", "APPROVED", "LOCKED"] } } } },
      select: { id: true },
    });
    if (goalWindowOpen && notSubmitted.length > 0) {
      items.push({ severity: "medium", message: `${notSubmitted.length} report(s) haven't submitted goals. Window closes in ${goalWindowDaysLeft}d.`, link: "/dashboard/manager/team", category: "Team" });
    }

    const pendingReviews = await prisma.checkin.count({
      where: { managerCheckedIn: false, submittedAt: { not: null }, employee: { managerId: session.user.id }, cycleId: activeCycle.id },
    });
    if (pendingReviews > 0) {
      items.push({ severity: "medium", message: `${pendingReviews} check-in(s) from your team need your review.`, link: "/dashboard/manager/checkins", category: "Check-in" });
    }
  }

  // ─── ADMIN / HR ITEMS ─────────────────────────────────────
  if (["ADMIN", "HR"].includes(session.user.role as string)) {
    const [totalEmployees, noGoals, pendingApprovals, lastEscalation] = await Promise.all([
      prisma.user.count({ where: { role: "EMPLOYEE", isActive: true } }),
      prisma.user.count({ where: { role: "EMPLOYEE", isActive: true, ownedGoals: { none: { cycleId: activeCycle.id } } } }),
      prisma.goal.count({ where: { cycleId: activeCycle.id, status: "SUBMITTED" } }),
      prisma.escalationLog.findFirst({ orderBy: { createdAt: "desc" } }),
    ]);

    if (noGoals > 0 && goalWindowOpen) {
      items.push({ severity: "high", message: `${noGoals}/${totalEmployees} employees have no goals. Goal window closes in ${goalWindowDaysLeft}d.`, link: "/dashboard/admin/users", category: "Goals" });
    }
    if (pendingApprovals > 0) {
      items.push({ severity: "medium", message: `${pendingApprovals} goal(s) awaiting manager approval across the org.`, link: "/dashboard/admin/audit", category: "Approvals" });
    }
    if (lastEscalation) {
      const hoursAgo = Math.floor((now.getTime() - lastEscalation.createdAt.getTime()) / (1000 * 60 * 60));
      items.push({ severity: "low", message: `Last escalation run: ${hoursAgo}h ago.`, link: "/dashboard/admin/escalations", category: "Escalation" });
    } else {
      items.push({ severity: "low", message: "No escalations triggered yet this cycle.", link: "/dashboard/admin/escalations", category: "Escalation" });
    }
  }

  return items;
}

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const result = await withCache(`action-items:${session.user.id}`, 60, () => computeActionItems(session));
  const sorted = result.sort((a, b) => ({ high: 0, medium: 1, low: 2 }[a.severity] - { high: 0, medium: 1, low: 2 }[b.severity]));

  return NextResponse.json(sorted, {
    headers: { "Cache-Control": "private, max-age=60, stale-while-revalidate=30" },
  });
}
