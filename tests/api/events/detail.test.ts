import { NextRequest } from "next/server";

import { describe, it, expect, vi, beforeEach } from "vitest";

const mockPrisma = vi.hoisted(() => ({
  communityEvent: {
    findMany: vi.fn(),
    count: vi.fn(),
    create: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  eventRegistration: {
    count: vi.fn(),
    updateMany: vi.fn(),
    findMany: vi.fn(),
    aggregate: vi.fn(),
  },
  expense: { aggregate: vi.fn() },
  eventPayment: { aggregate: vi.fn() },
  society: { findUnique: vi.fn() },
  $transaction: vi.fn(),
}));

const mockGetCurrentUser = vi.hoisted(() => vi.fn());
const mockLogAudit = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/get-current-user", () => ({ getCurrentUser: mockGetCurrentUser }));
vi.mock("@/lib/audit", () => ({ logAudit: mockLogAudit }));

import { GET, PATCH, DELETE } from "@/app/api/v1/societies/[id]/events/[eventId]/route";

function makeGetRequest() {
  return new NextRequest("http://localhost/test");
}

function makePatchRequest(body: unknown) {
  return new NextRequest("http://localhost/test", {
    method: "PATCH",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

function makeDeleteRequest() {
  return new NextRequest("http://localhost/test", { method: "DELETE" });
}

function makeParams(id = "soc-1", eventId = "evt-1") {
  return { params: Promise.resolve({ id, eventId }) };
}

const mockAdmin = {
  userId: "admin-1",
  authUserId: "auth-admin-1",
  societyId: "soc-1",
  role: "RWA_ADMIN" as const,
  adminPermission: "FULL_ACCESS" as const,
};

const mockDraftEvent = {
  id: "evt-1",
  societyId: "soc-1",
  title: "Holi Festival",
  description: "Annual celebration",
  category: "FESTIVAL",
  feeModel: "FREE",
  chargeUnit: "PER_HOUSEHOLD",
  status: "DRAFT",
  eventDate: new Date("2026-03-25"),
  location: "Community Hall",
  registrationDeadline: null,
  feeAmount: null,
  estimatedBudget: null,
  minParticipants: null,
  maxParticipants: null,
  suggestedAmount: null,
  createdBy: "admin-1",
  publishedAt: null,
  paymentTriggeredAt: null,
  cancellationReason: null,
  createdAt: new Date(),
  updatedAt: new Date(),
  creator: { name: "Admin User" },
  registrations: [],
};

const mockPublishedEvent = {
  ...mockDraftEvent,
  status: "PUBLISHED",
  publishedAt: new Date(),
};

// ── GET /events/[eventId] (detail) ────────────────────────────────────────────

describe("GET /api/v1/societies/[id]/events/[eventId] — event detail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.communityEvent.findUnique.mockResolvedValue(mockDraftEvent);
    mockPrisma.expense.aggregate.mockResolvedValue({ _sum: { amount: null } });
    mockPrisma.eventPayment.aggregate.mockResolvedValue({ _sum: { amount: null } });
  });

  it("returns event with financeSummary", async () => {
    const res = await GET(makeGetRequest(), makeParams());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe("evt-1");
    expect(body.financeSummary).toBeDefined();
    expect(body.financeSummary.totalCollected).toBe(0);
    expect(body.financeSummary.totalExpenses).toBe(0);
    expect(body.financeSummary.netAmount).toBe(0);
  });

  it("computes financial summary correctly", async () => {
    mockPrisma.eventPayment.aggregate.mockResolvedValue({ _sum: { amount: 5000 } });
    mockPrisma.expense.aggregate.mockResolvedValue({ _sum: { amount: 3000 } });
    const res = await GET(makeGetRequest(), makeParams());
    const body = await res.json();
    expect(body.financeSummary.totalCollected).toBe(5000);
    expect(body.financeSummary.totalExpenses).toBe(3000);
    expect(body.financeSummary.netAmount).toBe(2000);
  });

  it("handles null aggregate sums (no expenses/payments yet)", async () => {
    mockPrisma.eventPayment.aggregate.mockResolvedValue({ _sum: { amount: null } });
    mockPrisma.expense.aggregate.mockResolvedValue({ _sum: { amount: null } });
    const res = await GET(makeGetRequest(), makeParams());
    const body = await res.json();
    expect(body.financeSummary.totalCollected).toBe(0);
    expect(body.financeSummary.totalExpenses).toBe(0);
    expect(body.financeSummary.netAmount).toBe(0);
  });

  it("returns 404 when event not found", async () => {
    mockPrisma.communityEvent.findUnique.mockResolvedValue(null);
    const res = await GET(makeGetRequest(), makeParams());
    expect(res.status).toBe(404);
  });

  it("returns 404 when event belongs to different society", async () => {
    mockPrisma.communityEvent.findUnique.mockResolvedValue({
      ...mockDraftEvent,
      societyId: "other-soc",
    });
    const res = await GET(makeGetRequest(), makeParams("soc-1", "evt-1"));
    expect(res.status).toBe(404);
  });

  it("queries expense aggregate with ACTIVE status filter", async () => {
    await GET(makeGetRequest(), makeParams());
    expect(mockPrisma.expense.aggregate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { eventId: "evt-1", status: "ACTIVE" },
        _sum: { amount: true },
      }),
    );
  });

  it("includes registrations with user and payment details", async () => {
    await GET(makeGetRequest(), makeParams());
    expect(mockPrisma.communityEvent.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        include: expect.objectContaining({
          registrations: expect.objectContaining({
            include: expect.objectContaining({
              user: expect.anything(),
              payment: true,
            }),
          }),
        }),
      }),
    );
  });

  it("returns 500 on database error", async () => {
    mockPrisma.communityEvent.findUnique.mockRejectedValue(new Error("DB crash"));
    const res = await GET(makeGetRequest(), makeParams());
    expect(res.status).toBe(500);
  });
});

