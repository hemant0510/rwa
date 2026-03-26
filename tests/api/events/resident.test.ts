import { NextRequest } from "next/server";

import { describe, it, expect, vi, beforeEach } from "vitest";

const mockPrisma = vi.hoisted(() => ({
  communityEvent: { findMany: vi.fn(), findUnique: vi.fn() },
  eventRegistration: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    aggregate: vi.fn(),
  },
  eventPayment: { aggregate: vi.fn() },
  expense: { findMany: vi.fn() },
}));

const mockGetCurrentUser = vi.hoisted(() => vi.fn());
const mockLogAudit = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/get-current-user", () => ({ getCurrentUser: mockGetCurrentUser }));
vi.mock("@/lib/audit", () => ({ logAudit: mockLogAudit }));

import { GET as GET_EVENTS } from "@/app/api/v1/residents/me/events/route";
// eslint-disable-next-line import/order
import {
  POST as POST_REGISTER,
  DELETE as DELETE_CANCEL,
} from "@/app/api/v1/residents/me/events/[eventId]/register/route";
// eslint-disable-next-line import/order
import { GET as GET_FINANCES } from "@/app/api/v1/residents/me/events/[eventId]/finances/route";

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

function makeDeleteRequest() {
  return new NextRequest("http://localhost/test", { method: "DELETE" });
}

function makeEventParams(eventId = "evt-1") {
  return { params: Promise.resolve({ eventId }) };
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const mockResident = {
  userId: "user-1",
  societyId: "soc-1",
  role: "RESIDENT",
};

const mockPublishedEvent = {
  id: "evt-1",
  societyId: "soc-1",
  title: "Holi Celebration",
  status: "PUBLISHED",
  feeModel: "FIXED",
  feeAmount: 500,
  chargeUnit: "PER_PERSON",
  maxParticipants: null,
  registrationDeadline: null,
  settledAt: null,
  surplusAmount: null,
  surplusDisposal: null,
  deficitDisposition: null,
  _count: { registrations: 10 },
  registrations: [],
};

const mockCompletedSettledEvent = {
  ...mockPublishedEvent,
  status: "COMPLETED",
  settledAt: new Date("2026-04-01"),
  surplusAmount: 3000,
  surplusDisposal: "TRANSFERRED_TO_FUND",
};

const mockRegistration = {
  id: "reg-1",
  eventId: "evt-1",
  userId: "user-1",
  societyId: "soc-1",
  status: "PENDING",
  memberCount: 1,
  payment: null,
  cancelledAt: null,
  cancellationNote: null,
  event: { status: "PUBLISHED", eventDate: new Date("2026-03-20") },
};

// ---------------------------------------------------------------------------
// GET /residents/me/events — list events
// ---------------------------------------------------------------------------

describe("GET /api/v1/residents/me/events", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCurrentUser.mockResolvedValue(mockResident);
    mockPrisma.communityEvent.findMany.mockResolvedValue([
      {
        ...mockPublishedEvent,
        registrations: [{ id: "reg-1", status: "PENDING", memberCount: 1, payment: null }],
      },
    ]);
  });

  it("returns 401 when not authenticated", async () => {
    mockGetCurrentUser.mockResolvedValue(null);
    const res = await GET_EVENTS(makeGetRequest());
    expect(res.status).toBe(401);
  });

  it("returns events list with resident's registration status", async () => {
    const res = await GET_EVENTS(makeGetRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toHaveLength(1);
    expect(body.data[0].myRegistration).toMatchObject({ id: "reg-1", status: "PENDING" });
  });

  it("sets myRegistration to null when resident has no registration", async () => {
    mockPrisma.communityEvent.findMany.mockResolvedValue([
      { ...mockPublishedEvent, registrations: [] },
    ]);
    const res = await GET_EVENTS(makeGetRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data[0].myRegistration).toBeNull();
  });

  it("removes raw registrations array from response", async () => {
    const res = await GET_EVENTS(makeGetRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data[0].registrations).toBeUndefined();
  });

  it("queries by societyId of the resident", async () => {
    await GET_EVENTS(makeGetRequest());
    expect(mockPrisma.communityEvent.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ societyId: "soc-1" }),
      }),
    );
  });

  it("filters to PUBLISHED status by default (no ?all=true)", async () => {
    await GET_EVENTS(makeGetRequest());
    expect(mockPrisma.communityEvent.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: "PUBLISHED" }),
      }),
    );
  });

  it("includes COMPLETED events when ?all=true", async () => {
    await GET_EVENTS(makeGetRequest("all=true"));
    expect(mockPrisma.communityEvent.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: { in: ["PUBLISHED", "COMPLETED"] } }),
      }),
    );
  });

  it("filters by eventDate for upcoming events (default)", async () => {
    await GET_EVENTS(makeGetRequest());
    expect(mockPrisma.communityEvent.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          eventDate: expect.objectContaining({ gte: expect.any(Date) }),
        }),
      }),
    );
  });

  it("returns 500 on database error", async () => {
    mockPrisma.communityEvent.findMany.mockRejectedValue(new Error("DB error"));
    const res = await GET_EVENTS(makeGetRequest());
    expect(res.status).toBe(500);
  });
});

