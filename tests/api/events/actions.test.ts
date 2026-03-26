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

import { POST as cancelPOST } from "@/app/api/v1/societies/[id]/events/[eventId]/cancel/route";
import { POST as completePOST } from "@/app/api/v1/societies/[id]/events/[eventId]/complete/route";
import { POST as publishPOST } from "@/app/api/v1/societies/[id]/events/[eventId]/publish/route";
import { POST as triggerPaymentPOST } from "@/app/api/v1/societies/[id]/events/[eventId]/trigger-payment/route";

function makeRequest(body?: unknown) {
  return new NextRequest("http://localhost/test", {
    method: "POST",
    body: body !== undefined ? JSON.stringify(body) : undefined,
    headers: { "Content-Type": "application/json" },
  });
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
};

const mockPublishedEvent = {
  ...mockDraftEvent,
  status: "PUBLISHED",
  publishedAt: new Date(),
};

const mockPublishedFlexibleEvent = {
  ...mockPublishedEvent,
  feeModel: "FLEXIBLE",
  chargeUnit: "PER_PERSON",
  feeAmount: null,
};

// ── POST /publish ─────────────────────────────────────────────────────────────

describe("POST /api/v1/societies/[id]/events/[eventId]/publish", () => {
  const updatedPublished = {
    ...mockDraftEvent,
    status: "PUBLISHED",
    publishedAt: new Date(),
    creator: { name: "Admin User" },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCurrentUser.mockResolvedValue(mockAdmin);
    mockPrisma.communityEvent.findUnique.mockResolvedValue(mockDraftEvent);
    mockPrisma.communityEvent.update.mockResolvedValue(updatedPublished);
  });

  it("returns 401 when not authenticated", async () => {
    mockGetCurrentUser.mockResolvedValue(null);
    const res = await publishPOST(makeRequest(), makeParams());
    expect(res.status).toBe(401);
  });

  it("returns 404 when event not found", async () => {
    mockPrisma.communityEvent.findUnique.mockResolvedValue(null);
    const res = await publishPOST(makeRequest(), makeParams());
    expect(res.status).toBe(404);
  });

  it("returns 404 when event belongs to different society", async () => {
    mockPrisma.communityEvent.findUnique.mockResolvedValue({
      ...mockDraftEvent,
      societyId: "other-soc",
    });
    const res = await publishPOST(makeRequest(), makeParams("soc-1", "evt-1"));
    expect(res.status).toBe(404);
  });

  it("returns 400 with NOT_DRAFT when event is already PUBLISHED", async () => {
    mockPrisma.communityEvent.findUnique.mockResolvedValue(mockPublishedEvent);
    const res = await publishPOST(makeRequest(), makeParams());
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("NOT_DRAFT");
  });

  it("returns 400 with NOT_DRAFT when event is CANCELLED", async () => {
    mockPrisma.communityEvent.findUnique.mockResolvedValue({
      ...mockDraftEvent,
      status: "CANCELLED",
    });
    const res = await publishPOST(makeRequest(), makeParams());
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("NOT_DRAFT");
  });

  it("returns 400 with NOT_DRAFT when event is COMPLETED", async () => {
    mockPrisma.communityEvent.findUnique.mockResolvedValue({
      ...mockDraftEvent,
      status: "COMPLETED",
    });
    const res = await publishPOST(makeRequest(), makeParams());
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("NOT_DRAFT");
  });

  it("publishes DRAFT event and returns updated event", async () => {
    const res = await publishPOST(makeRequest(), makeParams());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("PUBLISHED");
  });

  it("sets status PUBLISHED and publishedAt in update call", async () => {
    await publishPOST(makeRequest(), makeParams());
    expect(mockPrisma.communityEvent.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "evt-1" },
        data: expect.objectContaining({
          status: "PUBLISHED",
          publishedAt: expect.any(Date),
        }),
      }),
    );
  });

  it("fires audit log EVENT_PUBLISHED after successful publish", async () => {
    await publishPOST(makeRequest(), makeParams());
    expect(mockLogAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        actionType: "EVENT_PUBLISHED",
        userId: "admin-1",
        societyId: "soc-1",
        entityType: "CommunityEvent",
        entityId: "evt-1",
        newValue: { title: "Holi Festival" },
      }),
    );
  });

  it("does not fire audit log on failure", async () => {
    mockPrisma.communityEvent.findUnique.mockRejectedValue(new Error("DB error"));
    await publishPOST(makeRequest(), makeParams());
    expect(mockLogAudit).not.toHaveBeenCalled();
  });

  it("returns 500 on database error during update", async () => {
    mockPrisma.communityEvent.update.mockRejectedValue(new Error("DB crash"));
    const res = await publishPOST(makeRequest(), makeParams());
    expect(res.status).toBe(500);
  });
});