// ── PATCH /events/[eventId] (update) ─────────────────────────────────────────

describe("PATCH /api/v1/societies/[id]/events/[eventId] — update event", () => {
  const updatedEvent = {
    ...mockDraftEvent,
    title: "Updated Holi Festival",
    creator: { name: "Admin User" },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCurrentUser.mockResolvedValue(mockAdmin);
    mockPrisma.communityEvent.findUnique.mockResolvedValue(mockDraftEvent);
    mockPrisma.communityEvent.update.mockResolvedValue(updatedEvent);
  });

  it("returns 401 when not authenticated", async () => {
    mockGetCurrentUser.mockResolvedValue(null);
    const res = await PATCH(makePatchRequest({ title: "New Title" }), makeParams());
    expect(res.status).toBe(401);
  });

  it("returns 404 when event not found", async () => {
    mockPrisma.communityEvent.findUnique.mockResolvedValue(null);
    const res = await PATCH(makePatchRequest({ title: "New Title" }), makeParams());
    expect(res.status).toBe(404);
  });

  it("returns 404 when event belongs to different society", async () => {
    mockPrisma.communityEvent.findUnique.mockResolvedValue({
      ...mockDraftEvent,
      societyId: "other-soc",
    });
    const res = await PATCH(makePatchRequest({ title: "New Title" }), makeParams("soc-1", "evt-1"));
    expect(res.status).toBe(404);
  });

  it("returns 400 with NOT_DRAFT when event is PUBLISHED", async () => {
    mockPrisma.communityEvent.findUnique.mockResolvedValue(mockPublishedEvent);
    const res = await PATCH(makePatchRequest({ title: "New Title" }), makeParams());
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("NOT_DRAFT");
  });

  it("returns 400 with NOT_DRAFT when event is CANCELLED", async () => {
    mockPrisma.communityEvent.findUnique.mockResolvedValue({
      ...mockDraftEvent,
      status: "CANCELLED",
    });
    const res = await PATCH(makePatchRequest({ title: "New Title" }), makeParams());
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("NOT_DRAFT");
  });

  it("returns 400 with NOT_DRAFT when event is COMPLETED", async () => {
    mockPrisma.communityEvent.findUnique.mockResolvedValue({
      ...mockDraftEvent,
      status: "COMPLETED",
    });
    const res = await PATCH(makePatchRequest({ title: "New Title" }), makeParams());
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("NOT_DRAFT");
  });

  it("updates DRAFT event title successfully", async () => {
    const res = await PATCH(makePatchRequest({ title: "Updated Holi Festival" }), makeParams());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.title).toBe("Updated Holi Festival");
  });

  it("calls update with the correct eventId in where clause", async () => {
    await PATCH(makePatchRequest({ title: "New Title" }), makeParams("soc-1", "evt-99"));
    expect(mockPrisma.communityEvent.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "evt-99" } }),
    );
  });

  it("recomputes chargeUnit to PER_HOUSEHOLD when feeModel changed to FREE", async () => {
    mockPrisma.communityEvent.findUnique.mockResolvedValue({
      ...mockDraftEvent,
      feeModel: "FIXED",
      feeAmount: 200,
    });
    await PATCH(makePatchRequest({ feeModel: "FREE" }), makeParams());
    expect(mockPrisma.communityEvent.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ chargeUnit: "PER_HOUSEHOLD" }),
      }),
    );
  });

  it("uses provided chargeUnit when feeModel is not FREE", async () => {
    await PATCH(makePatchRequest({ chargeUnit: "PER_HOUSEHOLD" }), makeParams());
    expect(mockPrisma.communityEvent.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ chargeUnit: "PER_HOUSEHOLD" }),
      }),
    );
  });

  it("inherits existing feeModel when not changing it (FREE → stays FREE → PER_HOUSEHOLD)", async () => {
    // event is already FREE; patch only changes title
    await PATCH(makePatchRequest({ title: "New name" }), makeParams());
    expect(mockPrisma.communityEvent.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ chargeUnit: "PER_HOUSEHOLD" }),
      }),
    );
  });

  it("updates all optional fields in a single PATCH call", async () => {
    mockPrisma.communityEvent.findUnique.mockResolvedValue({
      ...mockDraftEvent,
      feeModel: "FIXED",
    });
    const allFields = {
      title: "New Title",
      description: "New desc",
      category: "SPORTS",
      feeModel: "FIXED",
      eventDate: "2026-12-25T10:00:00Z",
      location: "Club House",
      registrationDeadline: "2026-12-20T10:00:00Z",
      feeAmount: 500,
      estimatedBudget: 10000,
      minParticipants: 10,
      maxParticipants: 50,
      suggestedAmount: 200,
    };
    await PATCH(makePatchRequest(allFields), makeParams());
    const updateCall = mockPrisma.communityEvent.update.mock.calls[0][0];
    expect(updateCall.data.title).toBe("New Title");
    expect(updateCall.data.description).toBe("New desc");
    expect(updateCall.data.category).toBe("SPORTS");
    expect(updateCall.data.feeAmount).toBe(500);
    expect(updateCall.data.estimatedBudget).toBe(10000);
    expect(updateCall.data.minParticipants).toBe(10);
    expect(updateCall.data.maxParticipants).toBe(50);
    expect(updateCall.data.suggestedAmount).toBe(200);
    expect(updateCall.data.location).toBe("Club House");
  });

  it("sets registrationDeadline to null when passed as null", async () => {
    mockPrisma.communityEvent.findUnique.mockResolvedValue({
      ...mockDraftEvent,
      feeModel: "FIXED",
    });
    await PATCH(makePatchRequest({ registrationDeadline: null }), makeParams());
    const updateCall = mockPrisma.communityEvent.update.mock.calls[0][0];
    expect(updateCall.data.registrationDeadline).toBeNull();
  });

  it("fires audit log EVENT_UPDATED after successful update", async () => {
    await PATCH(makePatchRequest({ title: "Updated" }), makeParams());
    expect(mockLogAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        actionType: "EVENT_UPDATED",
        userId: "admin-1",
        societyId: "soc-1",
        entityType: "CommunityEvent",
        entityId: "evt-1",
      }),
    );
  });

  it("does not fire audit log on failure", async () => {
    mockPrisma.communityEvent.findUnique.mockRejectedValue(new Error("DB error"));
    await PATCH(makePatchRequest({ title: "Updated" }), makeParams());
    expect(mockLogAudit).not.toHaveBeenCalled();
  });

  it("returns 422 when no fields are provided (empty body fails refine)", async () => {
    const res = await PATCH(makePatchRequest({}), makeParams());
    expect(res.status).toBe(422);
  });

  it("returns 500 on database error during update", async () => {
    mockPrisma.communityEvent.update.mockRejectedValue(new Error("DB crash"));
    const res = await PATCH(makePatchRequest({ title: "New Title" }), makeParams());
    expect(res.status).toBe(500);
  });
});

