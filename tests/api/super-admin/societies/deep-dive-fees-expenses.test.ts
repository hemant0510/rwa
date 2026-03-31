import { NextRequest } from "next/server";

import { describe, it, expect, vi, beforeEach } from "vitest";

const mockRequireSuperAdmin = vi.hoisted(() => vi.fn());
const mockGetSessionYear = vi.hoisted(() => vi.fn().mockReturnValue("2025-26"));
const mockPrisma = vi.hoisted(() => ({
  membershipFee: {
    findMany: vi.fn(),
    aggregate: vi.fn(),
    groupBy: vi.fn(),
  },
  expense: {
    findMany: vi.fn(),
    count: vi.fn(),
    aggregate: vi.fn(),
    groupBy: vi.fn(),
  },
}));

vi.mock("@/lib/auth-guard", () => ({ requireSuperAdmin: mockRequireSuperAdmin }));
vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/fee-calculator", () => ({ getSessionYear: mockGetSessionYear }));

import { GET as GET_EXPENSES } from "@/app/api/v1/super-admin/societies/[id]/expenses/route";
import { GET as GET_EXPENSES_SUMMARY } from "@/app/api/v1/super-admin/societies/[id]/expenses/summary/route";
import { GET as GET_FEES } from "@/app/api/v1/super-admin/societies/[id]/fees/route";
import { GET as GET_FEES_SUMMARY } from "@/app/api/v1/super-admin/societies/[id]/fees/summary/route";

const saOk = {
  data: { superAdminId: "sa-1", authUserId: "auth-1", email: "admin@superadmin.com" },
  error: null,
};

const mockFee = {
  id: "fee-1",
  userId: "user-1",
  sessionYear: "2025-26",
  status: "PAID",
  amountDue: 5000,
  amountPaid: 5000,
  user: {
    id: "user-1",
    name: "John Doe",
    mobile: "9876543210",
    rwaid: "RWA-001",
    ownershipType: "OWNER",
  },
  unit: { displayLabel: "A-101" },
  feePayments: [],
};

const mockExpense = {
  id: "exp-1",
  category: "MAINTENANCE",
  amount: 1000,
  date: new Date("2026-01-15"),
  status: "ACTIVE",
  eventId: null,
  logger: { name: "Admin" },
  event: null,
};

function makeReq(path: string, query = "") {
  return new NextRequest(`http://localhost${path}${query}`);
}

// ---------------------------------------------------------------------------
// GET /fees
// ---------------------------------------------------------------------------
describe("GET /api/v1/super-admin/societies/[id]/fees", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireSuperAdmin.mockResolvedValue(saOk);
    mockPrisma.membershipFee.findMany.mockResolvedValue([mockFee]);
  });

  it("returns 403 when not super admin", async () => {
    mockRequireSuperAdmin.mockResolvedValue({
      data: null,
      error: new Response(JSON.stringify({ error: { code: "FORBIDDEN" } }), { status: 403 }),
    });
    const res = await GET_FEES(makeReq("/api/v1/super-admin/societies/soc-1/fees"), {
      params: Promise.resolve({ id: "soc-1" }),
    });
    expect(res.status).toBe(403);
  });

  it("returns fee collection data for default session", async () => {
    const res = await GET_FEES(makeReq("/api/v1/super-admin/societies/soc-1/fees"), {
      params: Promise.resolve({ id: "soc-1" }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.sessionYear).toBe("2025-26");
    expect(body.totalResidents).toBe(1);
    expect(body.totalDue).toBe(5000);
    expect(body.totalCollected).toBe(5000);
    expect(body.totalOutstanding).toBe(0);
    expect(body.collectionRate).toBe(100);
    expect(body.fees).toHaveLength(1);
    expect(body.fees[0].id).toBe("fee-1");
    expect(body.fees[0].unit).toBe("A-101");
    expect(body.fees[0].balance).toBe(0);
    expect(body.stats).toEqual([{ status: "PAID", _count: 1 }]);
    expect(mockPrisma.membershipFee.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { societyId: "soc-1", sessionYear: "2025-26" },
      }),
    );
  });

  it("uses session query param when provided", async () => {
    const res = await GET_FEES(
      makeReq("/api/v1/super-admin/societies/soc-1/fees", "?session=2024-25"),
      { params: Promise.resolve({ id: "soc-1" }) },
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.sessionYear).toBe("2024-25");
    expect(mockPrisma.membershipFee.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { societyId: "soc-1", sessionYear: "2024-25" },
      }),
    );
  });

  it("returns 500 on DB error", async () => {
    mockPrisma.membershipFee.findMany.mockRejectedValue(new Error("DB error"));
    const res = await GET_FEES(makeReq("/api/v1/super-admin/societies/soc-1/fees"), {
      params: Promise.resolve({ id: "soc-1" }),
    });
    expect(res.status).toBe(500);
  });
});

