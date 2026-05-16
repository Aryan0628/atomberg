// app/api/escalations/route.ts
// GET — escalation logs (admin: all, manager: team's, employee: own)

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(req.url);
  const limit = parseInt(searchParams.get("limit") || "50");

  let logs;

  if (["ADMIN", "HR"].includes(session.user.role)) {
    logs = await prisma.escalationLog.findMany({
      include: { user: { select: { id: true, name: true, email: true, department: true } } },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
  } else if (session.user.role === "MANAGER") {
    const reports = await prisma.user.findMany({
      where: { managerId: session.user.id },
      select: { id: true },
    });
    const reportIds = [session.user.id, ...reports.map((r) => r.id)];
    logs = await prisma.escalationLog.findMany({
      where: { userId: { in: reportIds } },
      include: { user: { select: { id: true, name: true, email: true, department: true } } },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
  } else {
    logs = await prisma.escalationLog.findMany({
      where: { userId: session.user.id },
      include: { user: { select: { id: true, name: true, email: true } } },
      orderBy: { createdAt: "desc" },
      take: limit,
    });
  }

  return NextResponse.json(logs);
}