// ── DELETE /events/[eventId] ──────────────────────────────────────────────────

describe("DELETE /api/v1/societies/[id]/events/[eventId] — delete event", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCurrentUser.mockResolvedValue(mockAdmin);
    mockPrisma.communityEvent.findUnique.mockResolvedValue(mockDraftEvent);
    mockPrisma.communityEvent.delete.mockResolvedValue(mockDraftEvent);
  });

  it("returns 401 when not authenticated", async () => {
    mockGetCurrentUser.mockResolvedValue(null);
    const res = await DELETE(makeDeleteRequest(), makeParams());
    expect(res.status).toBe(401);
  });

  it("returns 404 when event not found", async () => {
    mockPrisma.communityEvent.findUnique.mockResolvedValue(null);
    const res = await DELETE(makeDeleteRequest(), makeParams());
    expect(res.status).toBe(404);
  });

  it("returns 404 when event belongs to different society", async () => {
    mockPrisma.communityEvent.findUnique.mockResolvedValue({
      ...mockDraftEvent,
      societyId: "other-soc",
    });
    const res = await DELETE(makeDeleteRequest(), makeParams("soc-1", "evt-1"));
    expect(res.status).toBe(404);
  });

  it("returns 400 with NOT_DRAFT when event is PUBLISHED", async () => {
    mockPrisma.communityEvent.findUnique.mockResolvedValue(mockPublishedEvent);
    const res = await DELETE(makeDeleteRequest(), makeParams());
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("NOT_DRAFT");
  });

  it("returns 400 with NOT_DRAFT when event is CANCELLED", async () => {
    mockPrisma.communityEvent.findUnique.mockResolvedValue({
      ...mockDraftEvent,
      status: "CANCELLED",
    });
    const res = await DELETE(makeDeleteRequest(), makeParams());
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("NOT_DRAFT");
  });

  it("deletes DRAFT event and returns success message", async () => {
    const res = await DELETE(makeDeleteRequest(), makeParams());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.message).toContain("deleted");
  });

  it("calls delete with the correct eventId", async () => {
    await DELETE(makeDeleteRequest(), makeParams("soc-1", "evt-42"));
    expect(mockPrisma.communityEvent.delete).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "evt-42" } }),
    );
  });

  it("does not call delete when event is not DRAFT", async () => {
    mockPrisma.communityEvent.findUnique.mockResolvedValue(mockPublishedEvent);
    await DELETE(makeDeleteRequest(), makeParams());
    expect(mockPrisma.communityEvent.delete).not.toHaveBeenCalled();
  });

  it("fires audit log EVENT_DELETED after successful deletion", async () => {
    await DELETE(makeDeleteRequest(), makeParams());
    expect(mockLogAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        actionType: "EVENT_DELETED",
        userId: "admin-1",
        societyId: "soc-1",
        entityType: "CommunityEvent",
        entityId: "evt-1",
        oldValue: { title: "Holi Festival" },
      }),
    );
  });

  it("does not fire audit log on failure", async () => {
    mockPrisma.communityEvent.findUnique.mockRejectedValue(new Error("DB error"));
    await DELETE(makeDeleteRequest(), makeParams());
    expect(mockLogAudit).not.toHaveBeenCalled();
  });

  it("returns 500 on database error during delete", async () => {
    mockPrisma.communityEvent.delete.mockRejectedValue(new Error("DB crash"));
    const res = await DELETE(makeDeleteRequest(), makeParams());
    expect(res.status).toBe(500);
  });
});
