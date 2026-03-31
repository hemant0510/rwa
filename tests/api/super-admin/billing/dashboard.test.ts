import { Prisma } from "@prisma/client";
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockRequireSuperAdmin = vi.hoisted(() => vi.fn());
const mockPrisma = vi.hoisted(() => ({
  societySubscription: { count: vi.fn() },
  subscriptionPayment: { aggregate: vi.fn() },
  subscriptionInvoice: { count: vi.fn() },
}));

vi.mock("@/lib/auth-guard", () => ({ requireSuperAdmin: mockRequireSuperAdmin }));
vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

import { GET } from "@/app/api/v1/super-admin/billing/dashboard/route";

const saOk = {
  data: { superAdminId: "sa-1", authUserId: "auth-sa-1", email: "sa@rwa.com" },
  error: null,
};

describe("GET /api/v1/super-admin/billing/dashboard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireSuperAdmin.mockResolvedValue(saOk);
  });

  it("returns 403 when not super admin", async () => {
    const forbiddenResponse = new Response(JSON.stringify({ error: { code: "FORBIDDEN" } }), {
      status: 403,
    });
    mockRequireSuperAdmin.mockResolvedValue({ data: null, error: forbiddenResponse });

    const res = await GET({} as never);
    expect(res.status).toBe(403);
  });

  it("returns 200 with all dashboard fields", async () => {
    mockPrisma.societySubscription.count
      .mockResolvedValueOnce(20) // totalActive
      .mockResolvedValueOnce(3) // expiringSoon
      .mockResolvedValueOnce(5) // expired
      .mockResolvedValueOnce(2); // trialEnding
    mockPrisma.subscriptionPayment.aggregate.mockResolvedValue({ _sum: { amount: 150000 } });
    mockPrisma.subscriptionInvoice.count.mockResolvedValue(4);

    const res = await GET({} as never);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.totalActive).toBe(20);
    expect(body.expiringSoon).toBe(3);
    expect(body.expired).toBe(5);
    expect(body.trialEnding).toBe(2);
    expect(body.revenueThisMonth).toBe(150000);
    expect(body.pendingInvoices).toBe(4);
  });

  it("returns 0 revenue when aggregate sum is null", async () => {
    mockPrisma.societySubscription.count.mockResolvedValue(0);
    mockPrisma.subscriptionPayment.aggregate.mockResolvedValue({ _sum: { amount: null } });
    mockPrisma.subscriptionInvoice.count.mockResolvedValue(0);

    const res = await GET({} as never);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.revenueThisMonth).toBe(0);
  });

  it("handles missing table error (P2021) gracefully — revenue/invoices default to 0", async () => {
    mockPrisma.societySubscription.count.mockResolvedValue(10);
    const missingTableError = new Prisma.PrismaClientKnownRequestError("Missing table", {
      code: "P2021",
      clientVersion: "5.0.0",
    });
    mockPrisma.subscriptionPayment.aggregate.mockRejectedValue(missingTableError);

    const res = await GET({} as never);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.revenueThisMonth).toBe(0);
    expect(body.pendingInvoices).toBe(0);
  });

  it("returns 500 when societySubscription.count throws", async () => {
    mockPrisma.societySubscription.count.mockRejectedValue(new Error("DB error"));

    const res = await GET({} as never);
    expect(res.status).toBe(500);
  });
});
