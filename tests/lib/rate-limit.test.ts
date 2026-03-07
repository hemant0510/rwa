import { describe, it, expect, beforeEach, vi } from "vitest";

import { checkRateLimit } from "@/lib/rate-limit";

describe("checkRateLimit", () => {
  beforeEach(() => {
    // Use a unique key per test to avoid collisions
    vi.useFakeTimers();
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

  vi.useRealTimers();
});