// ── POST /trigger-payment ─────────────────────────────────────────────────────

describe("POST /api/v1/societies/[id]/events/[eventId]/trigger-payment", () => {
  const triggeredEvent = {
    ...mockPublishedFlexibleEvent,
    feeAmount: 150,
    paymentTriggeredAt: new Date(),
    creator: { name: "Admin User" },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCurrentUser.mockResolvedValue(mockAdmin);
    mockPrisma.communityEvent.findUnique.mockResolvedValue(mockPublishedFlexibleEvent);
    mockPrisma.eventRegistration.count.mockResolvedValue(3);
    mockPrisma.$transaction.mockImplementation((fn: (tx: typeof mockPrisma) => Promise<unknown>) =>
      fn(mockPrisma),
    );
    mockPrisma.communityEvent.update.mockResolvedValue(triggeredEvent);
    mockPrisma.eventRegistration.updateMany.mockResolvedValue({ count: 3 });
  });

  it("returns 401 when not authenticated", async () => {
    mockGetCurrentUser.mockResolvedValue(null);
    const res = await triggerPaymentPOST(makeRequest({ feeAmount: 150 }), makeParams());
    expect(res.status).toBe(401);
  });

  it("returns 404 when event not found", async () => {
    mockPrisma.communityEvent.findUnique.mockResolvedValue(null);
    const res = await triggerPaymentPOST(makeRequest({ feeAmount: 150 }), makeParams());
    expect(res.status).toBe(404);
  });

  it("returns 404 when event belongs to different society", async () => {
    mockPrisma.communityEvent.findUnique.mockResolvedValue({
      ...mockPublishedFlexibleEvent,
      societyId: "other-soc",
    });
    const res = await triggerPaymentPOST(
      makeRequest({ feeAmount: 150 }),
      makeParams("soc-1", "evt-1"),
    );
    expect(res.status).toBe(404);
  });

  it("returns 400 with NOT_PUBLISHED when event is DRAFT", async () => {
    mockPrisma.communityEvent.findUnique.mockResolvedValue(mockDraftEvent);
    const res = await triggerPaymentPOST(makeRequest({ feeAmount: 150 }), makeParams());
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("NOT_PUBLISHED");
  });

  it("returns 400 with NOT_FLEXIBLE when event feeModel is FIXED", async () => {
    mockPrisma.communityEvent.findUnique.mockResolvedValue({
      ...mockPublishedEvent,
      feeModel: "FIXED",
      feeAmount: null,
    });
    const res = await triggerPaymentPOST(makeRequest({ feeAmount: 150 }), makeParams());
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("NOT_FLEXIBLE");
  });

  it("returns 400 with NOT_FLEXIBLE when event feeModel is FREE", async () => {
    mockPrisma.communityEvent.findUnique.mockResolvedValue({
      ...mockPublishedEvent,
      feeModel: "FREE",
      feeAmount: null,
    });
    const res = await triggerPaymentPOST(makeRequest({ feeAmount: 150 }), makeParams());
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("NOT_FLEXIBLE");
  });

  it("returns 400 with NOT_FLEXIBLE when event feeModel is CONTRIBUTION", async () => {
    mockPrisma.communityEvent.findUnique.mockResolvedValue({
      ...mockPublishedEvent,
      feeModel: "CONTRIBUTION",
      feeAmount: null,
    });
    const res = await triggerPaymentPOST(makeRequest({ feeAmount: 150 }), makeParams());
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("NOT_FLEXIBLE");
  });

  it("returns 400 with ALREADY_TRIGGERED when feeAmount is already set", async () => {
    mockPrisma.communityEvent.findUnique.mockResolvedValue({
      ...mockPublishedFlexibleEvent,
      feeAmount: 200,
    });
    const res = await triggerPaymentPOST(makeRequest({ feeAmount: 150 }), makeParams());
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("ALREADY_TRIGGERED");
  });

  it("returns 400 with NO_INTEREST when no INTERESTED registrations", async () => {
    mockPrisma.eventRegistration.count.mockResolvedValue(0);
    const res = await triggerPaymentPOST(makeRequest({ feeAmount: 150 }), makeParams());
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("NO_INTEREST");
  });

  it("triggers payment and returns event with transitionedCount", async () => {
    const res = await triggerPaymentPOST(makeRequest({ feeAmount: 150 }), makeParams());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.feeAmount).toBe(150);
    expect(body.transitionedCount).toBe(3);
  });

  it("sets feeAmount and paymentTriggeredAt in event update", async () => {
    await triggerPaymentPOST(makeRequest({ feeAmount: 250 }), makeParams());
    expect(mockPrisma.communityEvent.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "evt-1" },
        data: expect.objectContaining({
          feeAmount: 250,
          paymentTriggeredAt: expect.any(Date),
        }),
      }),
    );
  });

  it("bulk-transitions INTERESTED registrations to PENDING", async () => {
    await triggerPaymentPOST(makeRequest({ feeAmount: 150 }), makeParams());
    expect(mockPrisma.eventRegistration.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { eventId: "evt-1", status: "INTERESTED" },
        data: { status: "PENDING" },
      }),
    );
  });

  it("runs update and updateMany inside a transaction", async () => {
    await triggerPaymentPOST(makeRequest({ feeAmount: 150 }), makeParams());
    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it("fires audit log EVENT_PAYMENT_TRIGGERED with feeAmount and transitionedCount", async () => {
    await triggerPaymentPOST(makeRequest({ feeAmount: 150 }), makeParams());
    expect(mockLogAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        actionType: "EVENT_PAYMENT_TRIGGERED",
        userId: "admin-1",
        societyId: "soc-1",
        entityType: "CommunityEvent",
        entityId: "evt-1",
        newValue: expect.objectContaining({
          feeAmount: 150,
          transitionedCount: 3,
        }),
      }),
    );
  });

  it("does not fire audit log on failure", async () => {
    mockPrisma.communityEvent.findUnique.mockRejectedValue(new Error("DB error"));
    await triggerPaymentPOST(makeRequest({ feeAmount: 150 }), makeParams());
    expect(mockLogAudit).not.toHaveBeenCalled();
  });

  it("returns 422 when feeAmount is missing from body", async () => {
    const res = await triggerPaymentPOST(makeRequest({}), makeParams());
    expect(res.status).toBe(422);
  });

  it("returns 422 when feeAmount is negative", async () => {
    const res = await triggerPaymentPOST(makeRequest({ feeAmount: -50 }), makeParams());
    expect(res.status).toBe(422);
  });

  it("returns 422 when feeAmount is zero", async () => {
    const res = await triggerPaymentPOST(makeRequest({ feeAmount: 0 }), makeParams());
    expect(res.status).toBe(422);
  });

  it("returns 500 on database error during transaction", async () => {
    mockPrisma.$transaction.mockRejectedValue(new Error("TX crash"));
    const res = await triggerPaymentPOST(makeRequest({ feeAmount: 150 }), makeParams());
    expect(res.status).toBe(500);
  });
});

