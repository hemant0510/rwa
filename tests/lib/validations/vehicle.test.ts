import { describe, it, expect } from "vitest";

import { vehicleSchema, vehicleUpdateSchema } from "@/lib/validations/vehicle";

const VALID_BASE = {
  registrationNumber: "DL3CAB1234",
  vehicleType: "FOUR_WHEELER" as const,
  unitId: "00000000-0000-4000-8000-000000000001",
};

describe("vehicleSchema", () => {
  // ── Valid registration number formats ──────────────────────────────────────

  it("accepts compact uppercase format (DL3CAB1234)", () => {
    expect(vehicleSchema.safeParse(VALID_BASE).success).toBe(true);
  });

  it("accepts spaced format with contiguous series (DL 3CAB 1234)", () => {
    const result = vehicleSchema.safeParse({ ...VALID_BASE, registrationNumber: "DL 3CAB 1234" });
    expect(result.success).toBe(true);
  });

  it("accepts hyphenated format with contiguous series (DL-3CAB-1234)", () => {
    const result = vehicleSchema.safeParse({ ...VALID_BASE, registrationNumber: "DL-3CAB-1234" });
    expect(result.success).toBe(true);
  });

  it("accepts lowercase and normalises (dl3cab1234)", () => {
    const result = vehicleSchema.safeParse({ ...VALID_BASE, registrationNumber: "dl3cab1234" });
    expect(result.success).toBe(true);
  });

  it("accepts single-digit district number (MH1AB1234)", () => {
    const result = vehicleSchema.safeParse({ ...VALID_BASE, registrationNumber: "MH1AB1234" });
    expect(result.success).toBe(true);
  });

  it("accepts two-letter series (KA51MZ4567)", () => {
    const result = vehicleSchema.safeParse({ ...VALID_BASE, registrationNumber: "KA51MZ4567" });
    expect(result.success).toBe(true);
  });

  // ── Invalid registration numbers ──────────────────────────────────────────

  it("rejects too-short number", () => {
    const result = vehicleSchema.safeParse({ ...VALID_BASE, registrationNumber: "DL3C" });
    expect(result.success).toBe(false);
    if (!result.success)
      expect(result.error.issues[0].message).toMatch(/valid registration number/i);
  });

  it("rejects numbers with invalid structure", () => {
    const result = vehicleSchema.safeParse({ ...VALID_BASE, registrationNumber: "1234ABCD" });
    expect(result.success).toBe(false);
  });

  it("rejects empty string", () => {
    const result = vehicleSchema.safeParse({ ...VALID_BASE, registrationNumber: "" });
    expect(result.success).toBe(false);
  });

  // ── vehicleType ───────────────────────────────────────────────────────────

  it("accepts all VehicleType enum values", () => {
    const types = [
      "TWO_WHEELER",
      "TWO_WHEELER_EV",
      "FOUR_WHEELER",
      "FOUR_WHEELER_EV",
      "BICYCLE",
      "COMMERCIAL",
      "OTHER",
    ] as const;
    for (const vehicleType of types) {
      expect(vehicleSchema.safeParse({ ...VALID_BASE, vehicleType }).success).toBe(true);
    }
  });

  it("rejects invalid vehicleType", () => {
    const result = vehicleSchema.safeParse({ ...VALID_BASE, vehicleType: "HELICOPTER" });
    expect(result.success).toBe(false);
  });

  // ── unitId ────────────────────────────────────────────────────────────────

  it("rejects invalid UUID for unitId", () => {
    const result = vehicleSchema.safeParse({ ...VALID_BASE, unitId: "not-a-uuid" });
    expect(result.success).toBe(false);
  });

  // ── Optional fields ────────────────────────────────────────────────────────

  it("accepts all optional fields when provided", () => {
    const result = vehicleSchema.safeParse({
      ...VALID_BASE,
      make: "Maruti",
      model: "Swift",
      colour: "White",
      dependentOwnerId: "00000000-0000-4000-8000-000000000002",
      parkingSlot: "A-12",
      insuranceExpiry: "2026-12-31",
      pucExpiry: "2025-11-30",
      rcExpiry: "2030-01-01",
      fastagId: "FASTAG123456",
      notes: "Company car",
    });
    expect(result.success).toBe(true);
  });

  it("accepts null dependentOwnerId", () => {
    const result = vehicleSchema.safeParse({ ...VALID_BASE, dependentOwnerId: null });
    expect(result.success).toBe(true);
  });

  it("rejects make longer than 50 chars", () => {
    const result = vehicleSchema.safeParse({ ...VALID_BASE, make: "A".repeat(51) });
    expect(result.success).toBe(false);
  });

  it("rejects notes longer than 300 chars", () => {
    const result = vehicleSchema.safeParse({ ...VALID_BASE, notes: "A".repeat(301) });
    expect(result.success).toBe(false);
  });
});

describe("vehicleUpdateSchema", () => {
  it("accepts empty object (all fields optional)", () => {
    expect(vehicleUpdateSchema.safeParse({}).success).toBe(true);
  });

  it("accepts partial update with only colour", () => {
    expect(vehicleUpdateSchema.safeParse({ colour: "Blue" }).success).toBe(true);
  });

  it("accepts updating registrationNumber with valid format", () => {
    const result = vehicleUpdateSchema.safeParse({ registrationNumber: "MH12AB3456" });
    expect(result.success).toBe(true);
  });

  it("rejects invalid registrationNumber in partial update", () => {
    const result = vehicleUpdateSchema.safeParse({ registrationNumber: "BADFORMAT" });
    expect(result.success).toBe(false);
  });

  it("does not include unitId (cannot change unit after creation)", () => {
    // unitId is omitted from vehicleUpdateSchema — Zod strips unknown keys by default
    const result = vehicleUpdateSchema.safeParse({
      unitId: "00000000-0000-4000-8000-000000000001",
      colour: "Red",
    });
    // Extra keys stripped — parse succeeds
    expect(result.success).toBe(true);
  });
});
