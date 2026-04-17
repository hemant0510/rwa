import { describe, it, expect, vi, beforeEach } from "vitest";

const mockRequireCounsellor = vi.hoisted(() => vi.fn());
const mockPrisma = vi.hoisted(() => ({
  residentTicketEscalation: { findMany: vi.fn() },
}));

vi.mock("@/lib/auth-guard", () => ({ requireCounsellor: mockRequireCounsellor }));
vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

import { GET } from "@/app/api/v1/counsellor/tickets/route";

const authedContext = {
  data: { counsellorId: "c-1", authUserId: "auth-1", email: "c@x.com", name: "Counsellor" },
  error: null,
};

const escalation = {
  id: "e-1",
  status: "PENDING",
  source: "RESIDENT_VOTE",
  slaDeadline: new Date("2026-01-04"),
  acknowledgedAt: null,
  resolvedAt: null,
  createdAt: new Date("2026-01-01"),
  ticket: {
    id: "t-1",
    ticketNumber: "TKT-1",
    subject: "Noise issue",
    type: "COMPLAINT",
    priority: "MEDIUM",
    status: "OPEN",
    societyId: "soc-1",
    society: { name: "Alpha", societyCode: "ALPHA" },
  },
};

const makeReq = (query = "") => new Request(`http://localhost/api/v1/counsellor/tickets${query}`);

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireCounsellor.mockResolvedValue(authedContext);
  mockPrisma.residentTicketEscalation.findMany.mockResolvedValue([escalation]);
});

describe("GET /api/v1/counsellor/tickets", () => {
  it("returns 403 when auth guard rejects", async () => {
    const res403 = new Response("{}", { status: 403 });
    mockRequireCounsellor.mockResolvedValue({ data: null, error: res403 });
    const res = await GET(makeReq() as never);
    expect(res.status).toBe(403);
  });

  it("defaults to OPEN statuses when no query param", async () => {
    const res = await GET(makeReq() as never);
    expect(res.status).toBe(200);
    expect(mockPrisma.residentTicketEscalation.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          counsellorId: "c-1",
          status: { in: ["PENDING", "ACKNOWLEDGED", "REVIEWING"] },
        }),
      }),
    );
  });

  it("returns all statuses when ?status=all", async () => {
    await GET(makeReq("?status=all") as never);
    const call = mockPrisma.residentTicketEscalation.findMany.mock.calls[0][0];
    expect(call.where.status.in).toContain("RESOLVED_BY_COUNSELLOR");
    expect(call.where.status.in).toContain("WITHDRAWN");
  });

  it("filters by a specific status", async () => {
    await GET(makeReq("?status=ACKNOWLEDGED") as never);
    const call = mockPrisma.residentTicketEscalation.findMany.mock.calls[0][0];
    expect(call.where.status.in).toEqual(["ACKNOWLEDGED"]);
  });

  it("falls back to OPEN statuses for invalid status value", async () => {
    await GET(makeReq("?status=BOGUS") as never);
    const call = mockPrisma.residentTicketEscalation.findMany.mock.calls[0][0];
    expect(call.where.status.in).toEqual(["PENDING", "ACKNOWLEDGED", "REVIEWING"]);
  });

  it("filters by societyId when provided", async () => {
    await GET(makeReq("?societyId=soc-1") as never);
    const call = mockPrisma.residentTicketEscalation.findMany.mock.calls[0][0];
    expect(call.where.ticket).toEqual({ societyId: "soc-1" });
  });

  it("returns escalations in success response", async () => {
    const res = await GET(makeReq() as never);
    const body = await res.json();
    expect(body.escalations).toHaveLength(1);
    expect(body.escalations[0].id).toBe("e-1");
  });

  it("returns 500 when prisma throws", async () => {
    mockPrisma.residentTicketEscalation.findMany.mockRejectedValue(new Error("db"));
    const res = await GET(makeReq() as never);
    expect(res.status).toBe(500);
  });

  it("returns unfiltered tickets for super admin (no counsellorId filter)", async () => {
    mockRequireCounsellor.mockResolvedValue({
      data: {
        counsellorId: "__super_admin__",
        authUserId: "auth-sa",
        email: "sa@x.com",
        name: "SA",
        isSuperAdmin: true,
      },
      error: null,
    });
    mockPrisma.residentTicketEscalation.findMany.mockResolvedValue([escalation]);
    const res = await GET(makeReq() as never);
    expect(res.status).toBe(200);
    const call = mockPrisma.residentTicketEscalation.findMany.mock.calls[0][0];
    expect(call.where).not.toHaveProperty("counsellorId");
  });
});
