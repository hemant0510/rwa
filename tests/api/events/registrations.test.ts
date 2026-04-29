import { NextRequest } from "next/server";

import { describe, it, expect, vi, beforeEach } from "vitest";

const mockPrisma = vi.hoisted(() => ({
  communityEvent: { findUnique: vi.fn() },
  eventRegistration: { findMany: vi.fn(), findUnique: vi.fn(), count: vi.fn(), update: vi.fn() },
  eventPayment: { findFirst: vi.fn(), create: vi.fn() },
  society: { findUnique: vi.fn() },
  $transaction: vi.fn(),
}));

const mockGetCurrentUser = vi.hoisted(() => vi.fn());
const mockLogAudit = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/get-current-user", () => ({ getCurrentUser: mockGetCurrentUser }));
vi.mock("@/lib/audit", () => ({ logAudit: mockLogAudit }));

import { GET } from "@/app/api/v1/societies/[id]/events/[eventId]/registrations/route";
// eslint-disable-next-line import/order
import { POST } from "@/app/api/v1/societies/[id]/events/[eventId]/registrations/[regId]/payment/route";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeGetRequest(query = "") {
  return new NextRequest(`http://localhost/test${query ? "?" + query : ""}`);
}

function makePostRequest(body: unknown) {
  return new NextRequest("http://localhost/test", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

function makeListParams(id = "soc-1", eventId = "evt-1") {
  return { params: Promise.resolve({ id, eventId }) };
}

function makePaymentParams(id = "soc-1", eventId = "evt-1", regId = "reg-1") {
  return { params: Promise.resolve({ id, eventId, regId }) };
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const mockEvent = {
  id: "evt-1",
  societyId: "soc-1",
  title: "Holi Celebration",
  status: "PUBLISHED",
  feeModel: "FIXED",
  feeAmount: { valueOf: () => 500 },
  chargeUnit: "PER_PERSON",
  settledAt: null,
  surplusAmount: null,
  surplusDisposal: null,
  deficitDisposition: null,
  settlementNotes: null,
};

const mockRegistration = {
  id: "reg-1",
  eventId: "evt-1",
  userId: "user-1",
  societyId: "soc-1",
  status: "PENDING",
  memberCount: 1,
  payment: null,
};

const mockPaymentBody = {
  amount: 500,
  paymentMode: "CASH",
  paymentDate: "2026-04-15",
};

const mockCreatedPayment = {
  id: "pay-1",
  registrationId: "reg-1",
  userId: "user-1",
  societyId: "soc-1",
  amount: 500,
  paymentMode: "CASH",
  receiptNo: "EVT-GRNW-2026-00001",
  paymentDate: new Date("2026-04-15"),
  notes: null,
  recordedBy: "admin-1",
};

// ---------------------------------------------------------------------------
// GET /registrations
// ---------------------------------------------------------------------------

describe("GET /api/v1/societies/[id]/events/[eventId]/registrations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.communityEvent.findUnique.mockResolvedValue(mockEvent);
    mockPrisma.eventRegistration.findMany.mockResolvedValue([mockRegistration]);
    mockPrisma.eventRegistration.count.mockResolvedValue(1);
  });

  it("returns registrations list with pagination metadata", async () => {
    const res = await GET(makeGetRequest(), makeListParams());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toHaveLength(1);
    expect(body.total).toBe(1);
    expect(body.page).toBe(1);
    expect(body.limit).toBe(50);
  });

  it("passes status filter to query when provided", async () => {
    await GET(makeGetRequest("status=CONFIRMED"), makeListParams());
    expect(mockPrisma.eventRegistration.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: "CONFIRMED" }),
      }),
    );
  });

  it("respects custom page and limit query params", async () => {
    mockPrisma.eventRegistration.findMany.mockResolvedValue([]);
    mockPrisma.eventRegistration.count.mockResolvedValue(0);
    const res = await GET(makeGetRequest("page=2&limit=10"), makeListParams());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.page).toBe(2);
    expect(body.limit).toBe(10);
    expect(mockPrisma.eventRegistration.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 10, take: 10 }),
    );
  });

  it("returns 404 when event not found", async () => {
    mockPrisma.communityEvent.findUnique.mockResolvedValue(null);
    const res = await GET(makeGetRequest(), makeListParams());
    expect(res.status).toBe(404);
  });

  it("returns 404 when event belongs to different society", async () => {
    mockPrisma.communityEvent.findUnique.mockResolvedValue({
      ...mockEvent,
      societyId: "other-soc",
    });
    const res = await GET(makeGetRequest(), makeListParams());
    expect(res.status).toBe(404);
  });

  it("returns 500 on database error", async () => {
    mockPrisma.communityEvent.findUnique.mockRejectedValue(new Error("DB error"));
    const res = await GET(makeGetRequest(), makeListParams());
    expect(res.status).toBe(500);
  });
});

