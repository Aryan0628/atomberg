// lib/rate-limit.ts
// API rate limiting — uses Upstash Redis when available, falls back to in-memory.

import { redisGet, redisSetex } from "@/lib/redis";

interface RateLimitResult {
  success: boolean;
  remaining: number;
  reset: number;
}

export async function rateLimit(
  identifier: string,
  maxRequests: number = 60,
  windowSeconds: number = 60
): Promise<RateLimitResult> {
  const key = `rate:${identifier}`;
  const current = await redisGet(key);
  const count = current ? parseInt(current, 10) : 0;

  if (count >= maxRequests) {
    return { success: false, remaining: 0, reset: windowSeconds };
  }

  await redisSetex(key, windowSeconds, String(count + 1));
  return { success: true, remaining: maxRequests - count - 1, reset: windowSeconds };
}
