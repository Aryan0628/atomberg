// lib/cache.ts
// COST: Redis-backed API cache — Upstash free tier (10k commands/day).
// Pattern: check Redis first → compute if miss → write back with TTL.
// Falls back to an in-memory Map when Redis is not configured (dev / cold start).
// Analytics routes are the biggest DB cost driver; caching them at 60-120s
// reduces Neon compute time by ~90% in a typical demo session.

import { redisGet, redisSetex, redisDel } from "@/lib/redis";

const LOCAL_CACHE = new Map<string, { value: unknown; expiresAt: number }>();

/**
 * Generic cache-aside helper.
 *
 * @param key    Unique cache key (prefix with route slug, e.g. "analytics:overview")
 * @param ttl    Seconds before the cached value expires
 * @param fn     Async function that produces the fresh value on a cache miss
 */
export async function withCache<T>(
  key: string,
  ttl: number,
  fn: () => Promise<T>
): Promise<T> {
  // 1. Check local in-process cache FIRST — zero latency, no HTTP.
  //    Useful in dev (long-lived process) and within a single SSR render
  //    where the same key is requested multiple times in one invocation.
  const local = LOCAL_CACHE.get(key);
  if (local && Date.now() < local.expiresAt) {
    return local.value as T;
  }

  // 2. Check Redis — 20-50ms HTTP call, but beats a full DB query (~100-300ms).
  const cached = await redisGet(`cache:${key}`);
  if (cached) {
    try {
      const value = JSON.parse(cached) as T;
      // Warm the local cache so subsequent hits in this invocation are free.
      LOCAL_CACHE.set(key, { value, expiresAt: Date.now() + ttl * 1000 });
      return value;
    } catch {
      // Corrupted cache entry — fall through to recompute
    }
  }

  // 3. Cache miss — compute the real value
  const value = await fn();

  // 4. Write back (fire-and-forget — never block the response)
  redisSetex(`cache:${key}`, ttl, JSON.stringify(value)).catch(() => {});
  LOCAL_CACHE.set(key, { value, expiresAt: Date.now() + ttl * 1000 });

  return value;
}

/**
 * Invalidate a single cache key (call after mutations that change cached data).
 */
export async function invalidateCache(key: string): Promise<void> {
  LOCAL_CACHE.delete(key);
  redisDel(`cache:${key}`).catch(() => {});
}
