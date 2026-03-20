/**
 * Rate limiter for API routes.
 *
 * Sync version (checkRateLimit): used by existing routes (forgot-password, etc.)
 * Async version (checkRateLimitAsync): designed to swap in Upstash Redis when
 *   UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN are set. Falls back to the
 *   same in-memory store when the env vars are absent (dev / test).
 *
 * To enable Redis: install @upstash/redis and @upstash/ratelimit, set the env
 * vars, and swap the body of checkRateLimitAsync to use the Redis client.
 */

const requestCounts = new Map<string, { count: number; resetAt: number }>();

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

function _checkInMemory(key: string, maxRequests: number, windowMs: number): RateLimitResult {
  const now = Date.now();
  const entry = requestCounts.get(key);

  if (!entry || now > entry.resetAt) {
    requestCounts.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, remaining: maxRequests - 1, resetAt: now + windowMs };
  }

  if (entry.count >= maxRequests) {
    return { allowed: false, remaining: 0, resetAt: entry.resetAt };
  }

  entry.count++;
  return { allowed: true, remaining: maxRequests - entry.count, resetAt: entry.resetAt };
}

export function checkRateLimit(
  key: string,
  maxRequests: number,
  windowMs: number,
): RateLimitResult {
  return _checkInMemory(key, maxRequests, windowMs);
}

/**
 * Async rate limiter — identical behaviour to checkRateLimit today.
 * When Upstash Redis env vars are present, this will use the Redis backend
 * instead of the in-memory store (swap _checkInMemory for the Redis call here).
 */
export async function checkRateLimitAsync(
  key: string,
  maxRequests: number,
  windowMs: number,
): Promise<RateLimitResult> {
  // Future: if (process.env.UPSTASH_REDIS_REST_URL) { ... Redis path ... }
  return _checkInMemory(key, maxRequests, windowMs);
}

// Cleanup stale entries periodically
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of requestCounts) {
      if (now > entry.resetAt) {
        requestCounts.delete(key);
      }
    }
  }, 60_000);
}
