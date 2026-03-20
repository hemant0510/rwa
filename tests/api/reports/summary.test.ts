import { NextRequest } from "next/server";

import { describe, it, expect, vi, beforeEach } from "vitest";

const mockPrisma = vi.hoisted(() => ({
  society: { findUnique: vi.fn() },
  membershipFee: {
    count: vi.fn(),
    aggregate: vi.fn(),
  },
  expense: { aggregate: vi.fn() },
}));

const mockGetCurrentUser = vi.hoisted(() => vi.fn());

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/get-current-user", () => ({ getCurrentUser: mockGetCurrentUser }));

import { GET } from "@/app/api/v1/societies/[id]/reports/summary/route";

function makeReq(session?: string) {
  const url = session
    ? `http://localhost/api/v1/societies/soc-1/reports/summary?session=${session}`
    : "http://localhost/api/v1/societies/soc-1/reports/summary";
  return new NextRequest(url);
}

function makeParams(id = "soc-1") {
  return { params: Promise.resolve({ id }) };
}

describe("GET /api/v1/societies/[id]/reports/summary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCurrentUser.mockResolvedValue({
      userId: "admin-1",
      societyId: "soc-1",
      role: "RWA_ADMIN",
    });
    mockPrisma.society.findUnique.mockResolvedValue({ id: "soc-1", feeSessionStartMonth: 4 });
    mockPrisma.membershipFee.count
      .mockResolvedValueOnce(30) // paid count
      .mockResolvedValueOnce(10); // pending count
    mockPrisma.membershipFee.aggregate
      .mockResolvedValueOnce({ _sum: { amountPaid: 72000 } }) // collected
      .mockResolvedValueOnce({ _sum: { amountDue: 24000 } }); // outstanding
    mockPrisma.expense.aggregate.mockResolvedValue({ _sum: { amount: 14000 } });
  });

  it("returns 401 when not authenticated", async () => {
    mockGetCurrentUser.mockResolvedValue(null);
    const res = await GET(makeReq(), makeParams());
    expect(res.status).toBe(401);
  });

  it("returns 401 when society mismatch", async () => {
    mockGetCurrentUser.mockResolvedValue({
      userId: "admin-1",
      societyId: "other-soc",
      role: "RWA_ADMIN",
    });
    const res = await GET(makeReq(), makeParams());
    expect(res.status).toBe(401);
  });

  it("returns 404 when society not found", async () => {
    mockPrisma.society.findUnique.mockResolvedValue(null);
    const res = await GET(makeReq(), makeParams());
    expect(res.status).toBe(404);
  });

  it("returns summary with correct values", async () => {
    const res = await GET(makeReq("2025-26"), makeParams());
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.paidCount).toBe(30);
    expect(body.pendingCount).toBe(10);
    expect(body.totalCollected).toBe(72000);
    expect(body.totalOutstanding).toBe(24000);
    expect(body.totalExpenses).toBe(14000);
    expect(body.balance).toBe(58000); // 72000 - 14000
  });

  it("uses session from query param", async () => {
    const res = await GET(makeReq("2024-25"), makeParams());
    const body = await res.json();
    expect(body.sessionYear).toBe("2024-25");
  });

  it("defaults session to current year when not provided", async () => {
    const res = await GET(makeReq(), makeParams());
    const body = await res.json();
    expect(body.sessionYear).toBeDefined();
  });

  it("returns zero counts when no fees", async () => {
    mockPrisma.membershipFee.count.mockReset().mockResolvedValue(0);
    mockPrisma.membershipFee.aggregate
      .mockReset()
      .mockResolvedValueOnce({ _sum: { amountPaid: null } })
      .mockResolvedValueOnce({ _sum: { amountDue: null } });
    mockPrisma.expense.aggregate.mockReset().mockResolvedValue({ _sum: { amount: null } });

    const res = await GET(makeReq("2025-26"), makeParams());
    const body = await res.json();
    expect(body.totalCollected).toBe(0);
    expect(body.totalExpenses).toBe(0);
    expect(body.balance).toBe(0);
  });

  it("calculates negative balance correctly", async () => {
    mockPrisma.membershipFee.count.mockReset().mockResolvedValue(0);
    mockPrisma.membershipFee.aggregate
      .mockReset()
      .mockResolvedValueOnce({ _sum: { amountPaid: 5000 } })
      .mockResolvedValueOnce({ _sum: { amountDue: 0 } });
    mockPrisma.expense.aggregate.mockReset().mockResolvedValue({ _sum: { amount: 8000 } });

    const res = await GET(makeReq("2025-26"), makeParams());
    const body = await res.json();
    expect(body.balance).toBe(-3000);
  });
});
