import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

// Intercept setInterval before module import to capture the cleanup callback
const { getCleanupFn } = vi.hoisted(() => {
  let capturedFn: (() => void) | null = null;
  const origSetInterval = globalThis.setInterval;
  (globalThis as unknown as Record<string, unknown>).setInterval = (fn: () => void, ms: number) => {
    if (ms === 60_000) capturedFn = fn;
    return (origSetInterval as typeof setInterval)(fn, ms);
  };
  return { getCleanupFn: () => capturedFn };
});

import { checkRateLimit, checkRateLimitAsync } from "@/lib/rate-limit";

describe("checkRateLimit", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("allows first request", () => {
    const result = checkRateLimit("test-first", 3, 60000);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(2);
  });

  it("tracks remaining requests", () => {
    const key = "test-remaining";
    checkRateLimit(key, 3, 60000);
    const result = checkRateLimit(key, 3, 60000);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(1);
  });

  it("blocks when limit reached", () => {
    const key = "test-blocked";
    checkRateLimit(key, 2, 60000);
    checkRateLimit(key, 2, 60000);
    const result = checkRateLimit(key, 2, 60000);
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it("resets after window expires", () => {
    const key = "test-reset";
    checkRateLimit(key, 1, 1000);
    vi.advanceTimersByTime(1500);
    const result = checkRateLimit(key, 1, 1000);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(0);
  });

  it("returns resetAt timestamp", () => {
    const now = Date.now();
    const result = checkRateLimit("test-reset-at", 3, 60000);
    expect(result.resetAt).toBeGreaterThanOrEqual(now + 60000);
  });

  it("periodic cleanup removes stale entries", () => {
    // Add an entry with a short window
    checkRateLimit("test-cleanup-stale", 5, 1000);
    // Advance past the window + past the cleanup interval (60s)
    vi.advanceTimersByTime(61_000);
    // After cleanup, a new request to the same key should get a fresh window
    const result = checkRateLimit("test-cleanup-stale", 5, 1000);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(4);
  });

  it("checkRateLimitAsync allows first request (async path)", async () => {
    const result = await checkRateLimitAsync("async-test-first", 3, 60000);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(2);
  });

  it("checkRateLimitAsync blocks when limit reached", async () => {
    const key = "async-test-blocked";
    await checkRateLimitAsync(key, 2, 60000);
    await checkRateLimitAsync(key, 2, 60000);
    const result = await checkRateLimitAsync(key, 2, 60000);
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it("cleanup deletes expired entries but keeps non-expired ones", () => {
    // Register two keys with different windows
    checkRateLimit("cleanup-expired-key", 5, 100); // very short window
    checkRateLimit("cleanup-valid-key", 5, 60_000); // long window

    // Advance time past the short window so first key expires
    vi.advanceTimersByTime(500);

    // Invoke the cleanup callback directly (covers setInterval callback branches)
    const cleanup = getCleanupFn();
    expect(cleanup).not.toBeNull();
    if (cleanup) cleanup();

    // The non-expired key should still be tracked (second call → count=2, remaining=3)
    const result = checkRateLimit("cleanup-valid-key", 5, 60_000);
    expect(result.allowed).toBe(true);
    expect(result.remaining).toBe(3);
  });
});
