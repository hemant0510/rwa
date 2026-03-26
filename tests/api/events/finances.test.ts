import { NextRequest } from "next/server";

import { describe, it, expect, vi, beforeEach } from "vitest";

const mockPrisma = vi.hoisted(() => ({
  communityEvent: { findUnique: vi.fn(), update: vi.fn() },
  eventRegistration: { findMany: vi.fn() },
  eventPayment: { aggregate: vi.fn() },
  expense: { findMany: vi.fn(), create: vi.fn(), aggregate: vi.fn() },
}));

const mockGetCurrentUser = vi.hoisted(() => vi.fn());
const mockLogAudit = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/get-current-user", () => ({ getCurrentUser: mockGetCurrentUser }));
vi.mock("@/lib/audit", () => ({ logAudit: mockLogAudit }));

import { GET } from "@/app/api/v1/societies/[id]/events/[eventId]/finances/route";
// eslint-disable-next-line import/order
import { POST as POST_EXPENSE } from "@/app/api/v1/societies/[id]/events/[eventId]/expenses/route";

import { POST as POST_SETTLE } from "@/app/api/v1/societies/[id]/events/[eventId]/settle/route";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeGetRequest() {
  return new NextRequest("http://localhost/test");
}

function makePostRequest(body: unknown) {
  return new NextRequest("http://localhost/test", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

function makeParams(id = "soc-1", eventId = "evt-1") {
  return { params: Promise.resolve({ id, eventId }) };
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const mockPublishedEvent = {
  id: "evt-1",
  societyId: "soc-1",
  title: "Holi Celebration",
  status: "PUBLISHED",
  feeModel: "FIXED",
  feeAmount: 500,
  chargeUnit: "PER_PERSON",
  settledAt: null,
  surplusAmount: null,
  surplusDisposal: null,
  deficitDisposition: null,
  settlementNotes: null,
};

const mockCompletedEvent = {
  ...mockPublishedEvent,
  status: "COMPLETED",
};

const mockExpenses = [
  {
    id: "exp-1",
    description: "DJ System",
    amount: 8000,
    category: "OTHER",
    date: new Date("2026-03-15"),
  },
  {
    id: "exp-2",
    description: "Decorations",
    amount: 4000,
    category: "OTHER",
    date: new Date("2026-03-15"),
  },
];

const mockExpenseBody = {
  date: "2026-03-15",
  amount: 8000,
  category: "OTHER",
  description: "DJ System rental",
};

// ---------------------------------------------------------------------------
// GET /finances
// ---------------------------------------------------------------------------

describe("GET /api/v1/societies/[id]/events/[eventId]/finances", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.communityEvent.findUnique.mockResolvedValue(mockPublishedEvent);
    mockPrisma.eventPayment.aggregate.mockResolvedValue({ _sum: { amount: 15000 } });
    mockPrisma.expense.findMany.mockResolvedValue(mockExpenses);
    // FREE/CONTRIBUTION events return [] for pendingRegs
    mockPrisma.eventRegistration.findMany.mockResolvedValue([]);
  });

  it("returns 404 when event not found", async () => {
    mockPrisma.communityEvent.findUnique.mockResolvedValue(null);
    const res = await GET(makeGetRequest(), makeParams());
    expect(res.status).toBe(404);
  });

  it("returns 404 when event belongs to different society", async () => {
    mockPrisma.communityEvent.findUnique.mockResolvedValue({
      ...mockPublishedEvent,
      societyId: "other-soc",
    });
    const res = await GET(makeGetRequest(), makeParams());
    expect(res.status).toBe(404);
  });

  it("returns financial summary with correct calculations", async () => {
    const res = await GET(makeGetRequest(), makeParams());
    expect(res.status).toBe(200);
    const body = await res.json();
    // totalCollected = 15000, totalExpenses = 8000 + 4000 = 12000, net = 3000
    expect(body.totalCollected).toBe(15000);
    expect(body.totalExpenses).toBe(12000);
    expect(body.netAmount).toBe(3000);
    expect(body.expenses).toHaveLength(2);
    expect(body.isSettled).toBe(false);
    expect(body.settledAt).toBeNull();
  });

  it("returns zero totalCollected when no payments", async () => {
    mockPrisma.eventPayment.aggregate.mockResolvedValue({ _sum: { amount: null } });
    const res = await GET(makeGetRequest(), makeParams());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.totalCollected).toBe(0);
  });

  it("calculates pendingAmount for FIXED PER_PERSON events", async () => {
    mockPrisma.eventRegistration.findMany.mockResolvedValue([
      { memberCount: 2 },
      { memberCount: 1 },
    ]);
    const res = await GET(makeGetRequest(), makeParams());
    expect(res.status).toBe(200);
    const body = await res.json();
    // 3 total members × 500 per person = 1500 pending
    expect(body.pendingAmount).toBe(1500);
  });

  it("calculates pendingAmount for FIXED PER_HOUSEHOLD events", async () => {
    mockPrisma.communityEvent.findUnique.mockResolvedValue({
      ...mockPublishedEvent,
      feeAmount: 500,
      chargeUnit: "PER_HOUSEHOLD",
    });
    mockPrisma.eventRegistration.findMany.mockResolvedValue([
      { memberCount: 3 },
      { memberCount: 2 },
    ]);
    const res = await GET(makeGetRequest(), makeParams());
    expect(res.status).toBe(200);
    const body = await res.json();
    // 2 households × 500 = 1000 pending
    expect(body.pendingAmount).toBe(1000);
  });

  it("returns pendingAmount of 0 for FREE events", async () => {
    mockPrisma.communityEvent.findUnique.mockResolvedValue({
      ...mockPublishedEvent,
      feeModel: "FREE",
      feeAmount: null,
    });
    const res = await GET(makeGetRequest(), makeParams());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.pendingAmount).toBe(0);
  });

  it("returns surplusAmount and settlement info for settled events", async () => {
    mockPrisma.communityEvent.findUnique.mockResolvedValue({
      ...mockCompletedEvent,
      settledAt: new Date("2026-04-01"),
      surplusAmount: 3000,
      surplusDisposal: "TRANSFERRED_TO_FUND",
      deficitDisposition: null,
      settlementNotes: "Settled after Holi",
    });
    const res = await GET(makeGetRequest(), makeParams());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.isSettled).toBe(true);
    expect(body.surplusAmount).toBe(3000);
    expect(body.surplusDisposal).toBe("TRANSFERRED_TO_FUND");
    expect(body.settlementNotes).toBe("Settled after Holi");
  });

  it("returns 500 on database error", async () => {
    mockPrisma.communityEvent.findUnique.mockRejectedValue(new Error("DB error"));
    const res = await GET(makeGetRequest(), makeParams());
    expect(res.status).toBe(500);
  });
});

