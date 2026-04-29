import { beforeEach, describe, expect, it, vi } from "vitest";

/* eslint-disable import/order */
import { mockPrisma } from "../__mocks__/prisma";
import { getPublicPlans } from "@/services/public-plans";
/* eslint-enable import/order */

describe("getPublicPlans", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("serializes active public plans with billing options and pricePerUnit", async () => {
    mockPrisma.platformPlan.findMany.mockResolvedValueOnce([
      {
        id: "plan-1",
        slug: "basic",
        name: "Basic",
        description: "Entry tier",
        planType: "FLAT_FEE",
        residentLimit: 100,
        pricePerUnit: 12.5,
        featuresJson: { fee_collection: true },
        badgeText: "Popular",
        displayOrder: 1,
        billingOptions: [{ id: "bo-1", billingCycle: "MONTHLY", price: 999 }],
      },
    ]);

    const result = await getPublicPlans();

    expect(mockPrisma.platformPlan.findMany).toHaveBeenCalledWith({
      where: { isActive: true, isPublic: true },
      orderBy: { displayOrder: "asc" },
      include: {
        billingOptions: {
          where: { isActive: true },
          orderBy: { billingCycle: "asc" },
        },
      },
    });
    expect(result).toEqual([
      {
        id: "plan-1",
        slug: "basic",
        name: "Basic",
        description: "Entry tier",
        planType: "FLAT_FEE",
        residentLimit: 100,
        pricePerUnit: 12.5,
        featuresJson: { fee_collection: true },
        badgeText: "Popular",
        displayOrder: 1,
        billingOptions: [{ id: "bo-1", billingCycle: "MONTHLY", price: 999 }],
      },
    ]);
  });

  it("handles null pricePerUnit and missing featuresJson", async () => {
    mockPrisma.platformPlan.findMany.mockResolvedValueOnce([
      {
        id: "plan-2",
        slug: "free",
        name: "Free",
        description: null,
        planType: "PER_UNIT",
        residentLimit: null,
        pricePerUnit: null,
        featuresJson: null,
        badgeText: null,
        displayOrder: 0,
        billingOptions: [],
      },
    ]);

    const result = await getPublicPlans();

    expect(result).toEqual([
      {
        id: "plan-2",
        slug: "free",
        name: "Free",
        description: null,
        planType: "PER_UNIT",
        residentLimit: null,
        pricePerUnit: null,
        featuresJson: {},
        badgeText: null,
        displayOrder: 0,
        billingOptions: [],
      },
    ]);
  });

  it("returns empty array when prisma throws", async () => {
    mockPrisma.platformPlan.findMany.mockRejectedValueOnce(new Error("db down"));

    const result = await getPublicPlans();

    expect(result).toEqual([]);
  });
});
