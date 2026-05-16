// app/api/audit/verify/route.ts
// Verifies the SHA-256 hash chain across all audit log entries.
// If any row was manually edited in the DB, its hash will not match and the chain breaks.

import { createHash } from "crypto";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";

export async function GET() {
  const session = await auth();
  if (!session || !["ADMIN", "HR"].includes(session.user.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const logs = await prisma.auditLog.findMany({
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      userId: true,
      action: true,
      entityType: true,
      entityId: true,
      newValue: true,
      createdAt: true,
      hash: true,
      previousHash: true,
    },
  });

  if (logs.length === 0) {
    return NextResponse.json({ valid: true, totalEntries: 0 });
  }

  let runningPreviousHash = "GENESIS";

  for (const log of logs) {
    const payload = JSON.stringify({
      userId: log.userId,
      action: log.action,
      entityType: log.entityType,
      entityId: log.entityId,
      newValue: log.newValue ?? null,
      createdAt: log.createdAt.toISOString(),
    });
    const expectedHash = createHash("sha256")
      .update(payload + runningPreviousHash)
      .digest("hex");

    if (log.hash !== expectedHash) {
      return NextResponse.json({
        valid: false,
        totalEntries: logs.length,
        firstTamperedId: log.id,
        firstTamperedAction: log.action,
        detectedAt: new Date().toISOString(),
      });
    }

    runningPreviousHash = log.hash;
  }

  return NextResponse.json({
    valid: true,
    totalEntries: logs.length,
    latestHash: logs[logs.length - 1].hash,
    verifiedAt: new Date().toISOString(),
  });
}
