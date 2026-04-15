import { describe, it, expect, vi, beforeEach } from "vitest";

const mockRequireCounsellor = vi.hoisted(() => vi.fn());
const mockPrisma = vi.hoisted(() => ({
  counsellorSocietyAssignment: { findMany: vi.fn() },
  residentTicketEscalation: { findMany: vi.fn() },
}));
const mockLogCounsellorAudit = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth-guard", () => ({ requireCounsellor: mockRequireCounsellor }));
vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/counsellor/audit", () => ({ logCounsellorAudit: mockLogCounsellorAudit }));

import { GET } from "@/app/api/v1/counsellor/analytics/portfolio/route";

const authedContext = {
  data: { counsellorId: "c-1", authUserId: "auth-1", email: "c@x.com", name: "C" },
  error: null,
};

const makeReq = (url = "http://localhost/api/v1/counsellor/analytics/portfolio") =>
  new Request(url);

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireCounsellor.mockResolvedValue(authedContext);
  mockLogCounsellorAudit.mockResolvedValue(undefined);
  mockPrisma.counsellorSocietyAssignment.findMany.mockResolvedValue([]);
  mockPrisma.residentTicketEscalation.findMany.mockResolvedValue([]);
});

describe("GET /api/v1/counsellor/analytics/portfolio", () => {
  it("returns 403 when guard rejects", async () => {
    mockRequireCounsellor.mockResolvedValue({
      data: null,
      error: new Response("{}", { status: 403 }),
    });
    const res = await GET(makeReq());
    expect(res.status).toBe(403);
  });

  it("returns empty totals when no data", async () => {
    const res = await GET(makeReq());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.totals.societies).toBe(0);
    expect(body.totals.escalationsAllTime).toBe(0);
    expect(body.totals.avgResolutionHours).toBeNull();
    expect(body.byType).toEqual([]);
    expect(body.bySociety).toEqual([]);
    expect(body.windowDays).toBe(30);
  });

  it("aggregates status counts, types, and per-society breakdown", async () => {
    const now = Date.now();
    const within = new Date(now - 5 * 24 * 60 * 60 * 1000);
    const outside = new Date(now - 40 * 24 * 60 * 60 * 1000);
    const past = new Date(now - 10 * 60 * 60 * 1000);
    const later = new Date(now - 2 * 60 * 60 * 1000);

    mockPrisma.counsellorSocietyAssignment.findMany.mockResolvedValue([
      { society: { id: "s-1", name: "Alpha", societyCode: "ALPHA1" } },
      { society: { id: "s-2", name: "Beta", societyCode: "BETA1" } },
    ]);
    mockPrisma.residentTicketEscalation.findMany.mockResolvedValue([
      {
        id: "e-1",
        status: "PENDING",
        acknowledgedAt: null,
        resolvedAt: null,
        slaDeadline: new Date(now - 1000),
        createdAt: within,
        ticket: {
          id: "t-1",
          type: "NOISE",
          societyId: "s-1",
          society: { name: "Alpha", societyCode: "ALPHA1" },
        },
      },
      {
        id: "e-2",
        status: "ACKNOWLEDGED",
        acknowledgedAt: past,
        resolvedAt: null,
        slaDeadline: new Date(now + 10000),
        createdAt: within,
        ticket: {
          id: "t-2",
          type: "NOISE",
          societyId: "s-1",
          society: { name: "Alpha", societyCode: "ALPHA1" },
        },
      },
      {
        id: "e-3",
        status: "RESOLVED_BY_COUNSELLOR",
        acknowledgedAt: past,
        resolvedAt: later,
        slaDeadline: null,
        createdAt: within,
        ticket: {
          id: "t-3",
          type: "PARKING",
          societyId: "s-2",
          society: { name: "Beta", societyCode: "BETA1" },
        },
      },
      {
        id: "e-4",
        status: "WITHDRAWN",
        acknowledgedAt: null,
        resolvedAt: null,
        slaDeadline: null,
        createdAt: outside,
        ticket: {
          id: "t-4",
          type: "NOISE",
          societyId: "s-2",
          society: { name: "Beta", societyCode: "BETA1" },
        },
      },
    ]);

    const res = await GET(makeReq());
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.totals.societies).toBe(2);
    expect(body.totals.escalationsAllTime).toBe(4);
    expect(body.totals.escalationsInWindow).toBe(3);
    expect(body.totals.openEscalations).toBe(2);
    expect(body.totals.pendingAck).toBe(1);
    expect(body.totals.acknowledged).toBe(1);
    expect(body.totals.resolved).toBe(1);
    expect(body.totals.withdrawn).toBe(1);
    expect(body.totals.slaBreachedOpen).toBe(1);
    expect(body.totals.avgResolutionHours).toBe(8);

    const noise = body.byType.find((r: { type: string }) => r.type === "NOISE");
    expect(noise.count).toBe(2);
    const parking = body.byType.find((r: { type: string }) => r.type === "PARKING");
    expect(parking.count).toBe(1);

    const s1 = body.bySociety.find((s: { societyId: string }) => s.societyId === "s-1");
    expect(s1.total).toBe(2);
    expect(s1.open).toBe(2);
    expect(s1.resolved).toBe(0);
    const s2 = body.bySociety.find((s: { societyId: string }) => s.societyId === "s-2");
    expect(s2.total).toBe(2);
    expect(s2.resolved).toBe(1);
  });

  it("honors windowDays query param within bounds", async () => {
    const res = await GET(
      makeReq("http://localhost/api/v1/counsellor/analytics/portfolio?windowDays=7"),
    );
    const body = await res.json();
    expect(body.windowDays).toBe(7);
  });

  it("falls back to default when windowDays is invalid", async () => {
    const res = await GET(
      makeReq("http://localhost/api/v1/counsellor/analytics/portfolio?windowDays=abc"),
    );
    const body = await res.json();
    expect(body.windowDays).toBe(30);
  });

  it("clamps windowDays above 365 to default", async () => {
    const res = await GET(
      makeReq("http://localhost/api/v1/counsellor/analytics/portfolio?windowDays=9999"),
    );
    const body = await res.json();
    expect(body.windowDays).toBe(30);
  });

  it("logs VIEW_ANALYTICS counsellor audit on success", async () => {
    await GET(makeReq());
    expect(mockLogCounsellorAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        counsellorId: "c-1",
        actionType: "COUNSELLOR_VIEW_ANALYTICS",
        entityType: "PortfolioAnalytics",
      }),
    );
  });

  it("returns 500 on unexpected error", async () => {
    mockPrisma.counsellorSocietyAssignment.findMany.mockRejectedValue(new Error("db"));
    const res = await GET(makeReq());
    expect(res.status).toBe(500);
  });
});