// ---------------------------------------------------------------------------
// POST /expenses — add event expense
// ---------------------------------------------------------------------------

describe("POST /api/v1/societies/[id]/events/[eventId]/expenses", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCurrentUser.mockResolvedValue({ userId: "admin-1", role: "RWA_ADMIN" });
    mockPrisma.communityEvent.findUnique.mockResolvedValue(mockPublishedEvent);
    mockPrisma.expense.create.mockResolvedValue({
      id: "exp-1",
      societyId: "soc-1",
      eventId: "evt-1",
      amount: 8000,
      category: "OTHER",
      description: "DJ System rental",
      date: new Date("2026-03-15"),
      receiptUrl: null,
      loggedBy: "admin-1",
    });
  });

  it("returns 401 when not authenticated", async () => {
    mockGetCurrentUser.mockResolvedValue(null);
    const res = await POST_EXPENSE(makePostRequest(mockExpenseBody), makeParams());
    expect(res.status).toBe(401);
  });

  it("returns 404 when event not found", async () => {
    mockPrisma.communityEvent.findUnique.mockResolvedValue(null);
    const res = await POST_EXPENSE(makePostRequest(mockExpenseBody), makeParams());
    expect(res.status).toBe(404);
  });

  it("returns 404 when event belongs to different society", async () => {
    mockPrisma.communityEvent.findUnique.mockResolvedValue({
      ...mockPublishedEvent,
      societyId: "other-soc",
    });
    const res = await POST_EXPENSE(makePostRequest(mockExpenseBody), makeParams());
    expect(res.status).toBe(404);
  });

  it("returns 400 with INVALID_STATUS for DRAFT events", async () => {
    mockPrisma.communityEvent.findUnique.mockResolvedValue({
      ...mockPublishedEvent,
      status: "DRAFT",
    });
    const res = await POST_EXPENSE(makePostRequest(mockExpenseBody), makeParams());
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("INVALID_STATUS");
  });

  it("returns 400 with INVALID_STATUS for CANCELLED events", async () => {
    mockPrisma.communityEvent.findUnique.mockResolvedValue({
      ...mockPublishedEvent,
      status: "CANCELLED",
    });
    const res = await POST_EXPENSE(makePostRequest(mockExpenseBody), makeParams());
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("INVALID_STATUS");
  });

  it("creates expense for PUBLISHED event and returns 201", async () => {
    const res = await POST_EXPENSE(makePostRequest(mockExpenseBody), makeParams());
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.id).toBe("exp-1");
    expect(body.eventId).toBe("evt-1");
  });

  it("creates expense for COMPLETED event", async () => {
    mockPrisma.communityEvent.findUnique.mockResolvedValue(mockCompletedEvent);
    const res = await POST_EXPENSE(makePostRequest(mockExpenseBody), makeParams());
    expect(res.status).toBe(201);
  });

  it("links expense to eventId", async () => {
    await POST_EXPENSE(makePostRequest(mockExpenseBody), makeParams());
    expect(mockPrisma.expense.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ eventId: "evt-1", societyId: "soc-1" }),
      }),
    );
  });

  it("sets 24h correction window on expense", async () => {
    await POST_EXPENSE(makePostRequest(mockExpenseBody), makeParams());
    expect(mockPrisma.expense.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ correctionWindowEnds: expect.any(Date) }),
      }),
    );
  });

  it("fires audit log with EVENT_EXPENSE_ADDED on success", async () => {
    await POST_EXPENSE(makePostRequest(mockExpenseBody), makeParams());
    expect(mockLogAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        actionType: "EVENT_EXPENSE_ADDED",
        userId: "admin-1",
        societyId: "soc-1",
        entityType: "Expense",
        entityId: "exp-1",
      }),
    );
  });

  it("returns 422 on invalid body", async () => {
    const res = await POST_EXPENSE(
      makePostRequest({ amount: -100, date: "bad", category: "INVALID" }),
      makeParams(),
    );
    expect(res.status).toBe(422);
  });

  it("returns 500 on database error", async () => {
    mockPrisma.communityEvent.findUnique.mockRejectedValue(new Error("DB error"));
    const res = await POST_EXPENSE(makePostRequest(mockExpenseBody), makeParams());
    expect(res.status).toBe(500);
  });
});