// ── POST /cancel ──────────────────────────────────────────────────────────────

describe("POST /api/v1/societies/[id]/events/[eventId]/cancel", () => {
  const cancelledEvent = {
    ...mockPublishedEvent,
    status: "CANCELLED",
    cancellationReason: "Venue unavailable",
    creator: { name: "Admin User" },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCurrentUser.mockResolvedValue(mockAdmin);
    mockPrisma.communityEvent.findUnique.mockResolvedValue(mockPublishedEvent);
    mockPrisma.$transaction.mockImplementation((fn: (tx: typeof mockPrisma) => Promise<unknown>) =>
      fn(mockPrisma),
    );
    mockPrisma.communityEvent.update.mockResolvedValue(cancelledEvent);
    mockPrisma.eventRegistration.updateMany.mockResolvedValue({ count: 5 });
  });

  it("returns 401 when not authenticated", async () => {
    mockGetCurrentUser.mockResolvedValue(null);
    const res = await cancelPOST(makeRequest({ reason: "Venue unavailable" }), makeParams());
    expect(res.status).toBe(401);
  });

  it("returns 404 when event not found", async () => {
    mockPrisma.communityEvent.findUnique.mockResolvedValue(null);
    const res = await cancelPOST(makeRequest({ reason: "Venue unavailable" }), makeParams());
    expect(res.status).toBe(404);
  });

  it("returns 404 when event belongs to different society", async () => {
    mockPrisma.communityEvent.findUnique.mockResolvedValue({
      ...mockPublishedEvent,
      societyId: "other-soc",
    });
    const res = await cancelPOST(
      makeRequest({ reason: "Venue unavailable" }),
      makeParams("soc-1", "evt-1"),
    );
    expect(res.status).toBe(404);
  });

  it("returns 400 with NOT_PUBLISHED when event is DRAFT", async () => {
    mockPrisma.communityEvent.findUnique.mockResolvedValue(mockDraftEvent);
    const res = await cancelPOST(makeRequest({ reason: "Venue unavailable" }), makeParams());
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("NOT_PUBLISHED");
  });

  it("returns 400 with NOT_PUBLISHED when event is COMPLETED", async () => {
    mockPrisma.communityEvent.findUnique.mockResolvedValue({
      ...mockPublishedEvent,
      status: "COMPLETED",
    });
    const res = await cancelPOST(makeRequest({ reason: "Venue unavailable" }), makeParams());
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("NOT_PUBLISHED");
  });

  it("returns 400 with NOT_PUBLISHED when event is already CANCELLED", async () => {
    mockPrisma.communityEvent.findUnique.mockResolvedValue({
      ...mockPublishedEvent,
      status: "CANCELLED",
    });
    const res = await cancelPOST(makeRequest({ reason: "Venue unavailable" }), makeParams());
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("NOT_PUBLISHED");
  });

  it("cancels PUBLISHED event and returns cancelled event", async () => {
    const res = await cancelPOST(makeRequest({ reason: "Venue unavailable" }), makeParams());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("CANCELLED");
    expect(body.cancellationReason).toBe("Venue unavailable");
  });

  it("sets status CANCELLED and cancellationReason in event update", async () => {
    await cancelPOST(makeRequest({ reason: "Venue unavailable" }), makeParams());
    expect(mockPrisma.communityEvent.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "evt-1" },
        data: expect.objectContaining({
          status: "CANCELLED",
          cancellationReason: "Venue unavailable",
        }),
      }),
    );
  });

  it("bulk-cancels active registrations (INTERESTED, PENDING, CONFIRMED)", async () => {
    await cancelPOST(makeRequest({ reason: "Venue unavailable" }), makeParams());
    expect(mockPrisma.eventRegistration.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          eventId: "evt-1",
          status: { in: ["INTERESTED", "PENDING", "CONFIRMED"] },
        },
        data: expect.objectContaining({
          status: "CANCELLED",
          cancelledAt: expect.any(Date),
        }),
      }),
    );
  });

  it("runs event update and registration updateMany inside a transaction", async () => {
    await cancelPOST(makeRequest({ reason: "Venue unavailable" }), makeParams());
    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
  });

  it("fires audit log EVENT_CANCELLED with reason", async () => {
    await cancelPOST(makeRequest({ reason: "Venue unavailable" }), makeParams());
    expect(mockLogAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        actionType: "EVENT_CANCELLED",
        userId: "admin-1",
        societyId: "soc-1",
        entityType: "CommunityEvent",
        entityId: "evt-1",
        newValue: { reason: "Venue unavailable" },
      }),
    );
  });

  it("does not fire audit log on failure", async () => {
    mockPrisma.communityEvent.findUnique.mockRejectedValue(new Error("DB error"));
    await cancelPOST(makeRequest({ reason: "Venue unavailable" }), makeParams());
    expect(mockLogAudit).not.toHaveBeenCalled();
  });

  it("returns 422 when reason is missing", async () => {
    const res = await cancelPOST(makeRequest({}), makeParams());
    expect(res.status).toBe(422);
  });

  it("returns 422 when reason is too short (less than 3 chars)", async () => {
    const res = await cancelPOST(makeRequest({ reason: "No" }), makeParams());
    expect(res.status).toBe(422);
  });

  it("returns 500 on database error during transaction", async () => {
    mockPrisma.$transaction.mockRejectedValue(new Error("TX crash"));
    const res = await cancelPOST(makeRequest({ reason: "Venue unavailable" }), makeParams());
    expect(res.status).toBe(500);
  });
});

