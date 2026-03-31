import { describe, it, expect, vi, beforeEach } from "vitest";

const mockRequireSuperAdmin = vi.hoisted(() => vi.fn());
const mockPrisma = vi.hoisted(() => ({
  societySubscription: { findMany: vi.fn(), count: vi.fn() },
  subscriptionPayment: { aggregate: vi.fn() },
  subscriptionInvoice: { count: vi.fn() },
}));

vi.mock("@/lib/auth-guard", () => ({ requireSuperAdmin: mockRequireSuperAdmin }));
vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

import { GET } from "@/app/api/v1/super-admin/stats/revenue/route";

const saOk = {
  data: { superAdminId: "sa-1", authUserId: "auth-1", email: "sa@rwa.com" },
  error: null,
};

describe("GET /api/v1/super-admin/stats/revenue", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireSuperAdmin.mockResolvedValue(saOk);
    mockPrisma.societySubscription.findMany.mockResolvedValue([]);
    mockPrisma.societySubscription.count.mockResolvedValue(0);
    mockPrisma.subscriptionPayment.aggregate.mockResolvedValue({ _sum: { amount: null } });
    mockPrisma.subscriptionInvoice.count.mockResolvedValue(0);
  });

  it("returns 403 when not super admin", async () => {
    const forbiddenResponse = new Response(JSON.stringify({ error: { code: "FORBIDDEN" } }), {
      status: 403,
    });
    mockRequireSuperAdmin.mockResolvedValue({ data: null, error: forbiddenResponse });

    const res = await GET();
    expect(res.status).toBe(403);
  });

  it("returns 200 with all revenue fields", async () => {
    mockPrisma.subscriptionPayment.aggregate.mockResolvedValue({ _sum: { amount: 50000 } });
    mockPrisma.subscriptionInvoice.count.mockResolvedValue(3);
    mockPrisma.societySubscription.count.mockResolvedValue(2);

    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("mrr");
    expect(body).toHaveProperty("totalRevenueThisMonth");
    expect(body).toHaveProperty("overdueCount");
    expect(body).toHaveProperty("expiring30d");
  });

  it("computes MRR correctly for MONTHLY billing", async () => {
    mockPrisma.societySubscription.findMany.mockResolvedValue([
      { finalPrice: "1000.00", billingOption: { billingCycle: "MONTHLY" } },
      { finalPrice: "2000.00", billingOption: { billingCycle: "MONTHLY" } },
    ]);

    const res = await GET();
    const body = await res.json();
    expect(body.mrr).toBe(3000); // 1000 + 2000
  });

  it("computes MRR correctly for ANNUAL billing", async () => {
    mockPrisma.societySubscription.findMany.mockResolvedValue([
      { finalPrice: "12000.00", billingOption: { billingCycle: "ANNUAL" } },
    ]);

    const res = await GET();
    const body = await res.json();
    expect(body.mrr).toBe(1000); // 12000 / 12
  });

  it("computes MRR correctly for TWO_YEAR billing", async () => {
    mockPrisma.societySubscription.findMany.mockResolvedValue([
      { finalPrice: "24000.00", billingOption: { billingCycle: "TWO_YEAR" } },
    ]);

    const res = await GET();
    const body = await res.json();
    expect(body.mrr).toBe(1000); // 24000 / 24
  });

  it("computes MRR correctly for THREE_YEAR billing", async () => {
    mockPrisma.societySubscription.findMany.mockResolvedValue([
      { finalPrice: "36000.00", billingOption: { billingCycle: "THREE_YEAR" } },
    ]);

    const res = await GET();
    const body = await res.json();
    expect(body.mrr).toBe(1000); // 36000 / 36
  });

  it("skips subs with null finalPrice in MRR", async () => {
    mockPrisma.societySubscription.findMany.mockResolvedValue([
      { finalPrice: null, billingOption: { billingCycle: "MONTHLY" } },
      { finalPrice: "500.00", billingOption: { billingCycle: "MONTHLY" } },
    ]);

    const res = await GET();
    const body = await res.json();
    expect(body.mrr).toBe(500);
  });

  it("skips subs with null billingOption in MRR", async () => {
    mockPrisma.societySubscription.findMany.mockResolvedValue([
      { finalPrice: "1000.00", billingOption: null },
    ]);

    const res = await GET();
    const body = await res.json();
    expect(body.mrr).toBe(0);
  });

  it("returns 0 totalRevenueThisMonth when aggregate sum is null", async () => {
    mockPrisma.subscriptionPayment.aggregate.mockResolvedValue({ _sum: { amount: null } });

    const res = await GET();
    const body = await res.json();
    expect(body.totalRevenueThisMonth).toBe(0);
  });

  it("returns correct totalRevenueThisMonth", async () => {
    mockPrisma.subscriptionPayment.aggregate.mockResolvedValue({ _sum: { amount: 75000 } });

    const res = await GET();
    const body = await res.json();
    expect(body.totalRevenueThisMonth).toBe(75000);
  });

  it("returns overdue count and expiring30d", async () => {
    mockPrisma.subscriptionInvoice.count.mockResolvedValue(5);
    mockPrisma.societySubscription.count.mockResolvedValue(3);

    const res = await GET();
    const body = await res.json();
    expect(body.overdueCount).toBe(5);
    expect(body.expiring30d).toBe(3);
  });

  it("returns 500 on DB error", async () => {
    mockPrisma.societySubscription.findMany.mockRejectedValue(new Error("DB error"));

    const res = await GET();
    expect(res.status).toBe(500);
  });
});