// ---------------------------------------------------------------------------
// POST /residents/me/events/[eventId]/register — register for event
// ---------------------------------------------------------------------------

describe("POST /api/v1/residents/me/events/[eventId]/register", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCurrentUser.mockResolvedValue(mockResident);
    mockPrisma.communityEvent.findUnique.mockResolvedValue(mockPublishedEvent);
    mockPrisma.eventRegistration.findUnique.mockResolvedValue(null);
    mockPrisma.eventRegistration.aggregate.mockResolvedValue({ _sum: { memberCount: 5 } });
    mockPrisma.eventRegistration.create.mockResolvedValue({
      ...mockRegistration,
      status: "PENDING",
    });
  });

  it("returns 401 when not authenticated", async () => {
    mockGetCurrentUser.mockResolvedValue(null);
    const res = await POST_REGISTER(makePostRequest({}), makeEventParams());
    expect(res.status).toBe(401);
  });

  it("returns 404 when event not found", async () => {
    mockPrisma.communityEvent.findUnique.mockResolvedValue(null);
    const res = await POST_REGISTER(makePostRequest({}), makeEventParams());
    expect(res.status).toBe(404);
  });

  it("returns 404 when event belongs to different society", async () => {
    mockPrisma.communityEvent.findUnique.mockResolvedValue({
      ...mockPublishedEvent,
      societyId: "other-soc",
    });
    const res = await POST_REGISTER(makePostRequest({}), makeEventParams());
    expect(res.status).toBe(404);
  });

  it("returns 400 with NOT_PUBLISHED when event is DRAFT", async () => {
    mockPrisma.communityEvent.findUnique.mockResolvedValue({
      ...mockPublishedEvent,
      status: "DRAFT",
    });
    const res = await POST_REGISTER(makePostRequest({}), makeEventParams());
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("NOT_PUBLISHED");
  });

  it("returns 400 with NOT_PUBLISHED when event is COMPLETED", async () => {
    mockPrisma.communityEvent.findUnique.mockResolvedValue({
      ...mockPublishedEvent,
      status: "COMPLETED",
    });
    const res = await POST_REGISTER(makePostRequest({}), makeEventParams());
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("NOT_PUBLISHED");
  });

  it("returns 400 with DEADLINE_PASSED when registration deadline has passed", async () => {
    mockPrisma.communityEvent.findUnique.mockResolvedValue({
      ...mockPublishedEvent,
      registrationDeadline: new Date("2020-01-01"),
    });
    const res = await POST_REGISTER(makePostRequest({}), makeEventParams());
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("DEADLINE_PASSED");
  });

  it("returns 409 with ALREADY_REGISTERED when resident has active registration", async () => {
    mockPrisma.eventRegistration.findUnique.mockResolvedValue({
      ...mockRegistration,
      status: "PENDING",
    });
    const res = await POST_REGISTER(makePostRequest({}), makeEventParams());
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error.code).toBe("ALREADY_REGISTERED");
  });

  it("returns 409 when resident is CONFIRMED", async () => {
    mockPrisma.eventRegistration.findUnique.mockResolvedValue({
      ...mockRegistration,
      status: "CONFIRMED",
    });
    const res = await POST_REGISTER(makePostRequest({}), makeEventParams());
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error.code).toBe("ALREADY_REGISTERED");
  });

  it("returns 409 when resident is INTERESTED", async () => {
    mockPrisma.eventRegistration.findUnique.mockResolvedValue({
      ...mockRegistration,
      status: "INTERESTED",
    });
    const res = await POST_REGISTER(makePostRequest({}), makeEventParams());
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error.code).toBe("ALREADY_REGISTERED");
  });

  it("FREE event → CONFIRMED status", async () => {
    mockPrisma.communityEvent.findUnique.mockResolvedValue({
      ...mockPublishedEvent,
      feeModel: "FREE",
      feeAmount: null,
    });
    mockPrisma.eventRegistration.create.mockResolvedValue({
      ...mockRegistration,
      status: "CONFIRMED",
    });
    const res = await POST_REGISTER(makePostRequest({}), makeEventParams());
    expect(res.status).toBe(201);
    expect(mockPrisma.eventRegistration.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "CONFIRMED" }) }),
    );
  });

  it("FIXED event → PENDING status", async () => {
    const res = await POST_REGISTER(makePostRequest({}), makeEventParams());
    expect(res.status).toBe(201);
    expect(mockPrisma.eventRegistration.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "PENDING" }) }),
    );
  });

  it("FLEXIBLE event with no feeAmount (polling phase) → INTERESTED status", async () => {
    mockPrisma.communityEvent.findUnique.mockResolvedValue({
      ...mockPublishedEvent,
      feeModel: "FLEXIBLE",
      feeAmount: null,
    });
    mockPrisma.eventRegistration.create.mockResolvedValue({
      ...mockRegistration,
      status: "INTERESTED",
    });
    const res = await POST_REGISTER(makePostRequest({}), makeEventParams());
    expect(res.status).toBe(201);
    expect(mockPrisma.eventRegistration.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "INTERESTED" }) }),
    );
  });

  it("FLEXIBLE event with feeAmount set (late joiner) → PENDING status", async () => {
    mockPrisma.communityEvent.findUnique.mockResolvedValue({
      ...mockPublishedEvent,
      feeModel: "FLEXIBLE",
      feeAmount: 400,
    });
    mockPrisma.eventRegistration.create.mockResolvedValue({
      ...mockRegistration,
      status: "PENDING",
    });
    const res = await POST_REGISTER(makePostRequest({}), makeEventParams());
    expect(res.status).toBe(201);
    expect(mockPrisma.eventRegistration.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "PENDING" }) }),
    );
  });

  it("CONTRIBUTION event → CONFIRMED status", async () => {
    mockPrisma.communityEvent.findUnique.mockResolvedValue({
      ...mockPublishedEvent,
      feeModel: "CONTRIBUTION",
      feeAmount: null,
    });
    mockPrisma.eventRegistration.create.mockResolvedValue({
      ...mockRegistration,
      status: "CONFIRMED",
    });
    const res = await POST_REGISTER(makePostRequest({}), makeEventParams());
    expect(res.status).toBe(201);
    expect(mockPrisma.eventRegistration.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "CONFIRMED" }) }),
    );
  });

  it("returns 400 with EVENT_FULL when maxParticipants would be exceeded", async () => {
    mockPrisma.communityEvent.findUnique.mockResolvedValue({
      ...mockPublishedEvent,
      maxParticipants: 10,
    });
    // current 5 + requested 1 = 6 (fine), but let's set it so adding 1 pushes over
    mockPrisma.eventRegistration.aggregate.mockResolvedValue({ _sum: { memberCount: 10 } });
    const res = await POST_REGISTER(makePostRequest({ memberCount: 1 }), makeEventParams());
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("EVENT_FULL");
  });

  it("allows registration exactly at maxParticipants boundary", async () => {
    mockPrisma.communityEvent.findUnique.mockResolvedValue({
      ...mockPublishedEvent,
      maxParticipants: 10,
    });
    // 9 existing + 1 new = 10 (exactly at limit, should pass)
    mockPrisma.eventRegistration.aggregate.mockResolvedValue({ _sum: { memberCount: 9 } });
    const res = await POST_REGISTER(makePostRequest({ memberCount: 1 }), makeEventParams());
    expect(res.status).toBe(201);
  });

  it("PER_HOUSEHOLD event forces memberCount to 1 regardless of input", async () => {
    mockPrisma.communityEvent.findUnique.mockResolvedValue({
      ...mockPublishedEvent,
      chargeUnit: "PER_HOUSEHOLD",
    });
    mockPrisma.eventRegistration.create.mockResolvedValue({ ...mockRegistration, memberCount: 1 });
    await POST_REGISTER(makePostRequest({ memberCount: 5 }), makeEventParams());
    expect(mockPrisma.eventRegistration.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ memberCount: 1 }) }),
    );
  });

  it("re-registers after CANCELLED: updates existing record instead of creating new", async () => {
    const cancelledReg = { ...mockRegistration, status: "CANCELLED" };
    mockPrisma.eventRegistration.findUnique.mockResolvedValue(cancelledReg);
    mockPrisma.eventRegistration.update.mockResolvedValue({
      ...mockRegistration,
      status: "PENDING",
    });
    const res = await POST_REGISTER(makePostRequest({}), makeEventParams());
    expect(res.status).toBe(201);
    expect(mockPrisma.eventRegistration.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "reg-1" },
        data: expect.objectContaining({
          status: "PENDING",
          cancelledAt: null,
          cancellationNote: null,
        }),
      }),
    );
    expect(mockPrisma.eventRegistration.create).not.toHaveBeenCalled();
  });

  it("fires audit log with EVENT_REGISTRATION_CREATED on success", async () => {
    await POST_REGISTER(makePostRequest({}), makeEventParams());
    expect(mockLogAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        actionType: "EVENT_REGISTRATION_CREATED",
        userId: "user-1",
        societyId: "soc-1",
        entityType: "EventRegistration",
        entityId: "reg-1",
      }),
    );
  });

  it("returns 500 on database error", async () => {
    mockPrisma.communityEvent.findUnique.mockRejectedValue(new Error("DB error"));
    const res = await POST_REGISTER(makePostRequest({}), makeEventParams());
    expect(res.status).toBe(500);
  });
});

