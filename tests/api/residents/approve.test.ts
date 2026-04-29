import { NextRequest } from "next/server";

import { describe, it, expect, vi, beforeEach } from "vitest";

const mockPrisma = vi.hoisted(() => {
  const prisma = {
    user: {
      findUnique: vi.fn(),
      update: vi.fn(),
      count: vi.fn(),
    },
    membershipFee: {
      create: vi.fn(),
    },
    $transaction: vi.fn(),
  };
  prisma.$transaction.mockImplementation((cb: (tx: typeof prisma) => Promise<unknown>) =>
    cb(prisma),
  );
  return prisma;
});

const mockGetFullAccessAdmin = vi.hoisted(() => vi.fn());
const mockLogAudit = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/get-current-user", () => ({ getFullAccessAdmin: mockGetFullAccessAdmin }));
vi.mock("@/lib/audit", () => ({ logAudit: mockLogAudit }));

import { GET, PATCH } from "@/app/api/v1/residents/[id]/approve/route";

function makeGetReq(id: string) {
  return new NextRequest(`http://localhost/api/v1/residents/${id}/approve`, { method: "GET" });
}

function makePatchReq(id: string) {
  return new NextRequest(`http://localhost/api/v1/residents/${id}/approve`, { method: "PATCH" });
}

function makeParams(id: string) {
  return { params: Promise.resolve({ id }) };
}

const mockSociety = {
  id: "soc-1",
  societyId: "RWA-HR-GGN-122001-0001",
  societyCode: "GRNW",
  name: "Greenwood Residency",
  annualFee: 1200,
  joiningFee: 1000,
  feeSessionStartMonth: 4,
  gracePeriodDays: 15,
};

const mockPendingUser = {
  id: "r1",
  name: "Rajesh Kumar",
  email: "rajesh@eden.com",
  status: "PENDING_APPROVAL",
  society: mockSociety,
};

describe("GET /api/v1/residents/[id]/approve — pro-rata preview", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.user.findUnique.mockResolvedValue(mockPendingUser);
    mockPrisma.$transaction.mockImplementation((cb: (tx: typeof mockPrisma) => Promise<unknown>) =>
      cb(mockPrisma),
    );
  });

  it("returns 404 when resident not found", async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);
    const res = await GET(makeGetReq("r1"), makeParams("r1"));
    expect(res.status).toBe(404);
  });

  it("returns 400 when resident is not PENDING_APPROVAL", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ ...mockPendingUser, status: "ACTIVE_PAID" });
    const res = await GET(makeGetReq("r1"), makeParams("r1"));
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.error.code).toBe("INVALID_STATUS");
  });

  it("returns proRata and sessionYear", async () => {
    const res = await GET(makeGetReq("r1"), makeParams("r1"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.proRata).toBeDefined();
    expect(body.proRata.joiningFee).toBe(1000);
    expect(body.proRata.annualFee).toBe(1200);
    expect(body.proRata.totalFirstPayment).toBeGreaterThan(0);
    expect(body.sessionYear).toMatch(/^\d{4}-\d{2}$/);
  });

  it("does not modify the database", async () => {
    await GET(makeGetReq("r1"), makeParams("r1"));
    expect(mockPrisma.user.update).not.toHaveBeenCalled();
    expect(mockPrisma.membershipFee.create).not.toHaveBeenCalled();
  });

  it("returns 500 when resident has no society", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ ...mockPendingUser, society: null });
    const res = await GET(makeGetReq("r1"), makeParams("r1"));
    expect(res.status).toBe(500);
  });

  it("returns 500 on database error", async () => {
    mockPrisma.user.findUnique.mockRejectedValue(new Error("DB error"));
    const res = await GET(makeGetReq("r1"), makeParams("r1"));
    expect(res.status).toBe(500);
  });
});

const mockAdmin = {
  userId: "admin-1",
  authUserId: "auth-admin-1",
  societyId: "soc-1",
  role: "RWA_ADMIN" as const,
  adminPermission: "FULL_ACCESS" as const,
};

describe("PATCH /api/v1/residents/[id]/approve", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetFullAccessAdmin.mockResolvedValue(mockAdmin);
    mockPrisma.user.findUnique.mockResolvedValue(mockPendingUser);
    mockPrisma.user.count.mockResolvedValue(4);
    mockPrisma.user.update.mockResolvedValue({ ...mockPendingUser, status: "ACTIVE_PENDING" });
    mockPrisma.membershipFee.create.mockResolvedValue({});
    mockPrisma.$transaction.mockImplementation((cb: (tx: typeof mockPrisma) => Promise<unknown>) =>
      cb(mockPrisma),
    );
  });

  it("returns 401 when not authenticated", async () => {
    mockGetFullAccessAdmin.mockResolvedValue(null);
    const res = await PATCH(makePatchReq("r1"), makeParams("r1"));
    expect(res.status).toBe(401);
  });

  it("returns 404 when resident not found", async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);
    const res = await PATCH(makePatchReq("r1"), makeParams("r1"));
    expect(res.status).toBe(404);
  });

  it("returns 400 when resident is not PENDING_APPROVAL", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ ...mockPendingUser, status: "ACTIVE_PAID" });
    const res = await PATCH(makePatchReq("r1"), makeParams("r1"));
    expect(res.status).toBe(400);
  });

  it("approves resident and returns rwaid and proRata", async () => {
    const res = await PATCH(makePatchReq("r1"), makeParams("r1"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.rwaid).toContain("RWA-HR-GGN-122001-0001");
    expect(body.proRata).toBeDefined();
    expect(body.message).toContain("approved");
  });

  it("updates user status to ACTIVE_PENDING", async () => {
    await PATCH(makePatchReq("r1"), makeParams("r1"));
    expect(mockPrisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "r1" },
        data: expect.objectContaining({ status: "ACTIVE_PENDING" }),
      }),
    );
  });

  it("creates membership fee record with pro-rata", async () => {
    await PATCH(makePatchReq("r1"), makeParams("r1"));
    expect(mockPrisma.membershipFee.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          isProrata: true,
          joiningFeeIncluded: true,
          societyId: "soc-1",
        }),
      }),
    );
  });

  it("generates RWAID using resident count + 1", async () => {
    mockPrisma.user.count.mockResolvedValue(10);
    const res = await PATCH(makePatchReq("r1"), makeParams("r1"));
    const body = await res.json();
    expect(body.rwaid).toContain("-0011"); // 10 + 1, zero-padded
  });

  it("returns 500 when resident has no society", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ ...mockPendingUser, society: null });
    const res = await PATCH(makePatchReq("r1"), makeParams("r1"));
    expect(res.status).toBe(500);
  });

  it("returns 500 on database error", async () => {
    mockPrisma.user.findUnique.mockRejectedValue(new Error("DB error"));
    const res = await PATCH(makePatchReq("r1"), makeParams("r1"));
    expect(res.status).toBe(500);
  });

  it("fires audit log with RESIDENT_APPROVED after successful approval", async () => {
    await PATCH(makePatchReq("r1"), makeParams("r1"));
    expect(mockLogAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        actionType: "RESIDENT_APPROVED",
        userId: "admin-1",
        entityType: "User",
        entityId: "r1",
      }),
    );
  });

  it("does not fire audit log on failure", async () => {
    mockPrisma.user.findUnique.mockRejectedValue(new Error("DB error"));
    await PATCH(makePatchReq("r1"), makeParams("r1"));
    expect(mockLogAudit).not.toHaveBeenCalled();
  });
});
