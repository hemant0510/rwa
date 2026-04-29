import { NextRequest } from "next/server";

import { describe, it, expect, vi, beforeEach } from "vitest";

const mockPrisma = vi.hoisted(() => {
  const prisma = {
    membershipFee: { findUnique: vi.fn(), update: vi.fn() },
    feePayment: { count: vi.fn(), create: vi.fn() },
    user: { update: vi.fn() },
    $transaction: vi.fn(),
  };
  prisma.$transaction.mockImplementation((cb: (tx: typeof prisma) => Promise<unknown>) =>
    cb(prisma),
  );
  return prisma;
});

const mockGetCurrentUser = vi.hoisted(() => vi.fn());
const mockLogAudit = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/get-current-user", () => ({ getCurrentUser: mockGetCurrentUser }));
vi.mock("@/lib/audit", () => ({ logAudit: mockLogAudit }));

import { POST } from "@/app/api/v1/societies/[id]/fees/[feeId]/payments/route";

function makeReq(body: unknown) {
  return new NextRequest("http://localhost/api/v1/societies/soc-1/fees/fee-1/payments", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function makeParams(id = "soc-1", feeId = "fee-1") {
  return { params: Promise.resolve({ id, feeId }) };
}

const mockSociety = { id: "soc-1", societyCode: "GRNW" };
const mockFee = {
  id: "fee-1",
  userId: "res-1",
  societyId: "soc-1",
  amountDue: 2200,
  amountPaid: 0,
  society: mockSociety,
  user: { id: "res-1" },
};

const validBody = {
  amount: 2200,
  paymentMode: "CASH",
  paymentDate: "2025-04-10",
};

describe("POST /api/v1/societies/[id]/fees/[feeId]/payments", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCurrentUser.mockResolvedValue({ userId: "admin-1", role: "RWA_ADMIN" });
    mockPrisma.membershipFee.findUnique.mockResolvedValue(mockFee);
    mockPrisma.feePayment.count.mockResolvedValue(0);
    mockPrisma.feePayment.create.mockResolvedValue({ id: "pay-1", receiptNo: "EDEN-2025-R0001" });
    mockPrisma.membershipFee.update.mockResolvedValue({});
    mockPrisma.user.update.mockResolvedValue({});
    mockPrisma.$transaction.mockImplementation((cb: (tx: typeof mockPrisma) => Promise<unknown>) =>
      cb(mockPrisma),
    );
  });

  it("returns 401 when admin is not authenticated", async () => {
    mockGetCurrentUser.mockResolvedValue(null);
    const res = await POST(makeReq(validBody), makeParams());
    expect(res.status).toBe(401);
  });

  it("returns 422 on invalid body", async () => {
    const res = await POST(
      makeReq({ amount: -100, paymentMode: "CASH", paymentDate: "bad" }),
      makeParams(),
    );
    expect(res.status).toBe(422);
  });

  it("returns 404 when fee not found", async () => {
    mockPrisma.membershipFee.findUnique.mockResolvedValue(null);
    const res = await POST(makeReq(validBody), makeParams());
    expect(res.status).toBe(404);
  });

  it("returns 404 when fee belongs to different society", async () => {
    mockPrisma.membershipFee.findUnique.mockResolvedValue({ ...mockFee, societyId: "other-soc" });
    const res = await POST(makeReq(validBody), makeParams());
    expect(res.status).toBe(404);
  });

  it("returns 400 when amount exceeds balance", async () => {
    const res = await POST(makeReq({ ...validBody, amount: 9999 }), makeParams());
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.error.code).toBe("OVERPAYMENT");
  });

  it("records payment and returns 201", async () => {
    const res = await POST(makeReq(validBody), makeParams());
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.message).toContain("successfully");
    expect(body.receiptNo).toBeDefined();
  });

  it("uses admin userId as recordedBy", async () => {
    await POST(makeReq(validBody), makeParams());
    expect(mockPrisma.feePayment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ recordedBy: "admin-1" }),
      }),
    );
  });

  it("sets status to PAID when full amount paid", async () => {
    await POST(makeReq(validBody), makeParams());
    expect(mockPrisma.membershipFee.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "PAID" }) }),
    );
  });

  it("sets status to PARTIAL when partial amount paid", async () => {
    await POST(makeReq({ ...validBody, amount: 1000 }), makeParams());
    expect(mockPrisma.membershipFee.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "PARTIAL" }) }),
    );
  });

  it("updates user to ACTIVE_PAID when fully paid", async () => {
    await POST(makeReq(validBody), makeParams());
    expect(mockPrisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "ACTIVE_PAID" }) }),
    );
  });

  it("updates user to ACTIVE_PARTIAL when partially paid", async () => {
    await POST(makeReq({ ...validBody, amount: 1000 }), makeParams());
    expect(mockPrisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "ACTIVE_PARTIAL" }) }),
    );
  });

  it("sets 48h correction window", async () => {
    await POST(makeReq(validBody), makeParams());
    expect(mockPrisma.feePayment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ correctionWindowEnds: expect.any(Date) }),
      }),
    );
  });

  it("fires audit log with PAYMENT_RECORDED after success", async () => {
    await POST(makeReq(validBody), makeParams());
    expect(mockLogAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        actionType: "PAYMENT_RECORDED",
        userId: "admin-1",
        societyId: "soc-1",
        entityType: "FeePayment",
        entityId: "pay-1",
      }),
    );
  });

  it("does not fire audit log on failure", async () => {
    mockPrisma.membershipFee.findUnique.mockRejectedValue(new Error("DB error"));
    await POST(makeReq(validBody), makeParams());
    expect(mockLogAudit).not.toHaveBeenCalled();
  });

  it("returns 500 on database error", async () => {
    mockPrisma.membershipFee.findUnique.mockRejectedValue(new Error("DB error"));
    const res = await POST(makeReq(validBody), makeParams());
    expect(res.status).toBe(500);
  });
});
