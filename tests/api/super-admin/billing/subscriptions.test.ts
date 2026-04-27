import { NextRequest } from "next/server";

import { Prisma } from "@prisma/client";
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockRequireSuperAdmin = vi.hoisted(() => vi.fn());
const mockPrisma = vi.hoisted(() => ({
  societySubscription: { findMany: vi.fn() },
  subscriptionPayment: { findMany: vi.fn() },
  subscriptionInvoice: { findMany: vi.fn() },
}));

vi.mock("@/lib/auth-guard", () => ({ requireSuperAdmin: mockRequireSuperAdmin }));
vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

import { GET } from "@/app/api/v1/super-admin/billing/subscriptions/route";

const saOk = {
  data: { superAdminId: "sa-1", authUserId: "auth-sa-1", email: "sa@rwa.com" },
  error: null,
};

const mockSubscription = {
  id: "sub-1",
  societyId: "soc-1",
  society: {
    id: "soc-1",
    name: "Greenwood Residency",
    societyCode: "GRNW",
    subscriptionExpiresAt: new Date("2026-12-31"),
  },
  plan: { id: "plan-1", name: "Community" },
  billingOption: { billingCycle: "ANNUAL", price: new Prisma.Decimal(12000) },
  status: "ACTIVE",
  currentPeriodEnd: new Date("2026-12-31"),
};

function makeReq(query = "") {
  return new NextRequest(`http://localhost/api/v1/super-admin/billing/subscriptions${query}`);
}

describe("GET /api/v1/super-admin/billing/subscriptions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireSuperAdmin.mockResolvedValue(saOk);
    mockPrisma.societySubscription.findMany.mockResolvedValue([mockSubscription]);
    mockPrisma.subscriptionPayment.findMany.mockResolvedValue([]);
    mockPrisma.subscriptionInvoice.findMany.mockResolvedValue([]);
  });

  it("returns 403 when not super admin", async () => {
    const forbiddenResponse = new Response(JSON.stringify({ error: { code: "FORBIDDEN" } }), {
      status: 403,
    });
    mockRequireSuperAdmin.mockResolvedValue({ data: null, error: forbiddenResponse });

    const res = await GET(makeReq());
    expect(res.status).toBe(403);
  });

  it("returns 200 with subscription list", async () => {
    const res = await GET(makeReq());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveLength(1);
    expect(body[0].societyName).toBe("Greenwood Residency");
    expect(body[0].planName).toBe("Community");
    expect(body[0].billingCycle).toBe("ANNUAL");
    expect(body[0].status).toBe("ACTIVE");
  });

  it("filters by status param", async () => {
    await GET(makeReq("?status=TRIAL"));
    expect(mockPrisma.societySubscription.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ status: "TRIAL" }) }),
    );
  });

  it("does not apply status filter when status=all", async () => {
    await GET(makeReq("?status=all"));
    const call = mockPrisma.societySubscription.findMany.mock.calls[0][0];
    expect(call.where).not.toHaveProperty("status");
  });

  it("applies expiryRange=expired filter", async () => {
    await GET(makeReq("?expiryRange=expired"));
    const call = mockPrisma.societySubscription.findMany.mock.calls[0][0];
    expect(call.where).toHaveProperty("currentPeriodEnd");
  });

  it("applies numeric expiryRange filter", async () => {
    await GET(makeReq("?expiryRange=30"));
    const call = mockPrisma.societySubscription.findMany.mock.calls[0][0];
    expect(call.where).toHaveProperty("currentPeriodEnd");
  });

  it("applies sortBy=name", async () => {
    await GET(makeReq("?sortBy=name&sortOrder=asc"));
    const call = mockPrisma.societySubscription.findMany.mock.calls[0][0];
    expect(call.orderBy).toEqual({ society: { name: "asc" } });
  });

  it("applies sortBy=plan", async () => {
    await GET(makeReq("?sortBy=plan"));
    const call = mockPrisma.societySubscription.findMany.mock.calls[0][0];
    expect(call.orderBy).toEqual({ plan: { name: "desc" } });
  });

  it("defaults to expiry sort", async () => {
    await GET(makeReq());
    const call = mockPrisma.societySubscription.findMany.mock.calls[0][0];
    expect(call.orderBy).toEqual({ currentPeriodEnd: "desc" });
  });

  it("returns 'Trial' for plan when plan is null", async () => {
    mockPrisma.societySubscription.findMany.mockResolvedValue([
      { ...mockSubscription, plan: null, billingOption: null },
    ]);

    const res = await GET(makeReq());
    const body = await res.json();
    expect(body[0].planName).toBe("Trial");
    expect(body[0].billingCycle).toBeNull();
  });

  it("attaches last payment and amount due from joins", async () => {
    mockPrisma.subscriptionPayment.findMany.mockResolvedValue([
      {
        societyId: "soc-1",
        paymentDate: new Date("2026-02-01"),
        amount: new Prisma.Decimal(6000),
      },
    ]);
    mockPrisma.subscriptionInvoice.findMany.mockResolvedValue([
      { societyId: "soc-1", finalAmount: new Prisma.Decimal(6000) },
    ]);

    const res = await GET(makeReq());
    const body = await res.json();
    expect(body[0].lastPaymentAmount).toBe(6000);
    expect(body[0].amountDue).toBe(6000);
  });

  it("handles missing table error (P2021) for payment/invoice queries gracefully", async () => {
    const missingTableError = new Prisma.PrismaClientKnownRequestError("Missing table", {
      code: "P2021",
      clientVersion: "5.0.0",
    });
    mockPrisma.subscriptionPayment.findMany.mockRejectedValue(missingTableError);

    const res = await GET(makeReq());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body[0].lastPaymentAmount).toBeNull();
    expect(body[0].amountDue).toBe(0);
  });

  it("returns 500 on unexpected DB error", async () => {
    mockPrisma.societySubscription.findMany.mockRejectedValue(new Error("DB crash"));

    const res = await GET(makeReq());
    expect(res.status).toBe(500);
  });
});
