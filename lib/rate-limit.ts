// lib/rate-limit.ts
// Atomic API rate limiting using Redis INCR + EXPIRE.
// INCR is an atomic Redis operation — no get/check/set race condition.
// Falls back to an in-process Map when Redis is not configured (dev).
//
// COST: Upstash free tier — 10k commands/day. Each rate-limited request
// costs exactly 1 INCR + 1 EXPIRE (first hit) or 1 INCR (subsequent hits).

import { redis as getRedis } from "@/lib/redis";

interface RateLimitResult {
  success: boolean;
  remaining: number;
  reset: number;
}

// In-process fallback for when Redis is not configured
const memStore = new Map<string, { count: number; expiresAt: number }>();

export async function rateLimit(
  identifier: string,
  maxRequests = 60,
  windowSeconds = 60
): Promise<RateLimitResult> {
  const key = `rl:${identifier}`;
  const redis = getRedis();

  if (redis) {
    // Atomic: INCR returns the new count after increment
    const count = await redis.incr(key);
    if (count === 1) {
      // First request in window — set the expiry
      await redis.expire(key, windowSeconds);
    }
    const success = count <= maxRequests;
    return { success, remaining: Math.max(0, maxRequests - count), reset: windowSeconds };
  }

  // In-memory fallback
  const now = Date.now();
  const entry = memStore.get(key);
  if (!entry || now > entry.expiresAt) {
    memStore.set(key, { count: 1, expiresAt: now + windowSeconds * 1000 });
    return { success: true, remaining: maxRequests - 1, reset: windowSeconds };
  }
  entry.count += 1;
  const success = entry.count <= maxRequests;
  return { success, remaining: Math.max(0, maxRequests - entry.count), reset: windowSeconds };
}
