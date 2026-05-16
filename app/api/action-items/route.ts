// app/api/action-items/route.ts
// GET — role-scoped proactive action items (server-side, zero polling delay)
// Returns: [{severity, message, link, category}]

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const activeCycle = await prisma.cycle.findFirst({ where: { isActive: true } });
  const items: { severity: "high" | "medium" | "low"; message: string; link: string; category: string }[] = [];

  if (!activeCycle) {
    if (["ADMIN", "HR"].includes(session.user.role)) {
      items.push({ severity: "high", message: "No active cycle. Create and activate a cycle to start.", link: "/dashboard/admin/cycles", category: "Cycle" });
    }
    return NextResponse.json(items);
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

    // Check open check-in windows
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
          const severity = daysLeft <= 3 ? "high" : "medium";
          items.push({ severity, message: `${q} check-in due for ${pending.length} goal(s). Window closes in ${daysLeft}d.`, link: `/dashboard/employee/goals`, category: "Check-in" });
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
      const oldest = pendingApprovals.sort((a, b) =>
        new Date(a.submittedAt!).getTime() - new Date(b.submittedAt!).getTime()
      )[0];
      const daysWaiting = Math.floor((now.getTime() - new Date(oldest.submittedAt!).getTime()) / (1000 * 60 * 60 * 24));
      const severity = daysWaiting >= 5 ? "high" : daysWaiting >= 2 ? "medium" : "low";
      items.push({ severity, message: `${pendingApprovals.length} goal(s) awaiting approval. Oldest: ${daysWaiting}d ago.`, link: "/dashboard/manager/approvals", category: "Approvals" });
    }

    const notSubmitted = await prisma.user.findMany({
      where: {
        managerId: session.user.id,
        isActive: true,
        ownedGoals: { none: { cycleId: activeCycle.id, status: { in: ["SUBMITTED", "APPROVED", "LOCKED"] } } },
      },
      select: { id: true, name: true },
    });
    if (goalWindowOpen && notSubmitted.length > 0) {
      items.push({ severity: "medium", message: `${notSubmitted.length} report(s) haven't submitted goals. Window closes in ${goalWindowDaysLeft}d.`, link: "/dashboard/manager/team", category: "Team" });
    }

    // Pending manager check-in reviews
    const pendingReviews = await prisma.checkin.count({
      where: {
        managerCheckedIn: false,
        submittedAt: { not: null },
        employee: { managerId: session.user.id },
        cycleId: activeCycle.id,
      },
    });
    if (pendingReviews > 0) {
      items.push({ severity: "medium", message: `${pendingReviews} check-in(s) from your team need your review.`, link: "/dashboard/manager/checkins", category: "Check-in" });
    }
  }

  // ─── ADMIN / HR ITEMS ─────────────────────────────────────
  if (["ADMIN", "HR"].includes(session.user.role)) {
    const totalEmployees = await prisma.user.count({ where: { role: "EMPLOYEE", isActive: true } });

    const noGoals = await prisma.user.count({
      where: {
        role: "EMPLOYEE",
        isActive: true,
        ownedGoals: { none: { cycleId: activeCycle.id } },
      },
    });
    if (noGoals > 0 && goalWindowOpen) {
      items.push({ severity: "high", message: `${noGoals}/${totalEmployees} employees have no goals. Goal window closes in ${goalWindowDaysLeft}d.`, link: "/dashboard/admin/users", category: "Goals" });
    }

    const pendingApprovals = await prisma.goal.count({
      where: { cycleId: activeCycle.id, status: "SUBMITTED" },
    });
    if (pendingApprovals > 0) {
      items.push({ severity: "medium", message: `${pendingApprovals} goal(s) awaiting manager approval across the org.`, link: "/dashboard/admin/audit", category: "Approvals" });
    }

    const lastEscalation = await prisma.escalationLog.findFirst({
      orderBy: { createdAt: "desc" },
    });
    if (lastEscalation) {
      const hoursAgo = Math.floor((now.getTime() - lastEscalation.createdAt.getTime()) / (1000 * 60 * 60));
      items.push({ severity: "low", message: `Last escalation run: ${hoursAgo}h ago.`, link: "/dashboard/admin/escalations", category: "Escalation" });
    } else {
      items.push({ severity: "low", message: "No escalations triggered yet this cycle.", link: "/dashboard/admin/escalations", category: "Escalation" });
    }
  }

  return NextResponse.json(items.sort((a, b) => {
    const order = { high: 0, medium: 1, low: 2 };
    return order[a.severity] - order[b.severity];
  }));
}
