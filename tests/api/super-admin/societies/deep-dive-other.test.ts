import { NextRequest } from "next/server";

import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Hoisted mocks — must be declared before any imports that use them
// ---------------------------------------------------------------------------
const mockRequireSuperAdmin = vi.hoisted(() => vi.fn());
const mockGetSessionYear = vi.hoisted(() => vi.fn().mockReturnValue("2025-26"));
const mockPrisma = vi.hoisted(() => ({
  broadcast: { findMany: vi.fn(), count: vi.fn() },
  governingBodyMember: { findMany: vi.fn() },
  designation: { findMany: vi.fn() },
  migrationBatch: { findMany: vi.fn(), count: vi.fn() },
  society: { findUnique: vi.fn() },
  feeSession: { findMany: vi.fn() },
  societySubscription: { findFirst: vi.fn() },
  membershipFee: { aggregate: vi.fn() },
  expense: { aggregate: vi.fn(), groupBy: vi.fn() },
}));

vi.mock("@/lib/auth-guard", () => ({ requireSuperAdmin: mockRequireSuperAdmin }));
vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/fee-calculator", () => ({ getSessionYear: mockGetSessionYear }));

// ---------------------------------------------------------------------------
// Route imports (after mocks)
// ---------------------------------------------------------------------------
import { GET as GET_BROADCASTS } from "@/app/api/v1/super-admin/societies/[id]/broadcasts/route";
import { GET as GET_GOVERNING_BODY } from "@/app/api/v1/super-admin/societies/[id]/governing-body/route";
import { GET as GET_MIGRATIONS } from "@/app/api/v1/super-admin/societies/[id]/migrations/route";
import { GET as GET_REPORTS } from "@/app/api/v1/super-admin/societies/[id]/reports/[type]/route";
import { GET as GET_SETTINGS } from "@/app/api/v1/super-admin/societies/[id]/settings/route";

// ---------------------------------------------------------------------------
// Shared auth fixtures
// ---------------------------------------------------------------------------
const saOk = {
  data: { superAdminId: "sa-1", authUserId: "auth-1", email: "admin@superadmin.com" },
  error: null,
};

const saForbidden = {
  data: null,
  error: new Response(JSON.stringify({ error: { code: "FORBIDDEN" } }), { status: 403 }),
};

// ---------------------------------------------------------------------------
// Sample data
// ---------------------------------------------------------------------------
const mockBroadcast = {
  id: "bc-1",
  societyId: "soc-1",
  message: "Test broadcast message",
  recipientFilter: "ALL_ACTIVE",
  recipientCount: 50,
  sentAt: new Date("2026-03-01"),
  sender: { name: "Admin" },
};

const mockMember = {
  id: "gbm-1",
  userId: "user-1",
  societyId: "soc-1",
  designationId: "des-1",
  assignedAt: new Date("2026-01-01"),
  user: { id: "user-1", name: "John Doe", email: "john@example.com", mobile: "9876543210" },
  designation: { id: "des-1", name: "Chairperson" },
};

const mockDesignation = { id: "des-1", name: "Chairperson", sortOrder: 1 };

const mockBatch = {
  id: "batch-1",
  societyId: "soc-1",
  totalRows: 100,
  validRows: 95,
  errorRows: 5,
  importedRows: 95,
  status: "COMPLETED",
  createdAt: new Date("2026-01-01"),
  completedAt: new Date("2026-01-01"),
  uploader: { name: "Admin" },
  rows: [],
};

const mockSociety = {
  id: "soc-1",
  name: "Greenwood Residency",
  societyCode: "EDEN001",
  type: "RESIDENTIAL",
  state: "Maharashtra",
  city: "Mumbai",
  pincode: "400001",
  emailVerificationRequired: true,
  joiningFee: 500,
  annualFee: 2000,
  gracePeriodDays: 30,
  feeSessionStartMonth: 4,
};

const mockSubscription = {
  id: "sub-1",
  status: "ACTIVE",
  currentPeriodEnd: new Date("2027-01-01"),
  plan: { id: "plan-1", name: "Basic", price: 999 },
};

// ---------------------------------------------------------------------------
// Helper
// ---------------------------------------------------------------------------
function makeReq(url: string) {
  return new NextRequest(url);
}

