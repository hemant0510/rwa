import { NextRequest } from "next/server";

import { describe, it, expect, vi, beforeEach } from "vitest";

const mockPrisma = vi.hoisted(() => {
  const prisma = {
    feePayment: { findUnique: vi.fn(), update: vi.fn() },
    membershipFee: { update: vi.fn() },
    user: { update: vi.fn() },
    $transaction: vi.fn(),
  };
  prisma.$transaction.mockImplementation((cb: (tx: typeof prisma) => Promise<unknown>) =>
    cb(prisma),
  );
  return prisma;
});

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

import { PATCH } from "@/app/api/v1/societies/[id]/fees/[feeId]/payments/[paymentId]/route";

function makeReq(body: unknown) {
  return new NextRequest("http://localhost/api/v1/societies/soc-1/fees/fee-1/payments/pay-1", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function makeParams(id = "soc-1", feeId = "fee-1", paymentId = "pay-1") {
  return { params: Promise.resolve({ id, feeId, paymentId }) };
}

const futureWindow = new Date(Date.now() + 24 * 60 * 60 * 1000);
const expiredWindow = new Date(Date.now() - 24 * 60 * 60 * 1000);

const mockFee = {
  id: "fee-1",
  userId: "res-1",
  societyId: "soc-1",
  amountDue: 2200,
  amountPaid: 2200,
};

const mockPayment = {
  id: "pay-1",
  feeId: "fee-1",
  userId: "res-1",
  societyId: "soc-1",
  amount: 2200,
  paymentMode: "CASH",
  isReversal: false,
  isReversed: false,
  correctionWindowEnds: futureWindow,
  fee: mockFee,
};

const validBody = { amount: 1000, reason: "Wrong amount entered" };

describe("PATCH /api/v1/societies/[id]/fees/[feeId]/payments/[paymentId]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.feePayment.findUnique.mockResolvedValue(mockPayment);
    mockPrisma.feePayment.update.mockResolvedValue({ ...mockPayment, amount: 1000 });
    mockPrisma.membershipFee.update.mockResolvedValue({});
    mockPrisma.user.update.mockResolvedValue({});
    mockPrisma.$transaction.mockImplementation((cb: (tx: typeof mockPrisma) => Promise<unknown>) =>
      cb(mockPrisma),
    );
  });

  it("returns 422 on invalid body", async () => {
    const res = await PATCH(makeReq({ reason: "x" }), makeParams()); // reason too short
    expect(res.status).toBe(422);
  });

  it("returns 404 when payment not found", async () => {
    mockPrisma.feePayment.findUnique.mockResolvedValue(null);
    const res = await PATCH(makeReq(validBody), makeParams());
    expect(res.status).toBe(404);
  });

  it("returns 404 when payment belongs to different society", async () => {
    mockPrisma.feePayment.findUnique.mockResolvedValue({ ...mockPayment, societyId: "other" });
    const res = await PATCH(makeReq(validBody), makeParams());
    expect(res.status).toBe(404);
  });

  it("returns 400 when payment is a reversal", async () => {
    mockPrisma.feePayment.findUnique.mockResolvedValue({ ...mockPayment, isReversal: true });
    const res = await PATCH(makeReq(validBody), makeParams());
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.error.code).toBe("CANNOT_CORRECT");
  });

  it("returns 400 when payment has been reversed", async () => {
    mockPrisma.feePayment.findUnique.mockResolvedValue({ ...mockPayment, isReversed: true });
    const res = await PATCH(makeReq(validBody), makeParams());
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.error.code).toBe("CANNOT_CORRECT");
  });

  it("returns 400 when correction window has expired", async () => {
    mockPrisma.feePayment.findUnique.mockResolvedValue({
      ...mockPayment,
      correctionWindowEnds: expiredWindow,
    });
    const res = await PATCH(makeReq(validBody), makeParams());
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.error.code).toBe("CORRECTION_WINDOW_EXPIRED");
  });

  it("returns 400 when correction window is null", async () => {
    mockPrisma.feePayment.findUnique.mockResolvedValue({
      ...mockPayment,
      correctionWindowEnds: null,
    });
    const res = await PATCH(makeReq(validBody), makeParams());
    expect(res.status).toBe(400);
  });

  it("returns 400 when corrected amount causes negative balance", async () => {
    // fee.amountPaid = 2200, reducing payment 2200 → 100 means delta = -2100
    // new amountPaid = 2200 - 2100 = 100 (ok)
    // but if there were two payments and this one is 2200 while total is 2200...
    // force: fee.amountPaid = 500, payment.amount = 500, new corrected amount = 1000 → ok
    // For negative: fee.amountPaid = 500, payment.amount = 2200 → would make delta = -1200 → 500 - 1200 = -700
    mockPrisma.feePayment.findUnique.mockResolvedValue({
      ...mockPayment,
      amount: 2200,
      fee: { ...mockFee, amountPaid: 500 },
    });
    const res = await PATCH(makeReq({ ...validBody, amount: 1000 }), makeParams());
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.error.code).toBe("INVALID_AMOUNT");
  });

  it("corrects payment amount and returns 200", async () => {
    mockPrisma.feePayment.findUnique.mockResolvedValue({
      ...mockPayment,
      amount: 2200,
      fee: { ...mockFee, amountPaid: 2200 },
    });
    const res = await PATCH(makeReq({ ...validBody, amount: 1800 }), makeParams());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.message).toContain("corrected");
  });

  it("updates fee status to PAID when new amount covers full due", async () => {
    mockPrisma.feePayment.findUnique.mockResolvedValue({
      ...mockPayment,
      amount: 2000,
      fee: { ...mockFee, amountPaid: 2000, amountDue: 2200 },
    });
    // delta = 2200 - 2000 = +200; new amountPaid = 2000 + 200 = 2200 = amountDue
    await PATCH(makeReq({ ...validBody, amount: 2200 }), makeParams());
    expect(mockPrisma.membershipFee.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "PAID" }) }),
    );
  });

  it("updates fee status to PARTIAL when amount is partial", async () => {
    // payment.amount = 2200, fee.amountPaid = 2200, correcting to 1000
    // delta = -1200, new amountPaid = 1000 (< 2200)
    const res = await PATCH(makeReq({ ...validBody, amount: 1000 }), makeParams());
    expect(res.status).toBe(200);
    expect(mockPrisma.membershipFee.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "PARTIAL" }) }),
    );
  });

  it("applies paymentMode, referenceNo, and notes when provided", async () => {
    const res = await PATCH(
      makeReq({
        amount: 1500,
        paymentMode: "UPI",
        referenceNo: "UPI-REF-999",
        notes: "Corrected entry",
        reason: "Wrong mode entered",
      }),
      makeParams(),
    );
    expect(res.status).toBe(200);
    expect(mockPrisma.feePayment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          paymentMode: "UPI",
          referenceNo: "UPI-REF-999",
          notes: "Corrected entry",
        }),
      }),
    );
  });

  it("sets referenceNo to null when empty string provided", async () => {
    await PATCH(makeReq({ referenceNo: "", reason: "Clear reference" }), makeParams());
    expect(mockPrisma.feePayment.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ referenceNo: null }),
      }),
    );
  });

  it("sets fee status to PENDING when corrected amount results in zero paid", async () => {
    // fee.amountPaid = 1, payment.amount = 1000, correcting to 999
    // delta = 999 - 1000 = -1; newAmountPaid = 1 - 1 = 0 → PENDING
    mockPrisma.feePayment.findUnique.mockResolvedValue({
      ...mockPayment,
      amount: 1000,
      fee: { ...mockFee, amountPaid: 1, amountDue: 2200 },
    });
    await PATCH(makeReq({ ...validBody, amount: 999 }), makeParams());
    expect(mockPrisma.membershipFee.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "PENDING" }) }),
    );
    expect(mockPrisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "ACTIVE_PENDING" }) }),
    );
  });

  it("returns 500 on database error", async () => {
    mockPrisma.feePayment.findUnique.mockRejectedValue(new Error("DB error"));
    const res = await PATCH(makeReq(validBody), makeParams());
    expect(res.status).toBe(500);
  });
});
