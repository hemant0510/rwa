import { NextRequest } from "next/server";

import { Prisma } from "@prisma/client";
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockRequireSuperAdmin = vi.hoisted(() => vi.fn());
const mockPrisma = vi.hoisted(() => ({
  subscriptionInvoice: { findMany: vi.fn(), count: vi.fn() },
}));

vi.mock("@/lib/auth-guard", () => ({ requireSuperAdmin: mockRequireSuperAdmin }));
vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

import { GET } from "@/app/api/v1/super-admin/billing/invoices/route";

const saOk = {
  data: { superAdminId: "sa-1", authUserId: "auth-sa-1", email: "sa@rwa.com" },
  error: null,
};

const mockInvoice = {
  id: "inv-1",
  societyId: "soc-1",
  society: { id: "soc-1", name: "Eden Estate", societyCode: "EDEN" },
  invoiceNo: "INV-2026-001",
  planName: "Community",
  billingCycle: "ANNUAL",
  periodStart: new Date("2026-01-01"),
  periodEnd: new Date("2026-12-31"),
  baseAmount: new Prisma.Decimal(12000),
  discountAmount: new Prisma.Decimal(0),
  finalAmount: new Prisma.Decimal(12000),
  payments: [{ amount: new Prisma.Decimal(6000) }],
  status: "PARTIALLY_PAID",
  dueDate: new Date("2026-02-01"),
  createdAt: new Date(),
};

function makeReq(query = "") {
  return new NextRequest(`http://localhost/api/v1/super-admin/billing/invoices${query}`);
}

describe("GET /api/v1/super-admin/billing/invoices", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireSuperAdmin.mockResolvedValue(saOk);
    mockPrisma.subscriptionInvoice.findMany.mockResolvedValue([mockInvoice]);
    mockPrisma.subscriptionInvoice.count.mockResolvedValue(1);
  });

  it("returns 403 when not super admin", async () => {
    const forbiddenResponse = new Response(JSON.stringify({ error: { code: "FORBIDDEN" } }), {
      status: 403,
    });
    mockRequireSuperAdmin.mockResolvedValue({ data: null, error: forbiddenResponse });

    const res = await GET(makeReq());
    expect(res.status).toBe(403);
  });

  it("returns 200 with paginated invoices", async () => {
    const res = await GET(makeReq());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.rows).toHaveLength(1);
    expect(body.total).toBe(1);
    expect(body.page).toBe(1);
    expect(body.limit).toBe(50);
    expect(body.rows[0].societyName).toBe("Eden Estate");
    expect(body.rows[0].paidAmount).toBe(6000);
    expect(typeof body.rows[0].baseAmount).toBe("number");
  });

  it("applies status filter when provided", async () => {
    mockPrisma.subscriptionInvoice.findMany.mockResolvedValue([]);
    mockPrisma.subscriptionInvoice.count.mockResolvedValue(0);

    await GET(makeReq("?status=OVERDUE"));

    expect(mockPrisma.subscriptionInvoice.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ status: "OVERDUE" }) }),
    );
  });

  it("does not apply status filter when status=all", async () => {
    await GET(makeReq("?status=all"));

    expect(mockPrisma.subscriptionInvoice.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: {} }),
    );
  });

  it("respects page and limit query params", async () => {
    mockPrisma.subscriptionInvoice.count.mockResolvedValue(200);
    mockPrisma.subscriptionInvoice.findMany.mockResolvedValue([]);

    const res = await GET(makeReq("?page=3&limit=20"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.page).toBe(3);
    expect(body.limit).toBe(20);
  });

  it("handles missing table error (P2021) gracefully — returns empty rows", async () => {
    const missingTableError = new Prisma.PrismaClientKnownRequestError("Missing table", {
      code: "P2021",
      clientVersion: "5.0.0",
    });
    mockPrisma.subscriptionInvoice.findMany.mockRejectedValue(missingTableError);

    const res = await GET(makeReq());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.rows).toHaveLength(0);
    expect(body.total).toBe(0);
  });

  it("returns 500 on unexpected DB error", async () => {
    mockPrisma.subscriptionInvoice.findMany.mockRejectedValue(new Error("DB crash"));

    const res = await GET(makeReq());
    expect(res.status).toBe(500);
  });
});