// ===========================================================================
// GET_BROADCASTS
// ===========================================================================
describe("GET /api/v1/super-admin/societies/[id]/broadcasts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireSuperAdmin.mockResolvedValue(saOk);
    mockPrisma.broadcast.findMany.mockResolvedValue([mockBroadcast]);
    mockPrisma.broadcast.count.mockResolvedValue(1);
  });

  it("returns 403 when not super admin", async () => {
    mockRequireSuperAdmin.mockResolvedValue(saForbidden);
    const res = await GET_BROADCASTS(
      makeReq("http://localhost/api/v1/super-admin/societies/soc-1/broadcasts"),
      { params: Promise.resolve({ id: "soc-1" }) },
    );
    expect(res.status).toBe(403);
  });

  it("returns paginated broadcasts", async () => {
    const res = await GET_BROADCASTS(
      makeReq("http://localhost/api/v1/super-admin/societies/soc-1/broadcasts?page=1&limit=20"),
      { params: Promise.resolve({ id: "soc-1" }) },
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toHaveLength(1);
    expect(body.data[0].id).toBe("bc-1");
    expect(body.total).toBe(1);
    expect(body.page).toBe(1);
    expect(body.limit).toBe(20);
    expect(mockPrisma.broadcast.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { societyId: "soc-1" },
        skip: 0,
        take: 20,
      }),
    );
    expect(mockPrisma.broadcast.count).toHaveBeenCalledWith({ where: { societyId: "soc-1" } });
  });

  it("returns 500 on DB error", async () => {
    mockPrisma.broadcast.findMany.mockRejectedValue(new Error("DB error"));
    const res = await GET_BROADCASTS(
      makeReq("http://localhost/api/v1/super-admin/societies/soc-1/broadcasts"),
      { params: Promise.resolve({ id: "soc-1" }) },
    );
    expect(res.status).toBe(500);
  });
});

// ===========================================================================
// GET_GOVERNING_BODY
// ===========================================================================
describe("GET /api/v1/super-admin/societies/[id]/governing-body", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireSuperAdmin.mockResolvedValue(saOk);
    mockPrisma.governingBodyMember.findMany.mockResolvedValue([mockMember]);
    mockPrisma.designation.findMany.mockResolvedValue([mockDesignation]);
  });

  it("returns 403 when not super admin", async () => {
    mockRequireSuperAdmin.mockResolvedValue(saForbidden);
    const res = await GET_GOVERNING_BODY(
      makeReq("http://localhost/api/v1/super-admin/societies/soc-1/governing-body"),
      { params: Promise.resolve({ id: "soc-1" }) },
    );
    expect(res.status).toBe(403);
  });

  it("returns members and designations", async () => {
    const res = await GET_GOVERNING_BODY(
      makeReq("http://localhost/api/v1/super-admin/societies/soc-1/governing-body"),
      { params: Promise.resolve({ id: "soc-1" }) },
    );
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.members).toHaveLength(1);
    expect(body.members[0]).toMatchObject({
      id: "gbm-1",
      userId: "user-1",
      name: "John Doe",
      email: "john@example.com",
      mobile: "9876543210",
      designation: "Chairperson",
      designationId: "des-1",
    });

    expect(body.designations).toHaveLength(1);
    expect(body.designations[0]).toMatchObject({
      id: "des-1",
      name: "Chairperson",
      sortOrder: 1,
    });

    expect(mockPrisma.governingBodyMember.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { societyId: "soc-1" } }),
    );
    expect(mockPrisma.designation.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { societyId: "soc-1" } }),
    );
  });

  it("returns 500 on DB error", async () => {
    mockPrisma.governingBodyMember.findMany.mockRejectedValue(new Error("DB error"));
    const res = await GET_GOVERNING_BODY(
      makeReq("http://localhost/api/v1/super-admin/societies/soc-1/governing-body"),
      { params: Promise.resolve({ id: "soc-1" }) },
    );
    expect(res.status).toBe(500);
  });
});

// ===========================================================================
// GET_MIGRATIONS
// ===========================================================================
describe("GET /api/v1/super-admin/societies/[id]/migrations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireSuperAdmin.mockResolvedValue(saOk);
    mockPrisma.migrationBatch.findMany.mockResolvedValue([mockBatch]);
    mockPrisma.migrationBatch.count.mockResolvedValue(1);
  });

  it("returns 403 when not super admin", async () => {
    mockRequireSuperAdmin.mockResolvedValue(saForbidden);
    const res = await GET_MIGRATIONS(
      makeReq("http://localhost/api/v1/super-admin/societies/soc-1/migrations"),
      { params: Promise.resolve({ id: "soc-1" }) },
    );
    expect(res.status).toBe(403);
  });

  it("returns paginated migration batches", async () => {
    const res = await GET_MIGRATIONS(
      makeReq("http://localhost/api/v1/super-admin/societies/soc-1/migrations?page=2&limit=10"),
      { params: Promise.resolve({ id: "soc-1" }) },
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toHaveLength(1);
    expect(body.data[0].id).toBe("batch-1");
    expect(body.total).toBe(1);
    expect(body.page).toBe(2);
    expect(body.limit).toBe(10);
    expect(mockPrisma.migrationBatch.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { societyId: "soc-1" },
        skip: 10,
        take: 10,
      }),
    );
    expect(mockPrisma.migrationBatch.count).toHaveBeenCalledWith({ where: { societyId: "soc-1" } });
  });

  it("returns 500 on DB error", async () => {
    mockPrisma.migrationBatch.findMany.mockRejectedValue(new Error("DB error"));
    const res = await GET_MIGRATIONS(
      makeReq("http://localhost/api/v1/super-admin/societies/soc-1/migrations"),
      { params: Promise.resolve({ id: "soc-1" }) },
    );
    expect(res.status).toBe(500);
  });
});

