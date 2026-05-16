// lib/audit.ts
// Audit trail write helper — every mutation in the system is logged.
// RULE: No DELETE endpoint for AuditLog. Return 405 if anyone tries.

import { prisma } from "@/lib/db";
import { AuditAction } from "@/lib/generated/prisma";

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

/**
 * Writes an immutable audit log entry.
 * Captures IP address and user agent from the request when available.
 */
export async function writeAudit(data: AuditData) {
  const ip = data.request?.headers.get("x-forwarded-for") ?? "unknown";
  const ua = data.request?.headers.get("user-agent") ?? "unknown";

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
    },
  });
}
