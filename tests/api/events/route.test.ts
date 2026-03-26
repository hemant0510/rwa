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

import { GET, POST } from "@/app/api/v1/societies/[id]/events/route";

function makeGetRequest(query = "") {
  return new NextRequest(`http://localhost/test${query ? "?" + query : ""}`);
}

function makeRequest(body: unknown) {
  return new NextRequest("http://localhost/test", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

function makeParams(id = "soc-1") {
  return { params: Promise.resolve({ id }) };
}

const mockAdmin = {
  userId: "admin-1",
  authUserId: "auth-admin-1",
  societyId: "soc-1",
  role: "RWA_ADMIN" as const,
  adminPermission: "FULL_ACCESS" as const,
};

const mockEvent = {
  id: "evt-1",
  societyId: "soc-1",
  title: "Holi Festival",
  description: "Annual Holi celebration",
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
  _count: { registrations: 0 },
};

// ── GET /events (list) ────────────────────────────────────────────────────────

describe("GET /api/v1/societies/[id]/events — list events", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.communityEvent.findMany.mockResolvedValue([mockEvent]);
    mockPrisma.communityEvent.count.mockResolvedValue(1);
  });

  it("returns list with default pagination", async () => {
    const res = await GET(makeGetRequest(), makeParams());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toHaveLength(1);
    expect(body.total).toBe(1);
    expect(body.page).toBe(1);
    expect(body.limit).toBe(20);
  });

  it("passes societyId in where clause", async () => {
    await GET(makeGetRequest(), makeParams("soc-42"));
    expect(mockPrisma.communityEvent.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ societyId: "soc-42" }),
      }),
    );
  });

  it("applies status filter when provided", async () => {
    await GET(makeGetRequest("status=PUBLISHED"), makeParams());
    expect(mockPrisma.communityEvent.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: "PUBLISHED" }),
      }),
    );
    expect(mockPrisma.communityEvent.count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: "PUBLISHED" }),
      }),
    );
  });

  it("applies category filter when provided", async () => {
    await GET(makeGetRequest("category=SPORTS"), makeParams());
    expect(mockPrisma.communityEvent.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ category: "SPORTS" }),
      }),
    );
  });

  it("applies both status and category filters together", async () => {
    await GET(makeGetRequest("status=DRAFT&category=MEETING"), makeParams());
    expect(mockPrisma.communityEvent.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: "DRAFT", category: "MEETING" }),
      }),
    );
  });

  it("omits status from where clause when not provided", async () => {
    await GET(makeGetRequest(), makeParams());
    const callArg = mockPrisma.communityEvent.findMany.mock.calls[0][0];
    expect(callArg.where.status).toBeUndefined();
    expect(callArg.where.category).toBeUndefined();
  });

  it("respects custom page and limit", async () => {
    mockPrisma.communityEvent.count.mockResolvedValue(100);
    await GET(makeGetRequest("page=3&limit=10"), makeParams());
    expect(mockPrisma.communityEvent.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 20, take: 10 }),
    );
    const body = await (await GET(makeGetRequest("page=2&limit=5"), makeParams())).json();
    expect(body.page).toBe(2);
    expect(body.limit).toBe(5);
  });

  it("includes creator name and registration count", async () => {
    await GET(makeGetRequest(), makeParams());
    expect(mockPrisma.communityEvent.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        include: expect.objectContaining({
          creator: { select: { name: true } },
          _count: { select: { registrations: true } },
        }),
      }),
    );
  });

  it("orders by status asc then eventDate asc", async () => {
    await GET(makeGetRequest(), makeParams());
    expect(mockPrisma.communityEvent.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [{ status: "asc" }, { eventDate: "asc" }],
      }),
    );
  });

  it("returns empty list when no events exist", async () => {
    mockPrisma.communityEvent.findMany.mockResolvedValue([]);
    mockPrisma.communityEvent.count.mockResolvedValue(0);
    const res = await GET(makeGetRequest(), makeParams());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toHaveLength(0);
    expect(body.total).toBe(0);
  });

  it("returns 500 on database error", async () => {
    mockPrisma.communityEvent.findMany.mockRejectedValue(new Error("DB crash"));
    const res = await GET(makeGetRequest(), makeParams());
    expect(res.status).toBe(500);
  });
});

// ── POST /events (create) ─────────────────────────────────────────────────────

const validFreeEventBody = {
  title: "Holi Festival",
  category: "FESTIVAL",
  feeModel: "FREE",
  eventDate: "2026-03-25T10:00:00.000Z",
  location: "Community Hall",
};

const validFixedEventBody = {
  title: "Yoga Workshop",
  category: "WORKSHOP",
  feeModel: "FIXED",
  feeAmount: 200,
  chargeUnit: "PER_PERSON",
  eventDate: "2026-04-10T08:00:00.000Z",
};

const validFlexibleEventBody = {
  title: "Sports Day",
  category: "SPORTS",
  feeModel: "FLEXIBLE",
  eventDate: "2026-05-01T09:00:00.000Z",
};