// ===========================================================================
// GET_SETTINGS
// ===========================================================================
describe("GET /api/v1/super-admin/societies/[id]/settings", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireSuperAdmin.mockResolvedValue(saOk);
    mockPrisma.society.findUnique.mockResolvedValue(mockSociety);
    mockPrisma.feeSession.findMany.mockResolvedValue([]);
    mockPrisma.societySubscription.findFirst.mockResolvedValue(mockSubscription);
  });

  it("returns 403 when not super admin", async () => {
    mockRequireSuperAdmin.mockResolvedValue(saForbidden);
    const res = await GET_SETTINGS(
      makeReq("http://localhost/api/v1/super-admin/societies/soc-1/settings"),
      { params: Promise.resolve({ id: "soc-1" }) },
    );
    expect(res.status).toBe(403);
  });

  it("returns full society settings with fee sessions and subscription", async () => {
    const mockSession = {
      id: "fs-1",
      sessionYear: "2025-26",
      annualFee: 2000,
      joiningFee: 500,
      sessionStart: new Date("2025-04-01"),
      sessionEnd: new Date("2026-03-31"),
      gracePeriodEnd: new Date("2026-04-30"),
      status: "ACTIVE",
    };
    mockPrisma.feeSession.findMany.mockResolvedValue([mockSession]);

    const res = await GET_SETTINGS(
      makeReq("http://localhost/api/v1/super-admin/societies/soc-1/settings"),
      { params: Promise.resolve({ id: "soc-1" }) },
    );
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.society).toMatchObject({
      id: "soc-1",
      name: "Greenwood Residency",
      societyCode: "EDEN001",
      joiningFee: 500,
      annualFee: 2000,
    });

    expect(body.feeSessions).toHaveLength(1);
    expect(body.feeSessions[0]).toMatchObject({
      id: "fs-1",
      sessionYear: "2025-26",
      status: "ACTIVE",
    });

    expect(body.subscription).toMatchObject({
      id: "sub-1",
      status: "ACTIVE",
      plan: { id: "plan-1", name: "Basic" },
    });

    expect(mockPrisma.society.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "soc-1" } }),
    );
  });

  it("returns settings with null subscription when no subscription found", async () => {
    mockPrisma.societySubscription.findFirst.mockResolvedValue(null);

    const res = await GET_SETTINGS(
      makeReq("http://localhost/api/v1/super-admin/societies/soc-1/settings"),
      { params: Promise.resolve({ id: "soc-1" }) },
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.subscription).toBeNull();
    expect(body.society.id).toBe("soc-1");
  });

  it("returns 404 when society not found", async () => {
    mockPrisma.society.findUnique.mockResolvedValue(null);

    const res = await GET_SETTINGS(
      makeReq("http://localhost/api/v1/super-admin/societies/soc-1/settings"),
      { params: Promise.resolve({ id: "soc-1" }) },
    );
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error.code).toBe("NOT_FOUND");
  });

  it("returns 500 on DB error", async () => {
    mockPrisma.society.findUnique.mockRejectedValue(new Error("DB error"));

    const res = await GET_SETTINGS(
      makeReq("http://localhost/api/v1/super-admin/societies/soc-1/settings"),
      { params: Promise.resolve({ id: "soc-1" }) },
    );
    expect(res.status).toBe(500);
  });
});