// ---------------------------------------------------------------------------
// GET /fees/summary
// ---------------------------------------------------------------------------
describe("GET /api/v1/super-admin/societies/[id]/fees/summary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireSuperAdmin.mockResolvedValue(saOk);
    mockPrisma.membershipFee.aggregate.mockResolvedValue({
      _sum: { amountDue: 5000, amountPaid: 5000 },
      _count: 1,
    });
    mockPrisma.membershipFee.groupBy.mockResolvedValue([
      { status: "PAID", _count: 1, _sum: { amountDue: 5000, amountPaid: 5000 } },
    ]);
  });

  it("returns 403 when not super admin", async () => {
    mockRequireSuperAdmin.mockResolvedValue({
      data: null,
      error: new Response(JSON.stringify({ error: { code: "FORBIDDEN" } }), { status: 403 }),
    });
    const res = await GET_FEES_SUMMARY(
      makeReq("/api/v1/super-admin/societies/soc-1/fees/summary"),
      { params: Promise.resolve({ id: "soc-1" }) },
    );
    expect(res.status).toBe(403);
  });

  it("returns fee summary with status breakdown", async () => {
    const res = await GET_FEES_SUMMARY(
      makeReq("/api/v1/super-admin/societies/soc-1/fees/summary"),
      { params: Promise.resolve({ id: "soc-1" }) },
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.sessionYear).toBe("2025-26");
    expect(body.totalResidents).toBe(1);
    expect(body.totalDue).toBe(5000);
    expect(body.totalCollected).toBe(5000);
    expect(body.totalOutstanding).toBe(0);
    expect(body.collectionRate).toBe(100);
    expect(body.statusBreakdown).toHaveLength(1);
    expect(body.statusBreakdown[0]).toEqual({
      status: "PAID",
      count: 1,
      amountDue: 5000,
      amountPaid: 5000,
    });
  });

  it("returns 500 on DB error", async () => {
    mockPrisma.membershipFee.aggregate.mockRejectedValue(new Error("DB error"));
    const res = await GET_FEES_SUMMARY(
      makeReq("/api/v1/super-admin/societies/soc-1/fees/summary"),
      { params: Promise.resolve({ id: "soc-1" }) },
    );
    expect(res.status).toBe(500);
  });
});

