import { NextRequest } from "next/server";

import { Prisma } from "@prisma/client";
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockRequireSuperAdmin = vi.hoisted(() => vi.fn());
const mockPrisma = vi.hoisted(() => ({
  subscriptionPayment: { findMany: vi.fn(), count: vi.fn() },
}));

vi.mock("@/lib/auth-guard", () => ({ requireSuperAdmin: mockRequireSuperAdmin }));
vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

import { GET } from "@/app/api/v1/super-admin/billing/payments/route";

const saOk = {
  data: { superAdminId: "sa-1", authUserId: "auth-sa-1", email: "sa@rwa.com" },
  error: null,
};

const mockPayment = {
  id: "pay-1",
  societyId: "soc-1",
  society: { id: "soc-1", name: "Greenwood Residency", societyCode: "GRNW" },
  amount: new Prisma.Decimal(5000),
  paymentMode: "UPI",
  referenceNo: "UPI123",
  invoiceNo: "INV-001",
  paymentDate: new Date("2026-03-01"),
  isReversal: false,
  isReversed: false,
  createdAt: new Date(),
};

function makeReq(query = "") {
  return new NextRequest(`http://localhost/api/v1/super-admin/billing/payments${query}`);
}

describe("GET /api/v1/super-admin/billing/payments", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireSuperAdmin.mockResolvedValue(saOk);
    mockPrisma.subscriptionPayment.findMany.mockResolvedValue([mockPayment]);
    mockPrisma.subscriptionPayment.count.mockResolvedValue(1);
  });

  it("returns 403 when not super admin", async () => {
    const forbiddenResponse = new Response(JSON.stringify({ error: { code: "FORBIDDEN" } }), {
      status: 403,
    });
    mockRequireSuperAdmin.mockResolvedValue({ data: null, error: forbiddenResponse });

    const res = await GET(makeReq());
    expect(res.status).toBe(403);
  });

  it("returns 200 with paginated payments", async () => {
    const res = await GET(makeReq());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.rows).toHaveLength(1);
    expect(body.total).toBe(1);
    expect(body.page).toBe(1);
    expect(body.limit).toBe(50);
    expect(body.rows[0].societyName).toBe("Greenwood Residency");
    expect(typeof body.rows[0].amount).toBe("number");
  });

  it("respects page and limit query params", async () => {
    mockPrisma.subscriptionPayment.count.mockResolvedValue(200);
    mockPrisma.subscriptionPayment.findMany.mockResolvedValue([]);

    const res = await GET(makeReq("?page=2&limit=10"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.page).toBe(2);
    expect(body.limit).toBe(10);
  });

  it("clamps limit to 100 maximum", async () => {
    const res = await GET(makeReq("?limit=999"));
    expect(res.status).toBe(200);
    expect(mockPrisma.subscriptionPayment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ take: 100 }),
    );
  });

  it("handles missing table error (P2021) gracefully — returns empty rows", async () => {
    const missingTableError = new Prisma.PrismaClientKnownRequestError("Missing table", {
      code: "P2021",
      clientVersion: "5.0.0",
    });
    mockPrisma.subscriptionPayment.findMany.mockRejectedValue(missingTableError);

    const res = await GET(makeReq());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.rows).toHaveLength(0);
    expect(body.total).toBe(0);
  });

  it("returns 500 when an unexpected DB error is thrown", async () => {
    mockPrisma.subscriptionPayment.findMany.mockRejectedValue(new Error("DB crash"));

    const res = await GET(makeReq());
    expect(res.status).toBe(500);
  });
});