// ===========================================================================
// GET_REPORTS
// ===========================================================================
describe("GET /api/v1/super-admin/societies/[id]/reports/[type]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireSuperAdmin.mockResolvedValue(saOk);
    mockGetSessionYear.mockReturnValue("2025-26");
    // Default mocks for collection-summary
    mockPrisma.membershipFee.aggregate
      .mockResolvedValueOnce({ _sum: { amountPaid: 5000 }, _count: 8 })
      .mockResolvedValueOnce({ _sum: { amountDue: 2000 }, _count: 2 });
    mockPrisma.expense.aggregate.mockResolvedValue({ _sum: { amount: 500 } });
    // Default mock for expense-summary
    mockPrisma.expense.groupBy.mockResolvedValue([
      { category: "MAINTENANCE", _sum: { amount: 1000 }, _count: 2 },
    ]);
  });

  it("returns 403 when not super admin", async () => {
    mockRequireSuperAdmin.mockResolvedValue(saForbidden);
    const res = await GET_REPORTS(
      makeReq("http://localhost/api/v1/super-admin/societies/soc-1/reports/collection-summary"),
      { params: Promise.resolve({ id: "soc-1", type: "collection-summary" }) },
    );
    expect(res.status).toBe(403);
  });

  it("returns collection-summary report data", async () => {
    const res = await GET_REPORTS(
      makeReq("http://localhost/api/v1/super-admin/societies/soc-1/reports/collection-summary"),
      { params: Promise.resolve({ id: "soc-1", type: "collection-summary" }) },
    );
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.type).toBe("collection-summary");
    expect(body.sessionYear).toBe("2025-26");
    expect(body.totalCollected).toBe(5000);
    expect(body.totalOutstanding).toBe(2000);
    expect(body.totalExpenses).toBe(500);
    expect(body.balance).toBe(4500); // 5000 - 500
    expect(body.paidCount).toBe(8);
    expect(body.pendingCount).toBe(2);

    // membershipFee.aggregate called twice (paid + pending/overdue)
    expect(mockPrisma.membershipFee.aggregate).toHaveBeenCalledTimes(2);
    expect(mockPrisma.membershipFee.aggregate).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: { societyId: "soc-1", sessionYear: "2025-26", status: "PAID" },
      }),
    );
    expect(mockPrisma.membershipFee.aggregate).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        where: {
          societyId: "soc-1",
          sessionYear: "2025-26",
          status: { in: ["PENDING", "OVERDUE"] },
        },
      }),
    );
    expect(mockPrisma.expense.aggregate).toHaveBeenCalledOnce();
  });

  it("uses session query param when provided for collection-summary", async () => {
    mockPrisma.membershipFee.aggregate
      .mockReset()
      .mockResolvedValueOnce({ _sum: { amountPaid: 3000 }, _count: 5 })
      .mockResolvedValueOnce({ _sum: { amountDue: 1000 }, _count: 1 });

    const res = await GET_REPORTS(
      makeReq(
        "http://localhost/api/v1/super-admin/societies/soc-1/reports/collection-summary?session=2024-25",
      ),
      { params: Promise.resolve({ id: "soc-1", type: "collection-summary" }) },
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.sessionYear).toBe("2024-25");
    expect(mockPrisma.membershipFee.aggregate).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        where: expect.objectContaining({ sessionYear: "2024-25" }),
      }),
    );
  });

  it("returns expense-summary report data", async () => {
    const res = await GET_REPORTS(
      makeReq("http://localhost/api/v1/super-admin/societies/soc-1/reports/expense-summary"),
      { params: Promise.resolve({ id: "soc-1", type: "expense-summary" }) },
    );
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.type).toBe("expense-summary");
    expect(body.total).toBe(1000);
    expect(body.breakdown).toHaveLength(1);
    expect(body.breakdown[0]).toMatchObject({
      category: "MAINTENANCE",
      amount: 1000,
      count: 2,
    });

    expect(mockPrisma.expense.groupBy).toHaveBeenCalledWith(
      expect.objectContaining({
        by: ["category"],
        where: { societyId: "soc-1", status: "ACTIVE", eventId: null },
      }),
    );
  });

  it("returns 404 for unsupported report type", async () => {
    const res = await GET_REPORTS(
      makeReq("http://localhost/api/v1/super-admin/societies/soc-1/reports/invalid-type"),
      { params: Promise.resolve({ id: "soc-1", type: "invalid-type" }) },
    );
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error.code).toBe("NOT_FOUND");
  });

  it("returns 500 on DB error for collection-summary type", async () => {
    mockPrisma.membershipFee.aggregate.mockReset();
    mockPrisma.membershipFee.aggregate.mockRejectedValue(new Error("DB error"));

    const res = await GET_REPORTS(
      makeReq("http://localhost/api/v1/super-admin/societies/soc-1/reports/collection-summary"),
      { params: Promise.resolve({ id: "soc-1", type: "collection-summary" }) },
    );
    expect(res.status).toBe(500);
  });
});
