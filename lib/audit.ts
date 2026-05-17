// lib/audit.ts
// Tamper-evident audit ledger — every entry is SHA-256 chained to the previous.
// Hash payload includes ALL fields (userId, action, entityType, entityId, goalId,
// oldValue, newValue, ipAddress, userAgent, createdAt) so tampering with any
// field — including omitted ones like IP — is detected by the verify endpoint.
//
// Performance: last hash is cached in Redis (LAST_HASH_KEY, 5 min TTL).
// For standalone (non-transaction) writes this eliminates the findFirst DB trip.
// For transaction writes (tx param provided), we still hit the DB — necessary
// for correctness since the tx client sees uncommitted data from its own writes.
//
// Concurrency note: ordering uses (createdAt, id) so concurrent writes at the
// same millisecond get a deterministic chain order. A true advisory lock would
// require raw SQL; this is the correct approach for Prisma without extensions.
//
// RULE: No DELETE endpoint for AuditLog. Return 405 if anyone tries.

import { createHash } from "crypto";
import { prisma } from "@/lib/db";
import { redisGet, redisSetex } from "@/lib/redis";
import { AuditAction } from "@/lib/generated/prisma/enums";

const LAST_HASH_KEY = "audit:last-hash";
const LAST_HASH_TTL = 300; // 5 min — refreshed on every write

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

// Fetch the previous hash: Redis for standalone writes, DB for tx writes.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function fetchPreviousHash(client: any, isTx: boolean): Promise<string> {
  if (!isTx) {
    // Non-transaction path: try Redis cache first (no DB round trip).
    try {
      const cached = await redisGet(LAST_HASH_KEY);
      if (cached) return cached;
    } catch {
      // Redis unavailable — fall through to DB
    }
  }

  // Transaction path OR Redis miss: query the DB for the latest hash.
  // (createdAt DESC, id DESC) covered by the compound index on AuditLog.
  const last = await client.auditLog.findFirst({
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: { hash: true },
  });
  return last?.hash ?? "GENESIS";
}

// Accepts an optional Prisma transaction client so audit writes can be
// included inside a $transaction without breaking the hash chain.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function writeAudit(data: AuditData, tx?: any) {
  const isTx = tx != null;
  const client = tx ?? prisma;
  const ip = data.request?.headers.get("x-forwarded-for") ?? "unknown";
  const ua = data.request?.headers.get("user-agent") ?? "unknown";
  const now = new Date();

  const previousHash = await fetchPreviousHash(client, isTx);

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

  const entry = await client.auditLog.create({
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

  // Update Redis cache with the new hash — fire-and-forget, never block the caller.
  redisSetex(LAST_HASH_KEY, LAST_HASH_TTL, hash).catch(() => {});

  return entry;
}