// ---------------------------------------------------------------------------
// POST /registrations/[regId]/payment  — record payment
// ---------------------------------------------------------------------------

describe("POST /api/v1/societies/[id]/events/[eventId]/registrations/[regId]/payment", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCurrentUser.mockResolvedValue({ userId: "admin-1", role: "RWA_ADMIN" });
    mockPrisma.communityEvent.findUnique.mockResolvedValue({
      ...mockEvent,
      feeAmount: 500,
    });
    mockPrisma.eventRegistration.findUnique.mockResolvedValue(mockRegistration);
    mockPrisma.society.findUnique.mockResolvedValue({ societyCode: "GRNW" });
    mockPrisma.eventPayment.findFirst.mockResolvedValue(null);
    mockPrisma.eventPayment.create.mockResolvedValue(mockCreatedPayment);
    mockPrisma.eventRegistration.update.mockResolvedValue({
      ...mockRegistration,
      status: "CONFIRMED",
    });
    mockPrisma.$transaction.mockImplementation((fn: (tx: typeof mockPrisma) => Promise<unknown>) =>
      fn(mockPrisma),
    );
  });

  it("returns 401 when not authenticated", async () => {
    mockGetCurrentUser.mockResolvedValue(null);
    const res = await POST(makePostRequest(mockPaymentBody), makePaymentParams());
    expect(res.status).toBe(401);
  });

  it("returns 404 when event not found", async () => {
    mockPrisma.communityEvent.findUnique.mockResolvedValue(null);
    const res = await POST(makePostRequest(mockPaymentBody), makePaymentParams());
    expect(res.status).toBe(404);
  });

  it("returns 404 when event belongs to different society", async () => {
    mockPrisma.communityEvent.findUnique.mockResolvedValue({
      ...mockEvent,
      feeAmount: 500,
      societyId: "other-soc",
    });
    const res = await POST(makePostRequest(mockPaymentBody), makePaymentParams());
    expect(res.status).toBe(404);
  });

  it("returns 404 when registration not found", async () => {
    mockPrisma.eventRegistration.findUnique.mockResolvedValue(null);
    const res = await POST(makePostRequest(mockPaymentBody), makePaymentParams());
    expect(res.status).toBe(404);
  });

  it("returns 404 when registration belongs to different event", async () => {
    mockPrisma.eventRegistration.findUnique.mockResolvedValue({
      ...mockRegistration,
      eventId: "other-evt",
    });
    const res = await POST(makePostRequest(mockPaymentBody), makePaymentParams());
    expect(res.status).toBe(404);
  });

  it("returns 400 with ALREADY_PAID when payment already recorded", async () => {
    mockPrisma.eventRegistration.findUnique.mockResolvedValue({
      ...mockRegistration,
      payment: { id: "pay-existing" },
    });
    const res = await POST(makePostRequest(mockPaymentBody), makePaymentParams());
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("ALREADY_PAID");
  });

  it("returns 400 with NOT_PENDING for FIXED event when registration is CONFIRMED", async () => {
    mockPrisma.eventRegistration.findUnique.mockResolvedValue({
      ...mockRegistration,
      status: "CONFIRMED",
      payment: null,
    });
    const res = await POST(makePostRequest(mockPaymentBody), makePaymentParams());
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("NOT_PENDING");
  });

  it("returns 400 with NOT_PENDING for FLEXIBLE event when registration is INTERESTED", async () => {
    mockPrisma.communityEvent.findUnique.mockResolvedValue({
      ...mockEvent,
      feeModel: "FLEXIBLE",
      feeAmount: 500,
    });
    mockPrisma.eventRegistration.findUnique.mockResolvedValue({
      ...mockRegistration,
      status: "INTERESTED",
      payment: null,
    });
    const res = await POST(makePostRequest(mockPaymentBody), makePaymentParams());
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("NOT_PENDING");
  });

  it("returns 400 with AMOUNT_MISMATCH when amount does not match FIXED fee (PER_PERSON)", async () => {
    const res = await POST(
      makePostRequest({ ...mockPaymentBody, amount: 999 }),
      makePaymentParams(),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("AMOUNT_MISMATCH");
  });

  it("returns 400 with AMOUNT_MISMATCH for FIXED PER_PERSON with 2 members", async () => {
    mockPrisma.eventRegistration.findUnique.mockResolvedValue({
      ...mockRegistration,
      memberCount: 2,
      payment: null,
    });
    // 2 members × 500 = 1000 expected, but sending 500
    const res = await POST(
      makePostRequest({ ...mockPaymentBody, amount: 500 }),
      makePaymentParams(),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("AMOUNT_MISMATCH");
  });

  it("accepts correct amount for FIXED PER_PERSON with 2 members", async () => {
    mockPrisma.eventRegistration.findUnique.mockResolvedValue({
      ...mockRegistration,
      memberCount: 2,
      payment: null,
    });
    const res = await POST(
      makePostRequest({ ...mockPaymentBody, amount: 1000 }),
      makePaymentParams(),
    );
    expect(res.status).toBe(201);
  });

  it("accepts PER_HOUSEHOLD amount regardless of memberCount", async () => {
    mockPrisma.communityEvent.findUnique.mockResolvedValue({
      ...mockEvent,
      feeAmount: 500,
      chargeUnit: "PER_HOUSEHOLD",
    });
    mockPrisma.eventRegistration.findUnique.mockResolvedValue({
      ...mockRegistration,
      memberCount: 3,
      payment: null,
    });
    const res = await POST(
      makePostRequest({ ...mockPaymentBody, amount: 500 }),
      makePaymentParams(),
    );
    expect(res.status).toBe(201);
  });

  it("returns 400 AMOUNT_MISMATCH for FLEXIBLE event when amount is wrong", async () => {
    mockPrisma.communityEvent.findUnique.mockResolvedValue({
      ...mockEvent,
      feeModel: "FLEXIBLE",
      feeAmount: 300,
    });
    const res = await POST(
      makePostRequest({ ...mockPaymentBody, amount: 999 }),
      makePaymentParams(),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("AMOUNT_MISMATCH");
  });

  it("records CASH payment and returns 201 with payment object", async () => {
    const res = await POST(makePostRequest(mockPaymentBody), makePaymentParams());
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.id).toBe("pay-1");
    expect(body.receiptNo).toBe("EVT-GRNW-2026-00001");
  });

  it("transitions PENDING registration to CONFIRMED after payment", async () => {
    await POST(makePostRequest(mockPaymentBody), makePaymentParams());
    expect(mockPrisma.eventRegistration.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "CONFIRMED" }) }),
    );
  });

  it("does NOT update registration status for CONTRIBUTION event (already CONFIRMED)", async () => {
    mockPrisma.communityEvent.findUnique.mockResolvedValue({
      ...mockEvent,
      feeModel: "CONTRIBUTION",
      feeAmount: null,
    });
    mockPrisma.eventRegistration.findUnique.mockResolvedValue({
      ...mockRegistration,
      status: "CONFIRMED",
      payment: null,
    });
    const res = await POST(makePostRequest(mockPaymentBody), makePaymentParams());
    expect(res.status).toBe(201);
    // No status update because registration is CONFIRMED, not PENDING
    expect(mockPrisma.eventRegistration.update).not.toHaveBeenCalled();
  });

  it("increments receipt sequence when a prior payment exists", async () => {
    mockPrisma.eventPayment.findFirst.mockResolvedValue({ receiptNo: "EVT-GRNW-2026-00003" });
    await POST(makePostRequest(mockPaymentBody), makePaymentParams());
    expect(mockPrisma.eventPayment.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ receiptNo: "EVT-GRNW-2026-00004" }),
      }),
    );
  });

  it("fires audit log with EVENT_PAYMENT_RECORDED on success", async () => {
    await POST(makePostRequest(mockPaymentBody), makePaymentParams());
    expect(mockLogAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        actionType: "EVENT_PAYMENT_RECORDED",
        userId: "admin-1",
        societyId: "soc-1",
        entityType: "EventPayment",
        entityId: "pay-1",
      }),
    );
  });

  it("returns 422 on invalid request body", async () => {
    const res = await POST(
      makePostRequest({ amount: -50, paymentMode: "CASH", paymentDate: "bad" }),
      makePaymentParams(),
    );
    expect(res.status).toBe(422);
  });

  it("returns 500 on database error", async () => {
    mockPrisma.communityEvent.findUnique.mockRejectedValue(new Error("DB error"));
    const res = await POST(makePostRequest(mockPaymentBody), makePaymentParams());
    expect(res.status).toBe(500);
  });
});
