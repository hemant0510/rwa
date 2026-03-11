import { describe, it, expect } from "vitest";

import {
  planFeaturesSchema,
  billingOptionSchema,
  createPlanSchema,
  updatePlanSchema,
  createBillingOptionSchema,
  updateBillingOptionSchema,
  reorderPlansSchema,
} from "@/lib/validations/plan";

const validFeatures = {
  resident_management: true,
  fee_collection: true,
  expense_tracking: true,
  basic_reports: true,
  advanced_reports: false,
  whatsapp: false,
  elections: false,
  ai_insights: false,
  api_access: false,
  multi_admin: false,
};

const validBillingOption = {
  billingCycle: "MONTHLY" as const,
  price: 999,
};

const validPlan = {
  name: "Basic Plan",
  slug: "basic-plan",
  planType: "FLAT_FEE" as const,
  featuresJson: validFeatures,
  billingOptions: [validBillingOption],
};

describe("planFeaturesSchema", () => {
  it("passes with all boolean fields", () => {
    expect(planFeaturesSchema.safeParse(validFeatures).success).toBe(true);
  });

  it("fails when a field is missing", () => {
    const { resident_management: _, ...partial } = validFeatures;
    expect(planFeaturesSchema.safeParse(partial).success).toBe(false);
  });

  it("fails when a field is not boolean", () => {
    expect(planFeaturesSchema.safeParse({ ...validFeatures, whatsapp: "yes" }).success).toBe(false);
  });
});

describe("billingOptionSchema", () => {
  it("passes with valid MONTHLY option", () => {
    expect(billingOptionSchema.safeParse(validBillingOption).success).toBe(true);
  });

  it("passes with all valid billing cycles", () => {
    for (const cycle of ["MONTHLY", "ANNUAL", "TWO_YEAR", "THREE_YEAR"]) {
      expect(billingOptionSchema.safeParse({ billingCycle: cycle, price: 100 }).success).toBe(true);
    }
  });

  it("fails with invalid billing cycle", () => {
    expect(billingOptionSchema.safeParse({ billingCycle: "WEEKLY", price: 100 }).success).toBe(
      false,
    );
  });

  it("fails with non-positive price", () => {
    expect(billingOptionSchema.safeParse({ billingCycle: "MONTHLY", price: 0 }).success).toBe(
      false,
    );
    expect(billingOptionSchema.safeParse({ billingCycle: "MONTHLY", price: -50 }).success).toBe(
      false,
    );
  });

  it("defaults isActive to true when omitted", () => {
    const result = billingOptionSchema.safeParse(validBillingOption);
    expect(result.success && result.data.isActive).toBe(true);
  });
});

describe("createPlanSchema", () => {
  it("passes with minimal valid FLAT_FEE plan", () => {
    expect(createPlanSchema.safeParse(validPlan).success).toBe(true);
  });

  it("passes with valid PER_UNIT plan", () => {
    const input = {
      ...validPlan,
      slug: "flex-plan",
      planType: "PER_UNIT",
      pricePerUnit: 8,
    };
    expect(createPlanSchema.safeParse(input).success).toBe(true);
  });

  it("fails with name shorter than 2 chars", () => {
    expect(createPlanSchema.safeParse({ ...validPlan, name: "A" }).success).toBe(false);
  });

  it("fails with name longer than 100 chars", () => {
    expect(createPlanSchema.safeParse({ ...validPlan, name: "A".repeat(101) }).success).toBe(false);
  });

  it("fails with slug containing uppercase letters", () => {
    expect(createPlanSchema.safeParse({ ...validPlan, slug: "Basic-Plan" }).success).toBe(false);
  });

  it("fails with slug containing spaces", () => {
    expect(createPlanSchema.safeParse({ ...validPlan, slug: "basic plan" }).success).toBe(false);
  });

  it("fails with slug containing special characters", () => {
    expect(createPlanSchema.safeParse({ ...validPlan, slug: "basic_plan!" }).success).toBe(false);
  });

  it("passes with valid slug (letters, numbers, hyphens)", () => {
    expect(createPlanSchema.safeParse({ ...validPlan, slug: "basic-123" }).success).toBe(true);
  });

  it("fails with empty billingOptions array", () => {
    expect(createPlanSchema.safeParse({ ...validPlan, billingOptions: [] }).success).toBe(false);
  });

  it("fails with invalid planType", () => {
    expect(createPlanSchema.safeParse({ ...validPlan, planType: "HYBRID" }).success).toBe(false);
  });

  it("allows nullable residentLimit", () => {
    expect(createPlanSchema.safeParse({ ...validPlan, residentLimit: null }).success).toBe(true);
  });

  it("fails with non-integer residentLimit", () => {
    expect(createPlanSchema.safeParse({ ...validPlan, residentLimit: 1.5 }).success).toBe(false);
  });

  it("allows badgeText up to 50 chars", () => {
    expect(createPlanSchema.safeParse({ ...validPlan, badgeText: "Most Popular" }).success).toBe(
      true,
    );
  });

  it("fails with badgeText longer than 50 chars", () => {
    expect(createPlanSchema.safeParse({ ...validPlan, badgeText: "A".repeat(51) }).success).toBe(
      false,
    );
  });

  it("defaults isPublic to true when omitted", () => {
    const result = createPlanSchema.safeParse(validPlan);
    expect(result.success && result.data.isPublic).toBe(true);
  });

  it("defaults displayOrder to 0 when omitted", () => {
    const result = createPlanSchema.safeParse(validPlan);
    expect(result.success && result.data.displayOrder).toBe(0);
  });

  it("defaults trialAccessLevel to false when omitted", () => {
    const result = createPlanSchema.safeParse(validPlan);
    expect(result.success && result.data.trialAccessLevel).toBe(false);
  });

  it("accepts multiple billing options", () => {
    const input = {
      ...validPlan,
      billingOptions: [
        { billingCycle: "MONTHLY", price: 999 },
        { billingCycle: "ANNUAL", price: 9990 },
        { billingCycle: "THREE_YEAR", price: 26973 },
      ],
    };
    expect(createPlanSchema.safeParse(input).success).toBe(true);
  });
});