// ── POST /complete ────────────────────────────────────────────────────────────

describe("POST /api/v1/societies/[id]/events/[eventId]/complete", () => {
  const completedEvent = {
    ...mockPublishedEvent,
    status: "COMPLETED",
    creator: { name: "Admin User" },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCurrentUser.mockResolvedValue(mockAdmin);
    mockPrisma.communityEvent.findUnique.mockResolvedValue(mockPublishedEvent);
    mockPrisma.communityEvent.update.mockResolvedValue(completedEvent);
  });

  it("returns 401 when not authenticated", async () => {
    mockGetCurrentUser.mockResolvedValue(null);
    const res = await completePOST(makeRequest(), makeParams());
    expect(res.status).toBe(401);
  });

  it("returns 404 when event not found", async () => {
    mockPrisma.communityEvent.findUnique.mockResolvedValue(null);
    const res = await completePOST(makeRequest(), makeParams());
    expect(res.status).toBe(404);
  });

  it("returns 404 when event belongs to different society", async () => {
    mockPrisma.communityEvent.findUnique.mockResolvedValue({
      ...mockPublishedEvent,
      societyId: "other-soc",
    });
    const res = await completePOST(makeRequest(), makeParams("soc-1", "evt-1"));
    expect(res.status).toBe(404);
  });

  it("returns 400 with NOT_PUBLISHED when event is DRAFT", async () => {
    mockPrisma.communityEvent.findUnique.mockResolvedValue(mockDraftEvent);
    const res = await completePOST(makeRequest(), makeParams());
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("NOT_PUBLISHED");
  });

  it("returns 400 with NOT_PUBLISHED when event is CANCELLED", async () => {
    mockPrisma.communityEvent.findUnique.mockResolvedValue({
      ...mockPublishedEvent,
      status: "CANCELLED",
    });
    const res = await completePOST(makeRequest(), makeParams());
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("NOT_PUBLISHED");
  });

  it("returns 400 with NOT_PUBLISHED when event is already COMPLETED", async () => {
    mockPrisma.communityEvent.findUnique.mockResolvedValue({
      ...mockPublishedEvent,
      status: "COMPLETED",
    });
    const res = await completePOST(makeRequest(), makeParams());
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("NOT_PUBLISHED");
  });

  it("completes PUBLISHED event and returns updated event", async () => {
    const res = await completePOST(makeRequest(), makeParams());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("COMPLETED");
  });

  it("sets status COMPLETED in update call", async () => {
    await completePOST(makeRequest(), makeParams());
    expect(mockPrisma.communityEvent.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "evt-1" },
        data: { status: "COMPLETED" },
      }),
    );
  });

  it("fires audit log EVENT_COMPLETED with event title", async () => {
    await completePOST(makeRequest(), makeParams());
    expect(mockLogAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        actionType: "EVENT_COMPLETED",
        userId: "admin-1",
        societyId: "soc-1",
        entityType: "CommunityEvent",
        entityId: "evt-1",
        newValue: { title: "Holi Festival" },
      }),
    );
  });

  it("does not fire audit log on failure", async () => {
    mockPrisma.communityEvent.findUnique.mockRejectedValue(new Error("DB error"));
    await completePOST(makeRequest(), makeParams());
    expect(mockLogAudit).not.toHaveBeenCalled();
  });

  it("returns 500 on database error during update", async () => {
    mockPrisma.communityEvent.update.mockRejectedValue(new Error("DB crash"));
    const res = await completePOST(makeRequest(), makeParams());
    expect(res.status).toBe(500);
  });
});
