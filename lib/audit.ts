// lib/audit.ts
// Tamper-evident audit ledger — every entry is SHA-256 chained to the previous.
// RULE: No DELETE endpoint for AuditLog. Return 405 if anyone tries.

import { createHash } from "crypto";
import { prisma } from "@/lib/db";
import { AuditAction } from "@/lib/generated/prisma/enums";

interface AuditData {
  userId: string;
  action: AuditAction;
  entityType: string;
  entityId: string;
  goalId?: string;
  oldValue?: object;
  newValue?: object;
  request?: Request;
}

export async function writeAudit(data: AuditData) {
  const ip = data.request?.headers.get("x-forwarded-for") ?? "unknown";
  const ua = data.request?.headers.get("user-agent") ?? "unknown";
  const now = new Date();

  // Fetch the last entry to continue the hash chain
  const last = await prisma.auditLog.findFirst({ orderBy: { createdAt: "desc" } });
  const previousHash = last?.hash ?? "GENESIS";

  const payload = JSON.stringify({
    userId: data.userId,
    action: data.action,
    entityType: data.entityType,
    entityId: data.entityId,
    newValue: data.newValue ?? null,
    createdAt: now.toISOString(),
  });
  const hash = createHash("sha256").update(payload + previousHash).digest("hex");

  return prisma.auditLog.create({
    data: {
      userId: data.userId,
      action: data.action,
      entityType: data.entityType,
      entityId: data.entityId,
      goalId: data.goalId,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      oldValue: data.oldValue as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      newValue: data.newValue as any,
      ipAddress: ip,
      userAgent: ua,
      hash,
      previousHash,
    },
  });
}
