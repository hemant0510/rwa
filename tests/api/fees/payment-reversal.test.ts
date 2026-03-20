import { NextRequest } from "next/server";

import { describe, it, expect, vi, beforeEach } from "vitest";

const mockPrisma = vi.hoisted(() => {
  const prisma = {
    feePayment: { findUnique: vi.fn(), count: vi.fn(), update: vi.fn(), create: vi.fn() },
    membershipFee: { update: vi.fn() },
    user: { update: vi.fn() },
    $transaction: vi.fn(),
  };
  prisma.$transaction.mockImplementation((cb: (tx: typeof prisma) => Promise<unknown>) =>
    cb(prisma),
  );
  return prisma;
});

const mockGetCurrentUser = vi.hoisted(() => vi.fn());

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/get-current-user", () => ({ getCurrentUser: mockGetCurrentUser }));

import { POST } from "@/app/api/v1/societies/[id]/fees/[feeId]/payments/[paymentId]/reverse/route";

function makeReq(body: unknown) {
  return new NextRequest(
    "http://localhost/api/v1/societies/soc-1/fees/fee-1/payments/pay-1/reverse",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );
}

function makeParams(id = "soc-1", feeId = "fee-1", paymentId = "pay-1") {
  return { params: Promise.resolve({ id, feeId, paymentId }) };
}

const mockSociety = { societyCode: "EDEN" };
const mockFee = {
  id: "fee-1",
  userId: "res-1",
  societyId: "soc-1",
  amountDue: 2200,
  amountPaid: 2200,
  society: mockSociety,
};

const mockPayment = {
  id: "pay-1",
  feeId: "fee-1",
  userId: "res-1",
  societyId: "soc-1",
  amount: 2200,
  paymentMode: "CASH",
  receiptNo: "EDEN-2025-R0001",
  recordedBy: "admin-1",
  isReversal: false,
  isReversed: false,
  fee: mockFee,
};

const validBody = { reason: "Duplicate payment recorded" };

describe("POST /api/v1/societies/[id]/fees/[feeId]/payments/[paymentId]/reverse", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCurrentUser.mockResolvedValue({ userId: "admin-2", role: "RWA_ADMIN" });
    mockPrisma.feePayment.findUnique.mockResolvedValue(mockPayment);
    mockPrisma.feePayment.count.mockResolvedValue(5);
    mockPrisma.feePayment.update.mockResolvedValue({});
    mockPrisma.feePayment.create.mockResolvedValue({ id: "rev-1", receiptNo: "EDEN-2025-R0006" });
    mockPrisma.membershipFee.update.mockResolvedValue({});
    mockPrisma.user.update.mockResolvedValue({});
    mockPrisma.$transaction.mockImplementation((cb: (tx: typeof mockPrisma) => Promise<unknown>) =>
      cb(mockPrisma),
    );
  });

  it("returns 422 on invalid body", async () => {
    const res = await POST(makeReq({ reason: "x" }), makeParams()); // reason too short
    expect(res.status).toBe(422);
  });

  it("returns 404 when payment not found", async () => {
    mockPrisma.feePayment.findUnique.mockResolvedValue(null);
    const res = await POST(makeReq(validBody), makeParams());
    expect(res.status).toBe(404);
  });

  it("returns 404 when payment belongs to different society", async () => {
    mockPrisma.feePayment.findUnique.mockResolvedValue({ ...mockPayment, societyId: "other" });
    const res = await POST(makeReq(validBody), makeParams());
    expect(res.status).toBe(404);
  });

  it("returns 400 when payment is already reversed", async () => {
    mockPrisma.feePayment.findUnique.mockResolvedValue({ ...mockPayment, isReversed: true });
    const res = await POST(makeReq(validBody), makeParams());
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.error.code).toBe("ALREADY_REVERSED");
  });

  it("returns 400 when trying to reverse a reversal entry", async () => {
    mockPrisma.feePayment.findUnique.mockResolvedValue({ ...mockPayment, isReversal: true });
    const res = await POST(makeReq(validBody), makeParams());
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.error.code).toBe("CANNOT_REVERSE_REVERSAL");
  });

  it("returns 200 and creates reversal entry", async () => {
    const res = await POST(makeReq(validBody), makeParams());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.message).toContain("reversed");
    expect(body.reversal).toBeDefined();
  });

  it("marks original payment as reversed", async () => {
    await POST(makeReq(validBody), makeParams());
    expect(mockPrisma.feePayment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "pay-1" },
        data: expect.objectContaining({ isReversed: true }),
      }),
    );
  });

  it("creates reversal entry with isReversal=true and reversalOf set", async () => {
    await POST(makeReq(validBody), makeParams());
    expect(mockPrisma.feePayment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          isReversal: true,
          reversalOf: "pay-1",
          reversalReason: validBody.reason,
        }),
      }),
    );
  });

  it("uses current admin userId as recordedBy when authenticated", async () => {
    await POST(makeReq(validBody), makeParams());
    expect(mockPrisma.feePayment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ recordedBy: "admin-2" }),
      }),
    );
  });

  it("falls back to original recordedBy when admin is null", async () => {
    mockGetCurrentUser.mockResolvedValue(null);
    await POST(makeReq(validBody), makeParams());
    expect(mockPrisma.feePayment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ recordedBy: "admin-1" }),
      }),
    );
  });

  it("updates fee status to PENDING when fully reversed", async () => {
    await POST(makeReq(validBody), makeParams());
    expect(mockPrisma.membershipFee.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "PENDING", amountPaid: 0 }),
      }),
    );
  });

  it("updates fee status to PARTIAL when partially reversed", async () => {
    // fee.amountPaid = 2200, payment.amount = 1000 → new amountPaid = 1200 (partial)
    mockPrisma.feePayment.findUnique.mockResolvedValue({
      ...mockPayment,
      amount: 1000,
      fee: { ...mockFee, amountPaid: 2200 },
    });
    await POST(makeReq(validBody), makeParams());
    expect(mockPrisma.membershipFee.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "PARTIAL" }),
      }),
    );
  });

  it("updates user status to ACTIVE_PENDING when fee goes to PENDING", async () => {
    await POST(makeReq(validBody), makeParams());
    expect(mockPrisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "ACTIVE_PENDING" }),
      }),
    );
  });

  it("keeps fee status PAID and user ACTIVE_PAID when remaining amountPaid still covers amountDue", async () => {
    // fee.amountPaid = 3000, fee.amountDue = 2200, reversing 500
    // new amountPaid = 2500 >= 2200 → PAID
    mockPrisma.feePayment.findUnique.mockResolvedValue({
      ...mockPayment,
      amount: 500,
      fee: { ...mockFee, amountPaid: 3000, amountDue: 2200 },
    });
    await POST(makeReq(validBody), makeParams());
    expect(mockPrisma.membershipFee.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "PAID" }) }),
    );
    expect(mockPrisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "ACTIVE_PAID" }) }),
    );
  });

  it("returns 500 on database error", async () => {
    mockPrisma.feePayment.findUnique.mockRejectedValue(new Error("DB error"));
    const res = await POST(makeReq(validBody), makeParams());
    expect(res.status).toBe(500);
  });
});