// ---------------------------------------------------------------------------
// DELETE /residents/me/events/[eventId]/register — cancel registration
// ---------------------------------------------------------------------------

describe("DELETE /api/v1/residents/me/events/[eventId]/register", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCurrentUser.mockResolvedValue(mockResident);
    mockPrisma.eventRegistration.findUnique.mockResolvedValue(mockRegistration);
    mockPrisma.eventRegistration.update.mockResolvedValue({
      ...mockRegistration,
      status: "CANCELLED",
    });
  });

  it("returns 401 when not authenticated", async () => {
    mockGetCurrentUser.mockResolvedValue(null);
    const res = await DELETE_CANCEL(makeDeleteRequest(), makeEventParams());
    expect(res.status).toBe(401);
  });

  it("returns 404 when registration not found", async () => {
    mockPrisma.eventRegistration.findUnique.mockResolvedValue(null);
    const res = await DELETE_CANCEL(makeDeleteRequest(), makeEventParams());
    expect(res.status).toBe(404);
  });

  it("returns 400 with EVENT_NOT_PUBLISHED when event is COMPLETED", async () => {
    mockPrisma.eventRegistration.findUnique.mockResolvedValue({
      ...mockRegistration,
      event: { status: "COMPLETED", eventDate: new Date("2026-03-20") },
    });
    const res = await DELETE_CANCEL(makeDeleteRequest(), makeEventParams());
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("EVENT_NOT_PUBLISHED");
  });

  it("returns 400 with EVENT_NOT_PUBLISHED when event is CANCELLED", async () => {
    mockPrisma.eventRegistration.findUnique.mockResolvedValue({
      ...mockRegistration,
      event: { status: "CANCELLED", eventDate: new Date("2026-03-20") },
    });
    const res = await DELETE_CANCEL(makeDeleteRequest(), makeEventParams());
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("EVENT_NOT_PUBLISHED");
  });

  it("returns 400 with HAS_PAYMENT when CONFIRMED registration has a payment", async () => {
    mockPrisma.eventRegistration.findUnique.mockResolvedValue({
      ...mockRegistration,
      status: "CONFIRMED",
      payment: { id: "pay-1", amount: 500 },
    });
    const res = await DELETE_CANCEL(makeDeleteRequest(), makeEventParams());
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("HAS_PAYMENT");
  });

  it("returns 400 with CANNOT_CANCEL for CONFIRMED registration without payment", async () => {
    mockPrisma.eventRegistration.findUnique.mockResolvedValue({
      ...mockRegistration,
      status: "CONFIRMED",
      payment: null,
    });
    const res = await DELETE_CANCEL(makeDeleteRequest(), makeEventParams());
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("CANNOT_CANCEL");
  });

  it("cancels INTERESTED registration successfully", async () => {
    mockPrisma.eventRegistration.findUnique.mockResolvedValue({
      ...mockRegistration,
      status: "INTERESTED",
      payment: null,
    });
    const res = await DELETE_CANCEL(makeDeleteRequest(), makeEventParams());
    expect(res.status).toBe(200);
    expect(mockPrisma.eventRegistration.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "CANCELLED", cancelledAt: expect.any(Date) }),
      }),
    );
  });

  it("cancels PENDING registration successfully", async () => {
    const res = await DELETE_CANCEL(makeDeleteRequest(), makeEventParams());
    expect(res.status).toBe(200);
    expect(mockPrisma.eventRegistration.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "CANCELLED" }),
      }),
    );
  });

  it("returns 400 CANNOT_CANCEL for CANCELLED registration", async () => {
    mockPrisma.eventRegistration.findUnique.mockResolvedValue({
      ...mockRegistration,
      status: "CANCELLED",
      payment: null,
    });
    const res = await DELETE_CANCEL(makeDeleteRequest(), makeEventParams());
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("CANNOT_CANCEL");
  });

  it("fires audit log with EVENT_REGISTRATION_CANCELLED on success", async () => {
    await DELETE_CANCEL(makeDeleteRequest(), makeEventParams());
    expect(mockLogAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        actionType: "EVENT_REGISTRATION_CANCELLED",
        userId: "user-1",
        societyId: "soc-1",
        entityType: "EventRegistration",
        entityId: "reg-1",
      }),
    );
  });

  it("returns 500 on database error", async () => {
    mockPrisma.eventRegistration.findUnique.mockRejectedValue(new Error("DB error"));
    const res = await DELETE_CANCEL(makeDeleteRequest(), makeEventParams());
    expect(res.status).toBe(500);
  });
});

