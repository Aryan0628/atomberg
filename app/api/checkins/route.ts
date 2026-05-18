// app/api/checkins/route.ts
// GET — manager/admin view of submitted check-ins across the team.
// The goals list route omits checkins for performance; this dedicated route
// returns exactly what the Check-in Hub needs in a single efficient query.
//
// ?reviewed=true   → only manager-reviewed check-ins
// ?reviewed=false  → only pending-review check-ins
// ?quarter=Q1      → filter by quarter

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { getActiveCycle } from "@/lib/cycle";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const session = await auth();
  if (!session || !["MANAGER", "ADMIN", "HR"].includes(session.user.role as string)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const reviewedParam = searchParams.get("reviewed");
  const quarterParam = searchParams.get("quarter");

  const activeCycle = await getActiveCycle();
  if (!activeCycle) return NextResponse.json([]);

  // Build the employee scope filter
  // MANAGER → only their direct reports; ADMIN/HR → all employees
  const employeeWhere =
    session.user.role === "MANAGER"
      ? { managerId: session.user.id, isActive: true }
      : { role: "EMPLOYEE" as const, isActive: true };

  const where: Record<string, unknown> = {
    cycleId: activeCycle.id,
    submittedAt: { not: null }, // only submitted check-ins, not empty stubs
    employee: employeeWhere,
  };

  if (reviewedParam === "true") where.managerCheckedIn = true;
  if (reviewedParam === "false") where.managerCheckedIn = false;
  if (quarterParam && ["Q1", "Q2", "Q3", "Q4"].includes(quarterParam)) {
    where.quarter = quarterParam;
  }

  const checkins = await prisma.checkin.findMany({
    where,
    include: {
      goal: {
        select: {
          id: true,
          title: true,
          uomType: true,
          uomUnit: true,
          target: true,
          thrustArea: true,
        },
      },
      employee: {
        select: {
          id: true,
          name: true,
          department: true,
          avatarUrl: true,
        },
      },
    },
    orderBy: [
      { managerCheckedIn: "asc" }, // unreviewed first
      { submittedAt: "desc" },
    ],
  });

  return NextResponse.json(checkins);
}
