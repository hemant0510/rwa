import { describe, it, expect, vi, beforeEach } from "vitest";

const mockGetCurrentUser = vi.hoisted(() => vi.fn());
const mockPrisma = vi.hoisted(() => ({
  residentTicket: { findUnique: vi.fn() },
  residentTicketEscalation: { findFirst: vi.fn(), update: vi.fn() },
}));
const mockLogAudit = vi.hoisted(() => vi.fn());

vi.mock("@/lib/get-current-user", () => ({ getCurrentUser: mockGetCurrentUser }));
vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/audit", () => ({ logAudit: mockLogAudit }));

import { DELETE } from "@/app/api/v1/admin/resident-support/[id]/escalation/route";

const admin = {
  userId: "u-1",
  authUserId: "auth-1",
  societyId: "soc-1",
  role: "RWA_ADMIN",
  adminPermission: "FULL_ACCESS",
};

const makeParams = (id = "t-1") => ({ params: Promise.resolve({ id }) });
const makeReq = (body: unknown, id = "t-1") =>
  new Request(`http://localhost/api/v1/admin/resident-support/${id}/escalation`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? "" : JSON.stringify(body),
  });

beforeEach(() => {
  vi.clearAllMocks();
  mockGetCurrentUser.mockResolvedValue(admin);
  mockLogAudit.mockResolvedValue(undefined);
});

describe("Admin withdraw escalation DELETE", () => {
  it("returns 403 when not admin", async () => {
    mockGetCurrentUser.mockResolvedValue(null);
    const res = await DELETE(makeReq({}), makeParams());
    expect(res.status).toBe(403);
  });

  it("returns 403 when admin lacks FULL_ACCESS", async () => {
    mockGetCurrentUser.mockResolvedValue({ ...admin, adminPermission: "READ_NOTIFY" });
    const res = await DELETE(makeReq({}), makeParams());
    expect(res.status).toBe(403);
  });

  it("returns 404 when ticket not found", async () => {
    mockPrisma.residentTicket.findUnique.mockResolvedValue(null);
    const res = await DELETE(makeReq({}), makeParams());
    expect(res.status).toBe(404);
  });

  it("returns 422 when reason is invalid", async () => {
    mockPrisma.residentTicket.findUnique.mockResolvedValue({ id: "t-1" });
    const res = await DELETE(makeReq({ reason: "x".repeat(2001) }), makeParams());
    expect(res.status).toBe(422);
  });

  it("returns 404 when no active escalation", async () => {
    mockPrisma.residentTicket.findUnique.mockResolvedValue({ id: "t-1" });
    mockPrisma.residentTicketEscalation.findFirst.mockResolvedValue(null);
    const res = await DELETE(makeReq({ reason: "no longer needed" }), makeParams());
    expect(res.status).toBe(404);
  });

  it("returns 403 when escalation is RESIDENT_VOTE", async () => {
    mockPrisma.residentTicket.findUnique.mockResolvedValue({ id: "t-1" });
    mockPrisma.residentTicketEscalation.findFirst.mockResolvedValue({
      id: "e-1",
      source: "RESIDENT_VOTE",
      status: "PENDING",
    });
    const res = await DELETE(makeReq({ reason: "no longer needed" }), makeParams());
    expect(res.status).toBe(403);
  });

  it("withdraws ADMIN_ASSIGN escalation and logs audit", async () => {
    mockPrisma.residentTicket.findUnique.mockResolvedValue({ id: "t-1" });
    mockPrisma.residentTicketEscalation.findFirst.mockResolvedValue({
      id: "e-7",
      source: "ADMIN_ASSIGN",
      status: "PENDING",
    });
    mockPrisma.residentTicketEscalation.update.mockResolvedValue({
      id: "e-7",
      status: "WITHDRAWN",
    });

    const res = await DELETE(makeReq({ reason: "resolved internally" }), makeParams());
    expect(res.status).toBe(200);
    expect(mockPrisma.residentTicketEscalation.update).toHaveBeenCalledWith({
      where: { id: "e-7" },
      data: expect.objectContaining({
        status: "WITHDRAWN",
        withdrawnReason: "resolved internally",
      }),
    });
    expect(mockLogAudit).toHaveBeenCalledWith(
      expect.objectContaining({ actionType: "TICKET_ESCALATION_WITHDRAWN" }),
    );
  });

  it("accepts empty body and uses null reason", async () => {
    mockPrisma.residentTicket.findUnique.mockResolvedValue({ id: "t-1" });
    mockPrisma.residentTicketEscalation.findFirst.mockResolvedValue({
      id: "e-2",
      source: "ADMIN_NOTIFY",
      status: "PENDING",
    });
    mockPrisma.residentTicketEscalation.update.mockResolvedValue({ id: "e-2" });

    const res = await DELETE(makeReq(undefined), makeParams());
    expect(res.status).toBe(200);
    const updateCall = mockPrisma.residentTicketEscalation.update.mock.calls[0][0] as {
      data: { withdrawnReason: unknown };
    };
    expect(updateCall.data.withdrawnReason).toBeNull();
  });

  it("returns 500 on unexpected error", async () => {
    mockPrisma.residentTicket.findUnique.mockRejectedValue(new Error("db"));
    const res = await DELETE(makeReq({}), makeParams());
    expect(res.status).toBe(500);
  });
});
