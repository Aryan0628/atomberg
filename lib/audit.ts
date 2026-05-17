// lib/audit.ts
// Tamper-evident audit ledger — every entry is SHA-256 chained to the previous.
// Hash payload includes ALL fields (userId, action, entityType, entityId, goalId,
// oldValue, newValue, ipAddress, userAgent, createdAt) so tampering with any
// field — including omitted ones like IP — is detected by the verify endpoint.
//
// Concurrency note: ordering uses (createdAt, id) so concurrent writes at the
// same millisecond get a deterministic chain order. A true advisory lock would
// require raw SQL; this is the correct approach for Prisma without extensions.
//
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

// Accepts an optional Prisma transaction client so audit writes can be
// included inside a $transaction without breaking the hash chain.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function writeAudit(data: AuditData, tx?: any) {
  const client = tx ?? prisma;
  const ip = data.request?.headers.get("x-forwarded-for") ?? "unknown";
  const ua = data.request?.headers.get("user-agent") ?? "unknown";
  const now = new Date();

  // Fetch last entry with (createdAt DESC, id DESC) for deterministic ordering
  // under concurrent writes at the same millisecond.
  const last = await client.auditLog.findFirst({
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: { hash: true },
  });
  const previousHash = last?.hash ?? "GENESIS";

  // Hash the FULL canonical payload — any field omitted here is undetectable tampering.
  const canonicalPayload = JSON.stringify({
    userId: data.userId,
    action: data.action,
    entityType: data.entityType,
    entityId: data.entityId,
    goalId: data.goalId ?? null,
    oldValue: data.oldValue ?? null,
    newValue: data.newValue ?? null,
    ipAddress: ip,
    userAgent: ua,
    createdAt: now.toISOString(),
  });
  const hash = createHash("sha256").update(canonicalPayload + previousHash).digest("hex");

  return client.auditLog.create({
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
      createdAt: now, // must match timestamp in canonicalPayload — do not let DB default this
    },
  });
}
