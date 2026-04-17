import { describe, it, expect, vi, beforeEach } from "vitest";

const mockRequireCounsellor = vi.hoisted(() => vi.fn());
const mockPrisma = vi.hoisted(() => ({
  residentTicketEscalation: { findFirst: vi.fn(), update: vi.fn() },
}));
const mockLogAudit = vi.hoisted(() => vi.fn());
const mockLogCounsellorAudit = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth-guard", () => ({ requireCounsellor: mockRequireCounsellor }));
vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/audit", () => ({ logAudit: mockLogAudit }));
vi.mock("@/lib/counsellor/audit", () => ({ logCounsellorAudit: mockLogCounsellorAudit }));

import { POST } from "@/app/api/v1/counsellor/tickets/[id]/acknowledge/route";

const authedContext = {
  data: { counsellorId: "c-1", authUserId: "auth-1", email: "c@x.com", name: "C" },
  error: null,
};

const makeParams = (id = "e-1") => ({ params: Promise.resolve({ id }) });
const makeReq = () =>
  new Request("http://localhost/api/v1/counsellor/tickets/e-1/acknowledge", { method: "POST" });

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireCounsellor.mockResolvedValue(authedContext);
  mockLogAudit.mockResolvedValue(undefined);
});

describe("POST /api/v1/counsellor/tickets/[id]/acknowledge", () => {
  it("returns 403 when guard rejects", async () => {
    mockRequireCounsellor.mockResolvedValue({
      data: null,
      error: new Response("{}", { status: 403 }),
    });
    const res = await POST(makeReq() as never, makeParams());
    expect(res.status).toBe(403);
  });

  it("returns 404 when escalation missing", async () => {
    mockPrisma.residentTicketEscalation.findFirst.mockResolvedValue(null);
    const res = await POST(makeReq() as never, makeParams());
    expect(res.status).toBe(404);
  });

  it("returns 400 on invalid transition from ACKNOWLEDGED", async () => {
    mockPrisma.residentTicketEscalation.findFirst.mockResolvedValue({
      id: "e-1",
      status: "ACKNOWLEDGED",
      ticket: { societyId: "soc-1" },
    });
    const res = await POST(makeReq() as never, makeParams());
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error.code).toBe("INVALID_TRANSITION");
  });

  it("updates status to ACKNOWLEDGED and logs audit on success", async () => {
    mockPrisma.residentTicketEscalation.findFirst.mockResolvedValue({
      id: "e-1",
      status: "PENDING",
      ticket: { societyId: "soc-1" },
    });
    mockPrisma.residentTicketEscalation.update.mockResolvedValue({
      id: "e-1",
      status: "ACKNOWLEDGED",
      acknowledgedAt: new Date(),
    });
    const res = await POST(makeReq() as never, makeParams());
    expect(res.status).toBe(200);
    expect(mockPrisma.residentTicketEscalation.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "e-1" },
        data: expect.objectContaining({ status: "ACKNOWLEDGED", acknowledgedAt: expect.any(Date) }),
      }),
    );
    expect(mockLogAudit).toHaveBeenCalledWith(
      expect.objectContaining({ actionType: "TICKET_ESCALATION_ACKNOWLEDGED", societyId: "soc-1" }),
    );
    expect(mockLogCounsellorAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        counsellorId: "c-1",
        actionType: "COUNSELLOR_ACKNOWLEDGE_ESCALATION",
        entityId: "e-1",
        societyId: "soc-1",
      }),
    );
  });

  it("returns 500 on unexpected error", async () => {
    mockPrisma.residentTicketEscalation.findFirst.mockRejectedValue(new Error("db"));
    const res = await POST(makeReq() as never, makeParams());
    expect(res.status).toBe(500);
  });

  it("returns 403 for super admin", async () => {
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
    const res = await POST(makeReq() as never, makeParams());
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error.message).toContain("Super Admin");
  });
});
