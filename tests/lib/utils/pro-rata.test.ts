import { describe, it, expect } from "vitest";

import { calculateProRata, formatProRata } from "@/lib/utils/pro-rata";

// Helper: build dates at midnight to avoid floating point drift
function d(iso: string) {
  return new Date(iso);
}

describe("calculateProRata", () => {
  describe("basic calculation", () => {
    it("computes correct values for a 30-day period switching on day 15", () => {
      const start = d("2025-01-01");
      const end = d("2025-01-31");
      const switchDate = d("2025-01-16"); // 15 days remaining

      const result = calculateProRata(999, 1799, start, end, switchDate);

      expect(result.daysInPeriod).toBe(30);
      expect(result.daysRemaining).toBe(15);
      // credit = (999 / 30) * 15 = 499.5
      expect(result.credit).toBe(499.5);
      // charge = (1799 / 30) * 15 = 899.5
      expect(result.charge).toBe(899.5);
      // net = 899.5 - 499.5 = 400
      expect(result.netAmount).toBe(400);
    });

    it("returns zero net for same plan price", () => {
      const start = d("2025-03-01");
      const end = d("2025-03-31");
      const switchDate = d("2025-03-16");

      const result = calculateProRata(999, 999, start, end, switchDate);

      expect(result.credit).toBe(result.charge);
      expect(result.netAmount).toBe(0);
    });

    it("returns negative net when switching to a cheaper plan (downgrade)", () => {
      const start = d("2025-01-01");
      const end = d("2025-01-31");
      const switchDate = d("2025-01-16");

      const result = calculateProRata(1799, 999, start, end, switchDate);

      expect(result.netAmount).toBeLessThan(0);
      expect(result.credit).toBeGreaterThan(result.charge);
    });

    it("returns positive net for upgrade", () => {
      const start = d("2025-01-01");
      const end = d("2025-01-31");
      const switchDate = d("2025-01-16");

      const result = calculateProRata(999, 4999, start, end, switchDate);

      expect(result.netAmount).toBeGreaterThan(0);
    });
  });

  describe("edge cases", () => {
    it("returns 0 daysRemaining when switching on the last day", () => {
      const start = d("2025-01-01");
      const end = d("2025-01-31");
      const switchDate = d("2025-01-31");

      const result = calculateProRata(999, 1799, start, end, switchDate);

      expect(result.daysRemaining).toBe(0);
      expect(result.credit).toBe(0);
      expect(result.charge).toBe(0);
      expect(result.netAmount).toBe(0);
    });

    it("returns 0 daysRemaining (not negative) when switch date is after period end", () => {
      const start = d("2025-01-01");
      const end = d("2025-01-31");
      const switchDate = d("2025-02-15"); // after end

      const result = calculateProRata(999, 1799, start, end, switchDate);

      expect(result.daysRemaining).toBe(0);
    });

    it("handles annual billing period (365 days)", () => {
      const start = d("2025-01-01");
      const end = d("2026-01-01");
      const switchDate = d("2025-07-02"); // ~183 days remaining

      const result = calculateProRata(9990, 17990, start, end, switchDate);

      expect(result.daysInPeriod).toBe(365);
      expect(result.daysRemaining).toBeGreaterThan(0);
      expect(result.daysRemaining).toBeLessThan(365);
      expect(result.netAmount).toBeGreaterThan(0);
    });

    it("handles zero old price (free plan upgrade)", () => {
      const start = d("2025-01-01");
      const end = d("2025-01-31");
      const switchDate = d("2025-01-16");

      const result = calculateProRata(0, 999, start, end, switchDate);

      expect(result.credit).toBe(0);
      expect(result.charge).toBeGreaterThan(0);
      expect(result.netAmount).toBe(result.charge);
    });

    it("rounds result to 2 decimal places", () => {
      const start = d("2025-01-01");
      const end = d("2025-01-31");
      const switchDate = d("2025-01-11"); // 20 days remaining

      const result = calculateProRata(100, 300, start, end, switchDate);

      // Verify cents precision
      expect(result.credit).toBe(Math.round(result.credit * 100) / 100);
      expect(result.charge).toBe(Math.round(result.charge * 100) / 100);
      expect(result.netAmount).toBe(Math.round(result.netAmount * 100) / 100);
    });
  });

  describe("defaults to now when switchDate is omitted", () => {
    it("does not throw and returns valid structure", () => {
      const start = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000); // 7 days ago
      const end = new Date(Date.now() + 23 * 24 * 60 * 60 * 1000); // 23 days from now

      const result = calculateProRata(999, 1799, start, end);

      expect(result).toHaveProperty("daysInPeriod");
      expect(result).toHaveProperty("daysRemaining");
      expect(result).toHaveProperty("credit");
      expect(result).toHaveProperty("charge");
      expect(result).toHaveProperty("netAmount");
      expect(result.daysRemaining).toBeGreaterThanOrEqual(0);
    });
  });
});

describe("formatProRata", () => {
  it("shows amount due when netAmount is positive", () => {
    const result = formatProRata({
      daysInPeriod: 30,
      daysRemaining: 15,
      credit: 499.5,
      charge: 899.5,
      netAmount: 400,
    });

    expect(result).toContain("400");
    expect(result).toContain("due today");
    expect(result).toContain("15 days remaining");
  });

  it("shows credit when netAmount is negative", () => {
    const result = formatProRata({
      daysInPeriod: 30,
      daysRemaining: 15,
      credit: 899.5,
      charge: 499.5,
      netAmount: -400,
    });

    expect(result).toContain("400");
    expect(result).toContain("credit applied");
  });

  it("shows no charge message when netAmount is zero", () => {
    const result = formatProRata({
      daysInPeriod: 30,
      daysRemaining: 0,
      credit: 0,
      charge: 0,
      netAmount: 0,
    });

    expect(result).toBe("No charge for this switch");
  });

  it("formats large amounts with Indian locale separators", () => {
    const result = formatProRata({
      daysInPeriod: 365,
      daysRemaining: 300,
      credit: 8000,
      charge: 40000,
      netAmount: 32000,
    });

    expect(result).toContain("32,000");
  });
});