// ---------------------------------------------------------------------------
// GET /expenses
// ---------------------------------------------------------------------------
describe("GET /api/v1/super-admin/societies/[id]/expenses", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireSuperAdmin.mockResolvedValue(saOk);
    mockPrisma.expense.findMany.mockResolvedValue([mockExpense]);
    mockPrisma.expense.count.mockResolvedValue(1);
  });

  it("returns 403 when not super admin", async () => {
    mockRequireSuperAdmin.mockResolvedValue({
      data: null,
      error: new Response(JSON.stringify({ error: { code: "FORBIDDEN" } }), { status: 403 }),
    });
    const res = await GET_EXPENSES(makeReq("/api/v1/super-admin/societies/soc-1/expenses"), {
      params: Promise.resolve({ id: "soc-1" }),
    });
    expect(res.status).toBe(403);
  });

  it("returns paginated expenses with defaults", async () => {
    const res = await GET_EXPENSES(makeReq("/api/v1/super-admin/societies/soc-1/expenses"), {
      params: Promise.resolve({ id: "soc-1" }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toHaveLength(1);
    expect(body.data[0].id).toBe("exp-1");
    expect(body.total).toBe(1);
    expect(body.page).toBe(1);
    expect(body.limit).toBe(20);
    expect(mockPrisma.expense.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { societyId: "soc-1" },
        skip: 0,
        take: 20,
      }),
    );
  });

  it("filters by category", async () => {
    const res = await GET_EXPENSES(
      makeReq("/api/v1/super-admin/societies/soc-1/expenses", "?category=MAINTENANCE"),
      { params: Promise.resolve({ id: "soc-1" }) },
    );
    expect(res.status).toBe(200);
    expect(mockPrisma.expense.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { societyId: "soc-1", category: "MAINTENANCE" },
      }),
    );
  });

  it("filters by scope=general (sets eventId: null)", async () => {
    const res = await GET_EXPENSES(
      makeReq("/api/v1/super-admin/societies/soc-1/expenses", "?scope=general"),
      { params: Promise.resolve({ id: "soc-1" }) },
    );
    expect(res.status).toBe(200);
    expect(mockPrisma.expense.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { societyId: "soc-1", eventId: null },
      }),
    );
  });

  it("filters by scope=event (sets eventId: { not: null })", async () => {
    const res = await GET_EXPENSES(
      makeReq("/api/v1/super-admin/societies/soc-1/expenses", "?scope=event"),
      { params: Promise.resolve({ id: "soc-1" }) },
    );
    expect(res.status).toBe(200);
    expect(mockPrisma.expense.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { societyId: "soc-1", eventId: { not: null } },
      }),
    );
  });

  it("filters by date range (from + to)", async () => {
    const res = await GET_EXPENSES(
      makeReq("/api/v1/super-admin/societies/soc-1/expenses", "?from=2026-01-01&to=2026-01-31"),
      { params: Promise.resolve({ id: "soc-1" }) },
    );
    expect(res.status).toBe(200);
    expect(mockPrisma.expense.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          societyId: "soc-1",
          date: {
            gte: new Date("2026-01-01"),
            lte: new Date("2026-01-31"),
          },
        }),
      }),
    );
  });

  it("returns 500 on DB error", async () => {
    mockPrisma.expense.findMany.mockRejectedValue(new Error("DB error"));
    const res = await GET_EXPENSES(makeReq("/api/v1/super-admin/societies/soc-1/expenses"), {
      params: Promise.resolve({ id: "soc-1" }),
    });
    expect(res.status).toBe(500);
  });
});

// ---------------------------------------------------------------------------
// GET /expenses/summary
// ---------------------------------------------------------------------------
describe("GET /api/v1/super-admin/societies/[id]/expenses/summary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireSuperAdmin.mockResolvedValue(saOk);
    mockPrisma.expense.groupBy.mockResolvedValue([
      { category: "MAINTENANCE", _sum: { amount: 1000 }, _count: 1 },
    ]);
    mockPrisma.expense.aggregate.mockResolvedValue({ _sum: { amount: 1000 } });
    mockPrisma.membershipFee.aggregate.mockResolvedValue({ _sum: { amountPaid: 5000 } });
  });

  it("returns 403 when not super admin", async () => {
    mockRequireSuperAdmin.mockResolvedValue({
      data: null,
      error: new Response(JSON.stringify({ error: { code: "FORBIDDEN" } }), { status: 403 }),
    });
    const res = await GET_EXPENSES_SUMMARY(
      makeReq("/api/v1/super-admin/societies/soc-1/expenses/summary"),
      { params: Promise.resolve({ id: "soc-1" }) },
    );
    expect(res.status).toBe(403);
  });

  it("returns expense summary with category breakdown", async () => {
    const res = await GET_EXPENSES_SUMMARY(
      makeReq("/api/v1/super-admin/societies/soc-1/expenses/summary"),
      { params: Promise.resolve({ id: "soc-1" }) },
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.totalExpenses).toBe(1000);
    expect(body.totalCollected).toBe(5000);
    expect(body.balanceInHand).toBe(4000);
    expect(body.categoryBreakdown).toHaveLength(1);
    expect(body.categoryBreakdown[0]).toEqual({
      category: "MAINTENANCE",
      total: 1000,
      count: 1,
      percentage: 100,
    });
  });

  it("returns zero percentages when total expenses is 0", async () => {
    mockPrisma.expense.aggregate.mockResolvedValue({ _sum: { amount: 0 } });
    const res = await GET_EXPENSES_SUMMARY(
      makeReq("/api/v1/super-admin/societies/soc-1/expenses/summary"),
      { params: Promise.resolve({ id: "soc-1" }) },
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.totalExpenses).toBe(0);
    expect(body.categoryBreakdown[0].percentage).toBe(0);
  });

  it("returns 500 on DB error", async () => {
    mockPrisma.expense.groupBy.mockRejectedValue(new Error("DB error"));
    const res = await GET_EXPENSES_SUMMARY(
      makeReq("/api/v1/super-admin/societies/soc-1/expenses/summary"),
      { params: Promise.resolve({ id: "soc-1" }) },
    );
    expect(res.status).toBe(500);
  });
});
