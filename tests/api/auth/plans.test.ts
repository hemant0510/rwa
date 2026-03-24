import { describe, it, expect, vi, beforeEach } from "vitest";

const mockPrisma = vi.hoisted(() => ({
  platformPlan: {
    findMany: vi.fn(),
  },
}));

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

import { GET } from "@/app/api/v1/auth/plans/route";

const MOCK_PLANS = [
  {
    id: "plan-1",
    name: "Basic",
    slug: "basic",
    description: "For small societies",
    planType: "FLAT_FEE",
    residentLimit: 150,
    pricePerUnit: null,
    featuresJson: { fee_collection: true, resident_management: true },
    badgeText: null,
    displayOrder: 1,
    billingOptions: [
      {
        id: "opt-1",
        billingCycle: "MONTHLY",
        price: { toNumber: () => 499, toString: () => "499" },
      },
      {
        id: "opt-2",
        billingCycle: "ANNUAL",
        price: { toNumber: () => 4990, toString: () => "4990" },
      },
    ],
  },
  {
    id: "plan-2",
    name: "Pro",
    slug: "pro",
    description: "For large societies",
    planType: "FLAT_FEE",
    residentLimit: 2000,
    pricePerUnit: null,
    featuresJson: { fee_collection: true, whatsapp: true },
    badgeText: "Most Popular",
    displayOrder: 2,
    billingOptions: [
      {
        id: "opt-3",
        billingCycle: "MONTHLY",
        price: { toNumber: () => 1999, toString: () => "1999" },
      },
    ],
  },
];

describe("GET /api/v1/auth/plans", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 200 with array of active public plans", async () => {
    mockPrisma.platformPlan.findMany.mockResolvedValue(MOCK_PLANS);

    const res = await GET();

    expect(res.status).toBe(200);
    const body = (await res.json()) as unknown[];
    expect(body).toHaveLength(2);
  });

  it("queries only active and public plans ordered by displayOrder", async () => {
    mockPrisma.platformPlan.findMany.mockResolvedValue([]);

    await GET();

    expect(mockPrisma.platformPlan.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { isActive: true, isPublic: true },
        orderBy: { displayOrder: "asc" },
      }),
    );
  });

  it("serializes prices as numbers", async () => {
    mockPrisma.platformPlan.findMany.mockResolvedValue(MOCK_PLANS);

    const res = await GET();
    const body = (await res.json()) as Array<{
      billingOptions: Array<{ billingCycle: string; price: number }>;
    }>;

    expect(typeof body[0].billingOptions[0].price).toBe("number");
    expect(body[0].billingOptions[0].price).toBe(499);
    expect(body[0].billingOptions[1].price).toBe(4990);
  });

  it("includes billingOptions in each plan", async () => {
    mockPrisma.platformPlan.findMany.mockResolvedValue(MOCK_PLANS);

    const res = await GET();
    const body = (await res.json()) as Array<{
      billingOptions: Array<{ billingCycle: string; price: number }>;
    }>;
    const plan = body[0];

    expect(plan.billingOptions).toHaveLength(2);
    expect(plan.billingOptions[0]).toMatchObject({ billingCycle: "MONTHLY", price: 499 });
  });

  it("returns plan with badgeText", async () => {
    mockPrisma.platformPlan.findMany.mockResolvedValue(MOCK_PLANS);

    const res = await GET();
    const body = (await res.json()) as Array<{ badgeText: string | null }>;

    expect(body[1].badgeText).toBe("Most Popular");
  });

  it("returns empty array when no plans exist", async () => {
    mockPrisma.platformPlan.findMany.mockResolvedValue([]);

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toEqual([]);
  });

  it("does not expose _count or subscriber counts", async () => {
    mockPrisma.platformPlan.findMany.mockResolvedValue(MOCK_PLANS);

    const res = await GET();
    const body = (await res.json()) as unknown[];

    expect(body[0]).not.toHaveProperty("_count");
    expect(body[0]).not.toHaveProperty("activeSubscribers");
  });

  it("returns 500 when prisma throws", async () => {
    mockPrisma.platformPlan.findMany.mockRejectedValue(new Error("DB error"));

    const res = await GET();

    expect(res.status).toBe(500);
  });
});
