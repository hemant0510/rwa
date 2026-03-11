import { describe, it, expect } from "vitest";

import {
  createDiscountSchema,
  updateDiscountSchema,
  validateCouponSchema,
} from "@/lib/validations/discount";

const validCouponDiscount = {
  name: "Summer Sale",
  discountType: "PERCENTAGE" as const,
  discountValue: 20,
  appliesToAll: true,
  applicablePlanIds: [],
  triggerType: "COUPON_CODE" as const,
  couponCode: "SUMMER20",
  allowedCycles: [],
};

const validTimeLimitedDiscount = {
  name: "New Year Offer",
  discountType: "PERCENTAGE" as const,
  discountValue: 30,
  appliesToAll: true,
  applicablePlanIds: [],
  triggerType: "AUTO_TIME_LIMITED" as const,
  allowedCycles: [],
};

describe("createDiscountSchema", () => {
  describe("valid inputs", () => {
    it("passes with valid COUPON_CODE discount", () => {
      expect(createDiscountSchema.safeParse(validCouponDiscount).success).toBe(true);
    });

    it("passes with AUTO_TIME_LIMITED discount (no coupon code needed)", () => {
      expect(createDiscountSchema.safeParse(validTimeLimitedDiscount).success).toBe(true);
    });

    it("passes with FLAT_AMOUNT discount type", () => {
      const input = { ...validCouponDiscount, discountType: "FLAT_AMOUNT", discountValue: 500 };
      expect(createDiscountSchema.safeParse(input).success).toBe(true);
    });

    it("passes with plan-specific applicablePlanIds", () => {
      const input = {
        ...validTimeLimitedDiscount,
        appliesToAll: false,
        applicablePlanIds: ["11111111-1111-4111-8111-111111111111"],
      };
      expect(createDiscountSchema.safeParse(input).success).toBe(true);
    });

    it("passes with allowed billing cycles restriction", () => {
      const input = { ...validCouponDiscount, allowedCycles: ["ANNUAL", "TWO_YEAR"] };
      expect(createDiscountSchema.safeParse(input).success).toBe(true);
    });

    it("passes with optional startsAt / endsAt dates", () => {
      const input = {
        ...validTimeLimitedDiscount,
        startsAt: "2025-01-01T00:00:00.000Z",
        endsAt: "2025-12-31T23:59:59.000Z",
      };
      expect(createDiscountSchema.safeParse(input).success).toBe(true);
    });

    it("passes with maxUsageCount", () => {
      const input = { ...validCouponDiscount, maxUsageCount: 100 };
      expect(createDiscountSchema.safeParse(input).success).toBe(true);
    });

    it("passes with PLAN_SPECIFIC trigger type", () => {
      const input = {
        ...validTimeLimitedDiscount,
        triggerType: "PLAN_SPECIFIC",
        appliesToAll: false,
        applicablePlanIds: ["11111111-1111-4111-8111-111111111111"],
      };
      expect(createDiscountSchema.safeParse(input).success).toBe(true);
    });

    it("passes with MANUAL_OVERRIDE trigger type", () => {
      const input = { ...validTimeLimitedDiscount, triggerType: "MANUAL_OVERRIDE" };
      expect(createDiscountSchema.safeParse(input).success).toBe(true);
    });
  });

  describe("field validation", () => {
    it("fails with name shorter than 2 chars", () => {
      expect(createDiscountSchema.safeParse({ ...validCouponDiscount, name: "A" }).success).toBe(
        false,
      );
    });

    it("fails with name longer than 150 chars", () => {
      expect(
        createDiscountSchema.safeParse({ ...validCouponDiscount, name: "A".repeat(151) }).success,
      ).toBe(false);
    });

    it("fails with non-positive discountValue", () => {
      expect(
        createDiscountSchema.safeParse({ ...validCouponDiscount, discountValue: 0 }).success,
      ).toBe(false);
      expect(
        createDiscountSchema.safeParse({ ...validCouponDiscount, discountValue: -10 }).success,
      ).toBe(false);
    });

    it("fails with invalid discountType", () => {
      expect(
        createDiscountSchema.safeParse({ ...validCouponDiscount, discountType: "FIXED" }).success,
      ).toBe(false);
    });

    it("fails with invalid triggerType", () => {
      expect(
        createDiscountSchema.safeParse({ ...validCouponDiscount, triggerType: "AUTOMATIC" })
          .success,
      ).toBe(false);
    });

    it("fails with non-UUID in applicablePlanIds", () => {
      const input = {
        ...validTimeLimitedDiscount,
        appliesToAll: true,
        applicablePlanIds: ["not-a-uuid"],
      };
      expect(createDiscountSchema.safeParse(input).success).toBe(false);
    });

    it("fails with invalid billing cycle in allowedCycles", () => {
      const input = { ...validCouponDiscount, allowedCycles: ["WEEKLY"] };
      expect(createDiscountSchema.safeParse(input).success).toBe(false);
    });
  });

  describe("superRefine rules", () => {
    it("fails when COUPON_CODE trigger has no couponCode", () => {
      const input = { ...validCouponDiscount, couponCode: null };
      const result = createDiscountSchema.safeParse(input);
      expect(result.success).toBe(false);
      if (!result.success) {
        const codes = result.error.issues.map((i) => i.path[0]);
        expect(codes).toContain("couponCode");
      }
    });

    it("fails when PERCENTAGE discount exceeds 100", () => {
      const input = { ...validCouponDiscount, discountType: "PERCENTAGE", discountValue: 101 };
      const result = createDiscountSchema.safeParse(input);
      expect(result.success).toBe(false);
      if (!result.success) {
        const codes = result.error.issues.map((i) => i.path[0]);
        expect(codes).toContain("discountValue");
      }
    });

    it("allows PERCENTAGE discount of exactly 100", () => {
      const input = { ...validCouponDiscount, discountType: "PERCENTAGE", discountValue: 100 };
      expect(createDiscountSchema.safeParse(input).success).toBe(true);
    });

    it("fails when appliesToAll=false and applicablePlanIds is empty", () => {
      const input = { ...validTimeLimitedDiscount, appliesToAll: false, applicablePlanIds: [] };
      const result = createDiscountSchema.safeParse(input);
      expect(result.success).toBe(false);
      if (!result.success) {
        const codes = result.error.issues.map((i) => i.path[0]);
        expect(codes).toContain("applicablePlanIds");
      }
    });

    it("passes when appliesToAll=true even with empty applicablePlanIds", () => {
      const input = { ...validTimeLimitedDiscount, appliesToAll: true, applicablePlanIds: [] };
      expect(createDiscountSchema.safeParse(input).success).toBe(true);
    });

    it("allows FLAT_AMOUNT discount greater than 100", () => {
      const input = { ...validCouponDiscount, discountType: "FLAT_AMOUNT", discountValue: 2000 };
      expect(createDiscountSchema.safeParse(input).success).toBe(true);
    });
  });
});

