import { describe, it, expect } from "vitest";

import {
  generateInvoiceNo,
  addBillingCycle,
  toPeriodKey,
  parseISODateOnly,
  startOfUtcDay,
  diffDaysUtc,
} from "@/lib/billing";

// ──────────────────────────────────────────
// generateInvoiceNo
// ──────────────────────────────────────────
describe("generateInvoiceNo", () => {
  it("formats with zero-padded sequence", () => {
    expect(generateInvoiceNo(2026, 1)).toBe("INV-2026-000001");
  });

  it("pads sequence to 6 digits", () => {
    expect(generateInvoiceNo(2026, 42)).toBe("INV-2026-000042");
  });

  it("handles large sequence numbers", () => {
    expect(generateInvoiceNo(2026, 123456)).toBe("INV-2026-123456");
  });

  it("handles sequence exceeding 6 digits", () => {
    expect(generateInvoiceNo(2026, 1234567)).toBe("INV-2026-1234567");
  });
});

// ──────────────────────────────────────────
// addBillingCycle
// ──────────────────────────────────────────
describe("addBillingCycle", () => {
  const base = new Date("2026-01-15T00:00:00Z");

  it("adds 1 month for MONTHLY", () => {
    const result = addBillingCycle(base, "MONTHLY");
    expect(result.getMonth()).toBe(1); // Feb
    expect(result.getDate()).toBe(15);
  });

  it("adds 1 year for ANNUAL", () => {
    const result = addBillingCycle(base, "ANNUAL");
    expect(result.getFullYear()).toBe(2027);
    expect(result.getMonth()).toBe(0);
  });

  it("adds 2 years for TWO_YEAR", () => {
    const result = addBillingCycle(base, "TWO_YEAR");
    expect(result.getFullYear()).toBe(2028);
  });

  it("adds 3 years for THREE_YEAR", () => {
    const result = addBillingCycle(base, "THREE_YEAR");
    expect(result.getFullYear()).toBe(2029);
  });

  it("does not mutate the original date", () => {
    const original = new Date("2026-06-01T00:00:00Z");
    const originalTime = original.getTime();
    addBillingCycle(original, "ANNUAL");
    expect(original.getTime()).toBe(originalTime);
  });

  it("handles month overflow (Jan 31 + 1 month)", () => {
    const jan31 = new Date("2026-01-31T00:00:00Z");
    const result = addBillingCycle(jan31, "MONTHLY");
    // JS Date rolls Jan 31 + 1 month to Mar 3 (28 days in Feb 2026)
    expect(result.getMonth()).toBe(2); // March
  });
});

// ──────────────────────────────────────────
// toPeriodKey
// ──────────────────────────────────────────
describe("toPeriodKey", () => {
  it("returns YYYY-MM format", () => {
    expect(toPeriodKey(new Date("2026-03-15T00:00:00Z"))).toBe("2026-03");
  });

  it("zero-pads single-digit months", () => {
    expect(toPeriodKey(new Date("2026-01-01T00:00:00Z"))).toBe("2026-01");
  });

  it("handles December correctly", () => {
    expect(toPeriodKey(new Date("2026-12-31T00:00:00Z"))).toBe("2026-12");
  });
});

// ──────────────────────────────────────────
// parseISODateOnly
// ──────────────────────────────────────────
describe("parseISODateOnly", () => {
  it("parses YYYY-MM-DD to UTC date", () => {
    const d = parseISODateOnly("2026-03-15");
    expect(d.getUTCFullYear()).toBe(2026);
    expect(d.getUTCMonth()).toBe(2); // 0-indexed
    expect(d.getUTCDate()).toBe(15);
  });

  it("returns midnight UTC", () => {
    const d = parseISODateOnly("2026-06-01");
    expect(d.getUTCHours()).toBe(0);
    expect(d.getUTCMinutes()).toBe(0);
    expect(d.getUTCSeconds()).toBe(0);
  });
});

// ──────────────────────────────────────────
// startOfUtcDay
// ──────────────────────────────────────────
describe("startOfUtcDay", () => {
  it("zeroes out time components", () => {
    const d = startOfUtcDay(new Date("2026-03-15T14:30:45.123Z"));
    expect(d.getUTCHours()).toBe(0);
    expect(d.getUTCMinutes()).toBe(0);
    expect(d.getUTCSeconds()).toBe(0);
    expect(d.getUTCMilliseconds()).toBe(0);
  });

  it("preserves the date", () => {
    const d = startOfUtcDay(new Date("2026-07-04T23:59:59Z"));
    expect(d.getUTCFullYear()).toBe(2026);
    expect(d.getUTCMonth()).toBe(6);
    expect(d.getUTCDate()).toBe(4);
  });
});

// ──────────────────────────────────────────
// diffDaysUtc
// ──────────────────────────────────────────
describe("diffDaysUtc", () => {
  it("returns positive days when to > from", () => {
    const from = new Date("2026-03-01T00:00:00Z");
    const to = new Date("2026-03-11T00:00:00Z");
    expect(diffDaysUtc(from, to)).toBe(10);
  });

  it("returns negative days when to < from", () => {
    const from = new Date("2026-03-11T00:00:00Z");
    const to = new Date("2026-03-01T00:00:00Z");
    expect(diffDaysUtc(from, to)).toBe(-10);
  });

  it("returns 0 for same day", () => {
    const d = new Date("2026-03-15T12:00:00Z");
    expect(diffDaysUtc(d, d)).toBe(0);
  });

  it("ignores time-of-day differences", () => {
    const from = new Date("2026-03-01T23:59:59Z");
    const to = new Date("2026-03-02T00:00:01Z");
    expect(diffDaysUtc(from, to)).toBe(1);
  });

  it("handles cross-month boundaries", () => {
    const from = new Date("2026-01-28T00:00:00Z");
    const to = new Date("2026-02-04T00:00:00Z");
    expect(diffDaysUtc(from, to)).toBe(7);
  });
});
