import { describe, it, expect, vi, beforeEach } from "vitest";

const mockRequireCounsellor = vi.hoisted(() => vi.fn());
const mockPrisma = vi.hoisted(() => ({
  residentTicketEscalation: { findFirst: vi.fn() },
}));

vi.mock("@/lib/auth-guard", () => ({ requireCounsellor: mockRequireCounsellor }));
vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

import { GET } from "@/app/api/v1/counsellor/tickets/[id]/route";

const authedContext = {
  data: { counsellorId: "c-1", authUserId: "auth-1", email: "c@x.com", name: "C" },
  error: null,
};

const makeParams = (id = "e-1") => ({ params: Promise.resolve({ id }) });
const makeReq = () => new Request("http://localhost/api/v1/counsellor/tickets/e-1");

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireCounsellor.mockResolvedValue(authedContext);
});

describe("GET /api/v1/counsellor/tickets/[id]", () => {
  it("returns 403 when guard rejects", async () => {
    mockRequireCounsellor.mockResolvedValue({
      data: null,
      error: new Response("{}", { status: 403 }),
    });
    const res = await GET(makeReq() as never, makeParams());
    expect(res.status).toBe(403);
  });

  it("returns 404 when escalation not found or not owned by counsellor", async () => {
    mockPrisma.residentTicketEscalation.findFirst.mockResolvedValue(null);
    const res = await GET(makeReq() as never, makeParams());
    expect(res.status).toBe(404);
  });

  it("returns escalation with ticket + messages", async () => {
    mockPrisma.residentTicketEscalation.findFirst.mockResolvedValue({
      id: "e-1",
      status: "ACKNOWLEDGED",
      ticket: { id: "t-1", messages: [] },
    });
    const res = await GET(makeReq() as never, makeParams());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe("e-1");
    expect(mockPrisma.residentTicketEscalation.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "e-1", counsellorId: "c-1" },
      }),
    );
  });

  it("returns 500 on prisma error", async () => {
    mockPrisma.residentTicketEscalation.findFirst.mockRejectedValue(new Error("db"));
    const res = await GET(makeReq() as never, makeParams());
    expect(res.status).toBe(500);
  });

  it("returns ticket without counsellorId filter for super admin", async () => {
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
    mockPrisma.residentTicketEscalation.findFirst.mockResolvedValue({
      id: "e-1",
      status: "ACKNOWLEDGED",
      ticket: { id: "t-1", messages: [] },
    });
    const res = await GET(makeReq() as never, makeParams());
    expect(res.status).toBe(200);
    const call = mockPrisma.residentTicketEscalation.findFirst.mock.calls[0][0];
    expect(call.where).toEqual({ id: "e-1" });
    expect(call.where).not.toHaveProperty("counsellorId");
  });
});