describe("POST /api/v1/societies/[id]/events — create event", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCurrentUser.mockResolvedValue(mockAdmin);
    mockPrisma.communityEvent.create.mockResolvedValue(mockEvent);
  });

  it("returns 401 when not authenticated", async () => {
    mockGetCurrentUser.mockResolvedValue(null);
    const res = await POST(makeRequest(validFreeEventBody), makeParams());
    expect(res.status).toBe(401);
  });

  it("creates FREE event and returns 201", async () => {
    const res = await POST(makeRequest(validFreeEventBody), makeParams());
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.id).toBe("evt-1");
  });

  it("FREE events auto-set chargeUnit to PER_HOUSEHOLD", async () => {
    await POST(makeRequest(validFreeEventBody), makeParams());
    expect(mockPrisma.communityEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ chargeUnit: "PER_HOUSEHOLD" }),
      }),
    );
  });

  it("FREE events set chargeUnit to PER_HOUSEHOLD even if caller passes PER_PERSON", async () => {
    await POST(makeRequest({ ...validFreeEventBody, chargeUnit: "PER_PERSON" }), makeParams());
    expect(mockPrisma.communityEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ chargeUnit: "PER_HOUSEHOLD" }),
      }),
    );
  });

  it("FIXED event uses provided chargeUnit PER_PERSON", async () => {
    mockPrisma.communityEvent.create.mockResolvedValue({
      ...mockEvent,
      feeModel: "FIXED",
      feeAmount: 200,
      chargeUnit: "PER_PERSON",
    });
    await POST(makeRequest(validFixedEventBody), makeParams());
    expect(mockPrisma.communityEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ chargeUnit: "PER_PERSON" }),
      }),
    );
  });

  it("FIXED event defaults chargeUnit to PER_PERSON when not provided", async () => {
    const bodyWithoutChargeUnit = { ...validFixedEventBody };
    delete (bodyWithoutChargeUnit as Partial<typeof validFixedEventBody>).chargeUnit;
    await POST(makeRequest(bodyWithoutChargeUnit), makeParams());
    expect(mockPrisma.communityEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ chargeUnit: "PER_PERSON" }),
      }),
    );
  });

  it("FLEXIBLE event creates with null feeAmount", async () => {
    mockPrisma.communityEvent.create.mockResolvedValue({
      ...mockEvent,
      feeModel: "FLEXIBLE",
      chargeUnit: "PER_PERSON",
    });
    await POST(makeRequest(validFlexibleEventBody), makeParams());
    expect(mockPrisma.communityEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ feeModel: "FLEXIBLE", feeAmount: null }),
      }),
    );
  });

  it("sets societyId and createdBy from params and admin", async () => {
    await POST(makeRequest(validFreeEventBody), makeParams("soc-99"));
    expect(mockPrisma.communityEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          societyId: "soc-99",
          createdBy: "admin-1",
        }),
      }),
    );
  });

  it("converts eventDate string to Date object", async () => {
    await POST(makeRequest(validFreeEventBody), makeParams());
    expect(mockPrisma.communityEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ eventDate: expect.any(Date) }),
      }),
    );
  });

  it("sets optional fields to null when not provided", async () => {
    await POST(makeRequest(validFreeEventBody), makeParams());
    expect(mockPrisma.communityEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          description: null,
          location: "Community Hall",
          registrationDeadline: null,
        }),
      }),
    );
  });

  it("stores description when provided", async () => {
    await POST(
      makeRequest({ ...validFreeEventBody, description: "Fun event for all" }),
      makeParams(),
    );
    expect(mockPrisma.communityEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ description: "Fun event for all" }),
      }),
    );
  });

  it("fires audit log EVENT_CREATED after successful creation", async () => {
    await POST(makeRequest(validFreeEventBody), makeParams());
    expect(mockLogAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        actionType: "EVENT_CREATED",
        userId: "admin-1",
        societyId: "soc-1",
        entityType: "CommunityEvent",
        entityId: "evt-1",
        newValue: expect.objectContaining({
          title: "Holi Festival",
          feeModel: "FREE",
          category: "FESTIVAL",
        }),
      }),
    );
  });

  it("returns 422 when body is invalid (missing required fields)", async () => {
    const res = await POST(makeRequest({ title: "x" }), makeParams());
    expect(res.status).toBe(422);
  });

  it("returns 422 when title is too short", async () => {
    const res = await POST(makeRequest({ ...validFreeEventBody, title: "Hi" }), makeParams());
    expect(res.status).toBe(422);
  });

  it("returns 422 when FIXED event missing feeAmount", async () => {
    const body = {
      title: "Workshop",
      category: "WORKSHOP",
      feeModel: "FIXED",
      eventDate: "2026-04-10T08:00:00.000Z",
    };
    const res = await POST(makeRequest(body), makeParams());
    expect(res.status).toBe(422);
  });

  it("returns 422 when FREE event has feeAmount set", async () => {
    const res = await POST(makeRequest({ ...validFreeEventBody, feeAmount: 100 }), makeParams());
    expect(res.status).toBe(422);
  });

  it("returns 422 when registrationDeadline is after eventDate", async () => {
    const res = await POST(
      makeRequest({
        ...validFreeEventBody,
        registrationDeadline: "2026-04-01T00:00:00.000Z",
        eventDate: "2026-03-25T10:00:00.000Z",
      }),
      makeParams(),
    );
    expect(res.status).toBe(422);
  });

  it("returns 500 on database error", async () => {
    mockPrisma.communityEvent.create.mockRejectedValue(new Error("DB crash"));
    const res = await POST(makeRequest(validFreeEventBody), makeParams());
    expect(res.status).toBe(500);
  });
});