// ---------------------------------------------------------------------------
// POST /settle — settle event
// ---------------------------------------------------------------------------

describe("POST /api/v1/societies/[id]/events/[eventId]/settle", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCurrentUser.mockResolvedValue({ userId: "admin-1", role: "RWA_ADMIN" });
    mockPrisma.communityEvent.findUnique.mockResolvedValue(mockCompletedEvent);
    mockPrisma.eventPayment.aggregate.mockResolvedValue({ _sum: { amount: 20000 } });
    mockPrisma.expense.aggregate.mockResolvedValue({ _sum: { amount: 12000 } });
    mockPrisma.communityEvent.update.mockResolvedValue({
      ...mockCompletedEvent,
      settledAt: new Date(),
      surplusAmount: 8000,
      surplusDisposal: "TRANSFERRED_TO_FUND",
      deficitDisposition: null,
      settlementNotes: null,
      creator: { name: "Admin User" },
    });
  });

  it("returns 401 when not authenticated", async () => {
    mockGetCurrentUser.mockResolvedValue(null);
    const res = await POST_SETTLE(makePostRequest({}), makeParams());
    expect(res.status).toBe(401);
  });

  it("returns 404 when event not found", async () => {
    mockPrisma.communityEvent.findUnique.mockResolvedValue(null);
    const res = await POST_SETTLE(makePostRequest({}), makeParams());
    expect(res.status).toBe(404);
  });

  it("returns 404 when event belongs to different society", async () => {
    mockPrisma.communityEvent.findUnique.mockResolvedValue({
      ...mockCompletedEvent,
      societyId: "other-soc",
    });
    const res = await POST_SETTLE(makePostRequest({}), makeParams());
    expect(res.status).toBe(404);
  });

  it("returns 400 with NOT_COMPLETED for PUBLISHED event", async () => {
    mockPrisma.communityEvent.findUnique.mockResolvedValue(mockPublishedEvent);
    const res = await POST_SETTLE(makePostRequest({}), makeParams());
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("NOT_COMPLETED");
  });

  it("returns 400 with NOT_COMPLETED for DRAFT event", async () => {
    mockPrisma.communityEvent.findUnique.mockResolvedValue({
      ...mockPublishedEvent,
      status: "DRAFT",
    });
    const res = await POST_SETTLE(makePostRequest({}), makeParams());
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("NOT_COMPLETED");
  });

  it("settles event and returns 200 with updated event", async () => {
    const res = await POST_SETTLE(
      makePostRequest({ surplusDisposal: "TRANSFERRED_TO_FUND" }),
      makeParams(),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.surplusAmount).toBe(8000);
    expect(body.surplusDisposal).toBe("TRANSFERRED_TO_FUND");
  });

  it("calculates surplusAmount as totalCollected minus totalExpenses", async () => {
    // 20000 collected - 12000 expenses = 8000 surplus
    await POST_SETTLE(makePostRequest({}), makeParams());
    expect(mockPrisma.communityEvent.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ surplusAmount: 8000 }),
      }),
    );
  });

  it("sets negative surplusAmount when expenses exceed collections", async () => {
    mockPrisma.eventPayment.aggregate.mockResolvedValue({ _sum: { amount: 5000 } });
    mockPrisma.expense.aggregate.mockResolvedValue({ _sum: { amount: 8000 } });
    mockPrisma.communityEvent.update.mockResolvedValue({
      ...mockCompletedEvent,
      settledAt: new Date(),
      surplusAmount: -3000,
      surplusDisposal: null,
      deficitDisposition: "FROM_SOCIETY_FUND",
      creator: { name: "Admin User" },
    });
    const res = await POST_SETTLE(
      makePostRequest({ deficitDisposition: "FROM_SOCIETY_FUND" }),
      makeParams(),
    );
    expect(res.status).toBe(200);
    expect(mockPrisma.communityEvent.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ surplusAmount: -3000 }),
      }),
    );
  });

  it("does not set surplusDisposal when there is no surplus", async () => {
    mockPrisma.eventPayment.aggregate.mockResolvedValue({ _sum: { amount: 5000 } });
    mockPrisma.expense.aggregate.mockResolvedValue({ _sum: { amount: 8000 } });
    mockPrisma.communityEvent.update.mockResolvedValue({
      ...mockCompletedEvent,
      settledAt: new Date(),
      surplusAmount: -3000,
      surplusDisposal: null,
      deficitDisposition: null,
      creator: { name: "Admin User" },
    });
    await POST_SETTLE(makePostRequest({ surplusDisposal: "REFUNDED" }), makeParams());
    expect(mockPrisma.communityEvent.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ surplusDisposal: null }),
      }),
    );
  });

  it("does not set deficitDisposition when there is a surplus", async () => {
    await POST_SETTLE(makePostRequest({ deficitDisposition: "FROM_SOCIETY_FUND" }), makeParams());
    expect(mockPrisma.communityEvent.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ deficitDisposition: null }),
      }),
    );
  });

  it("handles null payment aggregate gracefully (zero collections)", async () => {
    mockPrisma.eventPayment.aggregate.mockResolvedValue({ _sum: { amount: null } });
    mockPrisma.expense.aggregate.mockResolvedValue({ _sum: { amount: null } });
    mockPrisma.communityEvent.update.mockResolvedValue({
      ...mockCompletedEvent,
      settledAt: new Date(),
      surplusAmount: 0,
      surplusDisposal: null,
      deficitDisposition: null,
      creator: { name: "Admin User" },
    });
    await POST_SETTLE(makePostRequest({}), makeParams());
    expect(mockPrisma.communityEvent.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ surplusAmount: 0 }),
      }),
    );
  });

  it("fires audit log with EVENT_SETTLED on success", async () => {
    await POST_SETTLE(makePostRequest({}), makeParams());
    expect(mockLogAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        actionType: "EVENT_SETTLED",
        userId: "admin-1",
        societyId: "soc-1",
        entityType: "CommunityEvent",
        entityId: "evt-1",
      }),
    );
  });

  it("returns 422 on invalid body (bad surplusDisposal)", async () => {
    const res = await POST_SETTLE(
      makePostRequest({ surplusDisposal: "INVALID_VALUE" }),
      makeParams(),
    );
    expect(res.status).toBe(422);
  });

  it("returns 500 on database error", async () => {
    mockPrisma.communityEvent.findUnique.mockRejectedValue(new Error("DB error"));
    const res = await POST_SETTLE(makePostRequest({}), makeParams());
    expect(res.status).toBe(500);
  });
});
