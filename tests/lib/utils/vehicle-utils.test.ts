import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

import { normalizeRegNumber, getExpiryStatus } from "@/lib/utils/vehicle-utils";

describe("normalizeRegNumber", () => {
  it("strips hyphens and uppercases", () => {
    expect(normalizeRegNumber("DL-3C-AB-1234")).toBe("DL3CAB1234");
  });

  it("strips spaces", () => {
    expect(normalizeRegNumber("MH 12 AB 1234")).toBe("MH12AB1234");
  });

  it("strips mixed spaces and hyphens", () => {
    expect(normalizeRegNumber("KA - 01 AB - 9999")).toBe("KA01AB9999");
  });

  it("uppercases lowercase input", () => {
    expect(normalizeRegNumber("dl3cab1234")).toBe("DL3CAB1234");
  });

  it("handles already-normalized input", () => {
    expect(normalizeRegNumber("DL3CAB1234")).toBe("DL3CAB1234");
  });

  it("handles empty string", () => {
    expect(normalizeRegNumber("")).toBe("");
  });
});

describe("getExpiryStatus", () => {
  beforeEach(() => {
    // Fix today to 2026-04-12
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-04-12T10:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns NOT_SET for null", () => {
    expect(getExpiryStatus(null)).toBe("NOT_SET");
  });

  it("returns NOT_SET for undefined", () => {
    expect(getExpiryStatus(undefined)).toBe("NOT_SET");
  });

  it("returns EXPIRED for a past date", () => {
    expect(getExpiryStatus(new Date("2026-01-01"))).toBe("EXPIRED");
  });

  it("returns EXPIRED for yesterday", () => {
    expect(getExpiryStatus(new Date("2026-04-11"))).toBe("EXPIRED");
  });

  it("returns EXPIRING_SOON for today (boundary — 0 days away)", () => {
    expect(getExpiryStatus(new Date("2026-04-12"))).toBe("EXPIRING_SOON");
  });

  it("returns EXPIRING_SOON for exactly 30 days from today (boundary)", () => {
    expect(getExpiryStatus(new Date("2026-05-12"))).toBe("EXPIRING_SOON");
  });

  it("returns VALID for 31 days from today", () => {
    expect(getExpiryStatus(new Date("2026-05-13"))).toBe("VALID");
  });

  it("returns VALID for a far-future date", () => {
    expect(getExpiryStatus(new Date("2030-12-31"))).toBe("VALID");
  });
});
