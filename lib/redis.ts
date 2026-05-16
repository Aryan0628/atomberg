// lib/redis.ts
// COST: Upstash Redis — $0/month free tier (10k commands/day).
// Used only for escalation deduplication. Not a primary data store.

import { Redis } from "@upstash/redis";

// Graceful fallback: if Redis is not configured, use in-memory Map
// This ensures the app works in development without Upstash setup.

let redisInstance: Redis | null = null;

function getRedis(): Redis | null {
  if (redisInstance) return redisInstance;

  if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
    redisInstance = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });
    return redisInstance;
  }

  return null;
}

// In-memory fallback for development
const memoryStore = new Map<string, { value: string; expiresAt: number }>();

/**
 * Get a value from Redis or in-memory store.
 */
export async function redisGet(key: string): Promise<string | null> {
  const redis = getRedis();
  if (redis) {
    return redis.get<string>(key);
  }

  // In-memory fallback
  const entry = memoryStore.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    memoryStore.delete(key);
    return null;
  }
  return entry.value;
}

/**
 * Set a value in Redis or in-memory store with expiration (in seconds).
 */
export async function redisSetex(
  key: string,
  seconds: number,
  value: string
): Promise<void> {
  const redis = getRedis();
  if (redis) {
    await redis.setex(key, seconds, value);
    return;
  }

  // In-memory fallback
  memoryStore.set(key, {
    value,
    expiresAt: Date.now() + seconds * 1000,
  });
}

export { getRedis as redis };