describe("updateDiscountSchema", () => {
  it("passes with empty object (all fields optional)", () => {
    expect(updateDiscountSchema.safeParse({}).success).toBe(true);
  });

  it("passes with name update only", () => {
    expect(updateDiscountSchema.safeParse({ name: "Renamed Discount" }).success).toBe(true);
  });

  it("passes with discountValue update", () => {
    expect(updateDiscountSchema.safeParse({ discountValue: 15 }).success).toBe(true);
  });

  it("fails with invalid discountValue when provided", () => {
    expect(updateDiscountSchema.safeParse({ discountValue: -5 }).success).toBe(false);
  });

  it("fails with invalid discountType when provided", () => {
    expect(updateDiscountSchema.safeParse({ discountType: "FIXED" }).success).toBe(false);
  });

  it("passes with nullable couponCode", () => {
    expect(updateDiscountSchema.safeParse({ couponCode: null }).success).toBe(true);
  });

  it("passes with nullable maxUsageCount", () => {
    expect(updateDiscountSchema.safeParse({ maxUsageCount: null }).success).toBe(true);
  });

  it("passes updating allowedCycles", () => {
    expect(
      updateDiscountSchema.safeParse({ allowedCycles: ["ANNUAL", "THREE_YEAR"] }).success,
    ).toBe(true);
  });
});

describe("validateCouponSchema", () => {
  const validInput = {
    couponCode: "SAVE20",
    planId: "11111111-1111-4111-8111-111111111111",
    billingCycle: "MONTHLY" as const,
  };

  it("passes with valid input", () => {
    expect(validateCouponSchema.safeParse(validInput).success).toBe(true);
  });

  it("fails with empty couponCode", () => {
    expect(validateCouponSchema.safeParse({ ...validInput, couponCode: "" }).success).toBe(false);
  });

  it("fails with non-UUID planId", () => {
    expect(validateCouponSchema.safeParse({ ...validInput, planId: "not-a-uuid" }).success).toBe(
      false,
    );
  });

  it("fails with invalid billingCycle", () => {
    expect(validateCouponSchema.safeParse({ ...validInput, billingCycle: "WEEKLY" }).success).toBe(
      false,
    );
  });

  it("passes for all valid billing cycles", () => {
    for (const cycle of ["MONTHLY", "ANNUAL", "TWO_YEAR", "THREE_YEAR"]) {
      expect(validateCouponSchema.safeParse({ ...validInput, billingCycle: cycle }).success).toBe(
        true,
      );
    }
  });
});