// ---------------------------------------------------------------------------
// GET /residents/me/events/[eventId]/finances — resident event finances
// ---------------------------------------------------------------------------

describe("GET /api/v1/residents/me/events/[eventId]/finances", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCurrentUser.mockResolvedValue(mockResident);
    mockPrisma.communityEvent.findUnique.mockResolvedValue(mockCompletedSettledEvent);
    mockPrisma.eventPayment.aggregate.mockResolvedValue({ _sum: { amount: 20000 } });
    mockPrisma.expense.findMany.mockResolvedValue([
      { description: "DJ System", amount: 8000 },
      { description: "Decorations", amount: 4000 },
    ]);
  });

  it("returns 401 when not authenticated", async () => {
    mockGetCurrentUser.mockResolvedValue(null);
    const res = await GET_FINANCES(makeGetRequest(), makeEventParams());
    expect(res.status).toBe(401);
  });

  it("returns 404 when event not found", async () => {
    mockPrisma.communityEvent.findUnique.mockResolvedValue(null);
    const res = await GET_FINANCES(makeGetRequest(), makeEventParams());
    expect(res.status).toBe(404);
  });

  it("returns 404 when event belongs to different society", async () => {
    mockPrisma.communityEvent.findUnique.mockResolvedValue({
      ...mockCompletedSettledEvent,
      societyId: "other-soc",
    });
    const res = await GET_FINANCES(makeGetRequest(), makeEventParams());
    expect(res.status).toBe(404);
  });

  it("returns 403 when event is still PUBLISHED (not settled)", async () => {
    mockPrisma.communityEvent.findUnique.mockResolvedValue(mockPublishedEvent);
    const res = await GET_FINANCES(makeGetRequest(), makeEventParams());
    expect(res.status).toBe(403);
  });

  it("returns 403 when event is COMPLETED but not yet settled (no settledAt)", async () => {
    mockPrisma.communityEvent.findUnique.mockResolvedValue({
      ...mockPublishedEvent,
      status: "COMPLETED",
      settledAt: null,
    });
    const res = await GET_FINANCES(makeGetRequest(), makeEventParams());
    expect(res.status).toBe(403);
  });

  it("returns financial summary for settled event", async () => {
    const res = await GET_FINANCES(makeGetRequest(), makeEventParams());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.totalCollected).toBe(20000);
    expect(body.totalExpenses).toBe(12000);
    expect(body.netAmount).toBe(8000);
    expect(body.expenses).toHaveLength(2);
  });

  it("returns only description and amount in expenses (not category or date)", async () => {
    const res = await GET_FINANCES(makeGetRequest(), makeEventParams());
    expect(res.status).toBe(200);
    const body = await res.json();
    const expense = body.expenses[0];
    expect(expense).toHaveProperty("description");
    expect(expense).toHaveProperty("amount");
    expect(expense).not.toHaveProperty("category");
    expect(expense).not.toHaveProperty("date");
    expect(expense).not.toHaveProperty("id");
  });

  it("returns surplusDisposal as disposition when surplus is positive", async () => {
    const res = await GET_FINANCES(makeGetRequest(), makeEventParams());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.disposition).toBe("TRANSFERRED_TO_FUND");
  });

  it("returns deficitDisposition as disposition when there is a deficit", async () => {
    mockPrisma.communityEvent.findUnique.mockResolvedValue({
      ...mockCompletedSettledEvent,
      surplusAmount: -3000,
      surplusDisposal: null,
      deficitDisposition: "FROM_SOCIETY_FUND",
    });
    const res = await GET_FINANCES(makeGetRequest(), makeEventParams());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.disposition).toBe("FROM_SOCIETY_FUND");
  });

  it("returns zero totalCollected when no payments", async () => {
    mockPrisma.eventPayment.aggregate.mockResolvedValue({ _sum: { amount: null } });
    const res = await GET_FINANCES(makeGetRequest(), makeEventParams());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.totalCollected).toBe(0);
  });

  it("returns 500 on database error", async () => {
    mockPrisma.communityEvent.findUnique.mockRejectedValue(new Error("DB error"));
    const res = await GET_FINANCES(makeGetRequest(), makeEventParams());
    expect(res.status).toBe(500);
  });
});
