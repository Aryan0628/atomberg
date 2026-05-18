// app/api/audit/export/route.ts
// Export audit trail as Excel for compliance/HR download.

import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { generateExcel } from "@/lib/export";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const session = await auth();
  if (!session || !["ADMIN", "HR"].includes(session.user.role)) {
    return NextResponse.json({ error: "Forbidden — Admin or HR only" }, { status: 403 });
  }

  const { searchParams } = new URL(req.url);
  const action = searchParams.get("action");

  const where: Record<string, unknown> = {};
  if (action && action !== "ALL") where.action = action;

  const logs = await prisma.auditLog.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: 5000,
    include: {
      user: { select: { name: true, email: true, role: true, department: true } },
      goal: { select: { title: true } },
    },
  });

  const rows = logs.map((log) => ({
    Timestamp: log.createdAt.toISOString(),
    User: log.user?.name ?? log.userId,
    Email: log.user?.email ?? "",
    Role: log.user?.role ?? "",
    Department: log.user?.department ?? "",
    Action: log.action.replace(/_/g, " "),
    EntityType: log.entityType,
    Goal: log.goal?.title ?? "",
    Details: log.newValue ? JSON.stringify(log.newValue) : log.oldValue ? JSON.stringify(log.oldValue) : "",
    IPAddress: log.ipAddress ?? "",
  }));

  const buffer = await generateExcel(rows, "Audit Trail");

  return new Response(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="AtomQuest_Audit_${new Date().toISOString().slice(0, 10)}.xlsx"`,
    },
  });
}
