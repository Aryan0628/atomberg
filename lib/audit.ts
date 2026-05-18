// lib/audit.ts
// Tamper-evident audit ledger — every entry is SHA-256 chained to the previous.
//
// Concurrency: standalone writes acquire a PostgreSQL advisory lock (pg_advisory_xact_lock)
// inside a transaction so concurrent requests cannot fork the chain. Without this lock,
// two simultaneous writeAudit() calls could both read the same "last hash" and produce
// two entries with identical previousHash, breaking verify's linear walk.
//
// The advisory lock is session-scoped and released automatically at transaction commit —
// zero risk of lock leaks. Lock ID 424242 is an arbitrary stable constant for this table.
//
// Transaction writes (tx param provided): the caller's transaction already serialises the
// write, so we skip the inner transaction wrapper and write directly into the caller's tx.
//
// RULE: No DELETE endpoint for AuditLog. Return 405 if anyone tries.

import { createHash } from "crypto";
import { prisma } from "@/lib/db";
import { AuditAction } from "@/lib/generated/prisma/enums";

const ADVISORY_LOCK_ID = BigInt(424242);

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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function _writeAuditInner(data: AuditData, client: any): Promise<ReturnType<typeof prisma.auditLog.create>> {
  const ip = data.request?.headers.get("x-forwarded-for") ?? "unknown";
  const ua = data.request?.headers.get("user-agent") ?? "unknown";
  const now = new Date();

  // Always read last hash from DB — Redis cache caused race conditions.
  const last = await client.auditLog.findFirst({
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: { hash: true },
  });
  const previousHash = last?.hash ?? "GENESIS";

  // Hash the FULL canonical payload — any field omitted here is undetectable tampering.
  const canonicalPayload = JSON.stringify({
    userId:     data.userId,
    action:     data.action,
    entityType: data.entityType,
    entityId:   data.entityId,
    goalId:     data.goalId ?? null,
    oldValue:   data.oldValue ?? null,
    newValue:   data.newValue ?? null,
    ipAddress:  ip,
    userAgent:  ua,
    createdAt:  now.toISOString(),
  });
  const hash = createHash("sha256").update(canonicalPayload + previousHash).digest("hex");

  return client.auditLog.create({
    data: {
      userId:      data.userId,
      action:      data.action,
      entityType:  data.entityType,
      entityId:    data.entityId,
      goalId:      data.goalId,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      oldValue:    data.oldValue as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      newValue:    data.newValue as any,
      ipAddress:   ip,
      userAgent:   ua,
      hash,
      previousHash,
      createdAt:   now, // must match the timestamp used in canonicalPayload
    },
  });
}

// Accepts an optional Prisma transaction client. When called without tx, wraps in its
// own $transaction with an advisory lock to serialize concurrent standalone writes.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function writeAudit(data: AuditData, tx?: any) {
  if (tx) {
    // Already inside a caller-managed transaction — write directly.
    return _writeAuditInner(data, tx);
  }

  // Standalone write: acquire advisory lock so hash chain stays linear under concurrency.
  return prisma.$transaction(async (innerTx) => {
    await innerTx.$executeRaw`SELECT pg_advisory_xact_lock(${ADVISORY_LOCK_ID})`;
    return _writeAuditInner(data, innerTx);
  });
}