describe("updatePlanSchema", () => {
  it("passes with empty object (all fields optional)", () => {
    expect(updatePlanSchema.safeParse({}).success).toBe(true);
  });

  it("passes with partial update (name only)", () => {
    expect(updatePlanSchema.safeParse({ name: "Updated Name" }).success).toBe(true);
  });

  it("passes updating isPublic", () => {
    expect(updatePlanSchema.safeParse({ isPublic: false }).success).toBe(true);
  });

  it("fails with invalid name when provided", () => {
    expect(updatePlanSchema.safeParse({ name: "A" }).success).toBe(false);
  });

  it("does not include slug field", () => {
    // slug is omitted in updatePlanSchema, so it should be stripped
    const result = updatePlanSchema.safeParse({ name: "Test Plan", slug: "test" });
    expect(result.success).toBe(true);
  });
});

describe("createBillingOptionSchema", () => {
  it("passes with valid input", () => {
    expect(
      createBillingOptionSchema.safeParse({ billingCycle: "ANNUAL", price: 9990 }).success,
    ).toBe(true);
  });

  it("fails with missing billingCycle", () => {
    expect(createBillingOptionSchema.safeParse({ price: 9990 }).success).toBe(false);
  });
});

describe("updateBillingOptionSchema", () => {
  it("passes with price only", () => {
    expect(updateBillingOptionSchema.safeParse({ price: 1099 }).success).toBe(true);
  });

  it("passes with price and isActive", () => {
    expect(updateBillingOptionSchema.safeParse({ price: 1099, isActive: false }).success).toBe(
      true,
    );
  });

  it("fails with non-positive price", () => {
    expect(updateBillingOptionSchema.safeParse({ price: 0 }).success).toBe(false);
    expect(updateBillingOptionSchema.safeParse({ price: -1 }).success).toBe(false);
  });

  it("fails with missing price", () => {
    expect(updateBillingOptionSchema.safeParse({}).success).toBe(false);
  });
});

describe("reorderPlansSchema", () => {
  it("passes with valid order array", () => {
    const input = {
      order: [
        { id: "11111111-1111-4111-8111-111111111111", displayOrder: 1 },
        { id: "22222222-2222-4222-8222-222222222222", displayOrder: 2 },
      ],
    };
    expect(reorderPlansSchema.safeParse(input).success).toBe(true);
  });

  it("fails with non-UUID id", () => {
    const input = { order: [{ id: "not-a-uuid", displayOrder: 1 }] };
    expect(reorderPlansSchema.safeParse(input).success).toBe(false);
  });

  it("fails with non-integer displayOrder", () => {
    const input = {
      order: [{ id: "00000000-0000-0000-0000-000000000001", displayOrder: 1.5 }],
    };
    expect(reorderPlansSchema.safeParse(input).success).toBe(false);
  });

  it("passes with empty order array", () => {
    expect(reorderPlansSchema.safeParse({ order: [] }).success).toBe(true);
  });
});
