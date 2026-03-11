import { describe, it, expect } from "vitest";

import {
  assignPlanSchema,
  switchPlanSchema,
  applyDiscountSchema,
} from "@/lib/validations/subscription";

const validUuid = "11111111-1111-4111-8111-111111111111";
const validUuid2 = "22222222-2222-4222-8222-222222222222";

describe("assignPlanSchema", () => {
  it("passes with required fields only", () => {
    expect(
      assignPlanSchema.safeParse({ planId: validUuid, billingOptionId: validUuid2 }).success,
    ).toBe(true);
  });

  it("passes with all optional fields", () => {
    expect(
      assignPlanSchema.safeParse({
        planId: validUuid,
        billingOptionId: validUuid2,
        discountId: validUuid,
        notes: "Assigned via admin panel",
      }).success,
    ).toBe(true);
  });

  it("passes with discountId as null", () => {
    expect(
      assignPlanSchema.safeParse({
        planId: validUuid,
        billingOptionId: validUuid2,
        discountId: null,
      }).success,
    ).toBe(true);
  });

  it("fails with invalid planId (not a UUID)", () => {
    expect(
      assignPlanSchema.safeParse({ planId: "not-a-uuid", billingOptionId: validUuid2 }).success,
    ).toBe(false);
  });

  it("fails with invalid billingOptionId (not a UUID)", () => {
    expect(
      assignPlanSchema.safeParse({ planId: validUuid, billingOptionId: "bad-id" }).success,
    ).toBe(false);
  });

  it("fails with invalid discountId (not a UUID)", () => {
    expect(
      assignPlanSchema.safeParse({
        planId: validUuid,
        billingOptionId: validUuid2,
        discountId: "bad-id",
      }).success,
    ).toBe(false);
  });

  it("fails with notes exceeding 500 characters", () => {
    expect(
      assignPlanSchema.safeParse({
        planId: validUuid,
        billingOptionId: validUuid2,
        notes: "x".repeat(501),
      }).success,
    ).toBe(false);
  });

  it("passes with notes of exactly 500 characters", () => {
    expect(
      assignPlanSchema.safeParse({
        planId: validUuid,
        billingOptionId: validUuid2,
        notes: "x".repeat(500),
      }).success,
    ).toBe(true);
  });

  it("fails when planId is missing", () => {
    expect(assignPlanSchema.safeParse({ billingOptionId: validUuid2 }).success).toBe(false);
  });

  it("fails when billingOptionId is missing", () => {
    expect(assignPlanSchema.safeParse({ planId: validUuid }).success).toBe(false);
  });
});

describe("switchPlanSchema", () => {
  it("passes with required fields only", () => {
    expect(
      switchPlanSchema.safeParse({ planId: validUuid, billingOptionId: validUuid2 }).success,
    ).toBe(true);
  });

  it("passes with optional notes", () => {
    expect(
      switchPlanSchema.safeParse({
        planId: validUuid,
        billingOptionId: validUuid2,
        notes: "Switching to annual plan",
      }).success,
    ).toBe(true);
  });

  it("fails with invalid planId", () => {
    expect(switchPlanSchema.safeParse({ planId: "bad", billingOptionId: validUuid2 }).success).toBe(
      false,
    );
  });

  it("fails with invalid billingOptionId", () => {
    expect(switchPlanSchema.safeParse({ planId: validUuid, billingOptionId: "bad" }).success).toBe(
      false,
    );
  });

  it("fails with notes exceeding 500 characters", () => {
    expect(
      switchPlanSchema.safeParse({
        planId: validUuid,
        billingOptionId: validUuid2,
        notes: "x".repeat(501),
      }).success,
    ).toBe(false);
  });

  it("fails when planId is missing", () => {
    expect(switchPlanSchema.safeParse({ billingOptionId: validUuid2 }).success).toBe(false);
  });
});

describe("applyDiscountSchema", () => {
  it("passes with empty object (all fields optional)", () => {
    expect(applyDiscountSchema.safeParse({}).success).toBe(true);
  });

  it("passes with valid discountId", () => {
    expect(applyDiscountSchema.safeParse({ discountId: validUuid }).success).toBe(true);
  });

  it("passes with discountId as null", () => {
    expect(applyDiscountSchema.safeParse({ discountId: null }).success).toBe(true);
  });

  it("passes with valid customDiscountPct", () => {
    expect(applyDiscountSchema.safeParse({ customDiscountPct: 25 }).success).toBe(true);
  });

  it("passes with customDiscountPct of 0", () => {
    expect(applyDiscountSchema.safeParse({ customDiscountPct: 0 }).success).toBe(true);
  });

  it("passes with customDiscountPct of 100", () => {
    expect(applyDiscountSchema.safeParse({ customDiscountPct: 100 }).success).toBe(true);
  });

  it("passes with customDiscountPct as null", () => {
    expect(applyDiscountSchema.safeParse({ customDiscountPct: null }).success).toBe(true);
  });

  it("fails with customDiscountPct below 0", () => {
    expect(applyDiscountSchema.safeParse({ customDiscountPct: -1 }).success).toBe(false);
  });

  it("fails with customDiscountPct above 100", () => {
    expect(applyDiscountSchema.safeParse({ customDiscountPct: 101 }).success).toBe(false);
  });

  it("fails with invalid discountId (not a UUID)", () => {
    expect(applyDiscountSchema.safeParse({ discountId: "bad-id" }).success).toBe(false);
  });

  it("passes with notes", () => {
    expect(applyDiscountSchema.safeParse({ notes: "Manual override" }).success).toBe(true);
  });

  it("fails with notes exceeding 500 characters", () => {
    expect(applyDiscountSchema.safeParse({ notes: "x".repeat(501) }).success).toBe(false);
  });
});
