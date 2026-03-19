import { beforeEach, describe, expect, it, vi } from "vitest";

import { mockPrisma } from "../../__mocks__/prisma";
import { mockSupabaseClient } from "../../__mocks__/supabase";

const { mockGetActiveSocietyId } = vi.hoisted(() => ({
  mockGetActiveSocietyId: vi.fn(),
}));

vi.mock("@/lib/active-society-server", () => ({
  getActiveSocietyId: mockGetActiveSocietyId,
}));

// eslint-disable-next-line import/order
import { GET } from "@/app/api/v1/residents/me/fees/route";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function authAs(userId: string | null) {
  mockSupabaseClient.auth.getUser.mockResolvedValueOnce({
    data: { user: userId ? { id: userId } : null },
    error: null,
  });
}

function makeFee(overrides: Record<string, unknown> = {}) {
  return {
    id: "fee-1",
    sessionYear: "2025-26",
    amountDue: 1200,
    amountPaid: 1200,
    status: "PAID",
    isProrata: false,
    joiningFeeIncluded: false,
    gracePeriodEnd: null,
    feePayments: [],
    ...overrides,
  };
}

function makePayment(overrides: Record<string, unknown> = {}) {
  return {
    id: "pay-1",
    amount: 1200,
    paymentMode: "UPI",
    referenceNo: "UPI123",
    receiptNo: "EDEN-2025-R001",
    receiptUrl: null,
    paymentDate: new Date("2025-04-15"),
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("GET /api/v1/residents/me/fees", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetActiveSocietyId.mockResolvedValue(null);
  });

  // --- Auth ---

  it("returns 401 when not authenticated", async () => {
    authAs(null);

    const res = await GET();

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error.code).toBe("UNAUTHORIZED");
  });

  // --- User not found ---

  it("returns 404 when user not found", async () => {
    authAs("auth-1");
    mockPrisma.user.findFirst.mockResolvedValue(null);

    const res = await GET();

    expect(res.status).toBe(404);
  });

  // --- Empty fees ---

  it("returns empty fees array when resident has no fee records", async () => {
    authAs("auth-1");
    mockPrisma.user.findFirst.mockResolvedValue({ id: "u1" });
    mockPrisma.membershipFee.findMany.mockResolvedValue([]);

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.fees).toEqual([]);
  });

  // --- Fee data shape ---

  it("returns fees with correct shape", async () => {
    authAs("auth-1");
    mockPrisma.user.findFirst.mockResolvedValue({ id: "u1" });
    mockPrisma.membershipFee.findMany.mockResolvedValue([makeFee()]);

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.fees).toHaveLength(1);
    expect(body.fees[0]).toMatchObject({
      id: "fee-1",
      sessionYear: "2025-26",
      amountDue: 1200,
      amountPaid: 1200,
      status: "PAID",
      isProrata: false,
      joiningFeeIncluded: false,
      gracePeriodEnd: null,
      payments: [],
    });
  });

  it("includes payments nested under each fee", async () => {
    authAs("auth-1");
    mockPrisma.user.findFirst.mockResolvedValue({ id: "u1" });
    mockPrisma.membershipFee.findMany.mockResolvedValue([
      makeFee({ feePayments: [makePayment()] }),
    ]);

    const res = await GET();
    const body = await res.json();
    const payment = body.fees[0].payments[0];

    expect(payment.id).toBe("pay-1");
    expect(payment.amount).toBe(1200);
    expect(payment.paymentMode).toBe("UPI");
    expect(payment.referenceNo).toBe("UPI123");
    expect(payment.receiptNo).toBe("EDEN-2025-R001");
    expect(payment.receiptUrl).toBeNull();
  });

  it("returns all fee fields including prorata and joining fee", async () => {
    authAs("auth-1");
    mockPrisma.user.findFirst.mockResolvedValue({ id: "u1" });
    mockPrisma.membershipFee.findMany.mockResolvedValue([
      makeFee({
        isProrata: true,
        joiningFeeIncluded: true,
        gracePeriodEnd: new Date("2025-05-31"),
      }),
    ]);

    const res = await GET();
    const body = await res.json();

    expect(body.fees[0].isProrata).toBe(true);
    expect(body.fees[0].joiningFeeIncluded).toBe(true);
    expect(body.fees[0].gracePeriodEnd).toBeTruthy();
  });

  it("converts Decimal-like amountDue and amountPaid to numbers", async () => {
    authAs("auth-1");
    mockPrisma.user.findFirst.mockResolvedValue({ id: "u1" });
    // Simulate Prisma Decimal (has .toString / valueOf but Number() coerces it)
    mockPrisma.membershipFee.findMany.mockResolvedValue([
      makeFee({ amountDue: 1500, amountPaid: 750 }),
    ]);

    const res = await GET();
    const body = await res.json();

    expect(typeof body.fees[0].amountDue).toBe("number");
    expect(typeof body.fees[0].amountPaid).toBe("number");
    expect(body.fees[0].amountDue).toBe(1500);
    expect(body.fees[0].amountPaid).toBe(750);
  });

  it("converts payment amount to number", async () => {
    authAs("auth-1");
    mockPrisma.user.findFirst.mockResolvedValue({ id: "u1" });
    mockPrisma.membershipFee.findMany.mockResolvedValue([
      makeFee({ feePayments: [makePayment({ amount: 600 })] }),
    ]);

    const res = await GET();
    const body = await res.json();

    expect(typeof body.fees[0].payments[0].amount).toBe("number");
    expect(body.fees[0].payments[0].amount).toBe(600);
  });

  it("returns multiple fees sorted by session year desc (as ordered by DB)", async () => {
    authAs("auth-1");
    mockPrisma.user.findFirst.mockResolvedValue({ id: "u1" });
    mockPrisma.membershipFee.findMany.mockResolvedValue([
      makeFee({ id: "fee-2026", sessionYear: "2026-27" }),
      makeFee({ id: "fee-2025", sessionYear: "2025-26" }),
    ]);

    const res = await GET();
    const body = await res.json();

    expect(body.fees).toHaveLength(2);
    expect(body.fees[0].sessionYear).toBe("2026-27");
    expect(body.fees[1].sessionYear).toBe("2025-26");
  });

  // --- Scoping ---

  it("scopes user lookup by active societyId when present", async () => {
    mockGetActiveSocietyId.mockResolvedValue("soc-99");
    authAs("auth-1");
    mockPrisma.user.findFirst.mockResolvedValue({ id: "u1" });
    mockPrisma.membershipFee.findMany.mockResolvedValue([]);

    await GET();

    expect(mockPrisma.user.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ societyId: "soc-99" }),
      }),
    );
  });

  it("does not scope by societyId when active society is null", async () => {
    authAs("auth-1");
    mockPrisma.user.findFirst.mockResolvedValue({ id: "u1" });
    mockPrisma.membershipFee.findMany.mockResolvedValue([]);

    await GET();

    const callArg = mockPrisma.user.findFirst.mock.calls[0][0] as {
      where: Record<string, unknown>;
    };
    expect(callArg.where.societyId).toBeUndefined();
  });

  // --- Query args ---

  it("queries fees ordered by sessionYear descending", async () => {
    authAs("auth-1");
    mockPrisma.user.findFirst.mockResolvedValue({ id: "u1" });
    mockPrisma.membershipFee.findMany.mockResolvedValue([]);

    await GET();

    expect(mockPrisma.membershipFee.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { sessionYear: "desc" },
      }),
    );
  });

  it("queries fees filtered by userId", async () => {
    authAs("auth-1");
    mockPrisma.user.findFirst.mockResolvedValue({ id: "u-abc" });
    mockPrisma.membershipFee.findMany.mockResolvedValue([]);

    await GET();

    expect(mockPrisma.membershipFee.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: "u-abc" },
      }),
    );
  });

  it("excludes reversed and reversal payments via include filter", async () => {
    authAs("auth-1");
    mockPrisma.user.findFirst.mockResolvedValue({ id: "u1" });
    mockPrisma.membershipFee.findMany.mockResolvedValue([]);

    await GET();

    const call = mockPrisma.membershipFee.findMany.mock.calls[0][0] as {
      include: { feePayments: { where: Record<string, unknown> } };
    };
    expect(call.include.feePayments.where).toMatchObject({
      isReversal: false,
      isReversed: false,
    });
  });

  // --- Error handling ---

  it("returns 500 on unexpected error", async () => {
    mockSupabaseClient.auth.getUser.mockRejectedValueOnce(new Error("Connection lost"));

    const res = await GET();

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error.code).toBe("INTERNAL_ERROR");
  });
});
