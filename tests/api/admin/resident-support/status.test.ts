import { describe, it, expect, vi, beforeEach } from "vitest";

const mockGetCurrentUser = vi.hoisted(() => vi.fn());
const mockPrisma = vi.hoisted(() => ({
  residentTicket: { findUnique: vi.fn(), update: vi.fn() },
}));
const mockLogAudit = vi.hoisted(() => vi.fn());

vi.mock("@/lib/get-current-user", () => ({ getCurrentUser: mockGetCurrentUser }));
vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/audit", () => ({ logAudit: mockLogAudit }));

import { PATCH } from "@/app/api/v1/admin/resident-support/[id]/status/route";

const mockAdmin = {
  userId: "u-1",
  authUserId: "auth-1",
  societyId: "soc-1",
  role: "RWA_ADMIN",
  adminPermission: "FULL_ACCESS",
};

const makeParams = (id = "t-1") => ({ params: Promise.resolve({ id }) });

function makeReq(body: Record<string, unknown>, id = "t-1") {
  return new Request(`http://localhost/api/v1/admin/resident-support/${id}/status`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("Admin Resident Support - PATCH Status", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCurrentUser.mockResolvedValue(mockAdmin);
    mockLogAudit.mockResolvedValue(undefined);
  });

  it("returns 403 when not admin", async () => {
    mockGetCurrentUser.mockResolvedValue(null);
    const res = await PATCH(makeReq({ status: "IN_PROGRESS" }), makeParams());
    expect(res.status).toBe(403);
  });

  it("returns 403 for READ_NOTIFY admin", async () => {
    mockGetCurrentUser.mockResolvedValue({ ...mockAdmin, adminPermission: "READ_NOTIFY" });
    const res = await PATCH(makeReq({ status: "IN_PROGRESS" }), makeParams());
    expect(res.status).toBe(403);
  });

  it("returns 404 when ticket not found", async () => {
    mockPrisma.residentTicket.findUnique.mockResolvedValue(null);
    const res = await PATCH(makeReq({ status: "IN_PROGRESS" }), makeParams());
    expect(res.status).toBe(404);
  });

  it("returns 422 on invalid status value", async () => {
    mockPrisma.residentTicket.findUnique.mockResolvedValue({ id: "t-1", status: "OPEN" });
    const res = await PATCH(makeReq({ status: "INVALID_STATUS" }), makeParams());
    expect(res.status).toBe(422);
  });

  it("returns 400 on invalid transition (OPEN -> RESOLVED)", async () => {
    mockPrisma.residentTicket.findUnique.mockResolvedValue({ id: "t-1", status: "OPEN" });
    const res = await PATCH(makeReq({ status: "RESOLVED" }), makeParams());
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error.message).toContain("Cannot transition from OPEN to RESOLVED");
  });

  it("successfully transitions OPEN -> IN_PROGRESS", async () => {
    mockPrisma.residentTicket.findUnique.mockResolvedValue({ id: "t-1", status: "OPEN" });
    const updatedTicket = { id: "t-1", status: "IN_PROGRESS" };
    mockPrisma.residentTicket.update.mockResolvedValue(updatedTicket);

    const res = await PATCH(makeReq({ status: "IN_PROGRESS" }), makeParams());
    expect(res.status).toBe(200);
    expect(mockPrisma.residentTicket.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "t-1" },
        data: expect.objectContaining({ status: "IN_PROGRESS" }),
      }),
    );
    // Should NOT have resolvedAt or closedAt
    const updateCall = mockPrisma.residentTicket.update.mock.calls[0][0] as never as {
      data: Record<string, unknown>;
    };
    expect(updateCall.data.resolvedAt).toBeUndefined();
    expect(updateCall.data.closedAt).toBeUndefined();
  });

  it("sets resolvedAt when transitioning to RESOLVED", async () => {
    mockPrisma.residentTicket.findUnique.mockResolvedValue({ id: "t-1", status: "IN_PROGRESS" });
    mockPrisma.residentTicket.update.mockResolvedValue({ id: "t-1", status: "RESOLVED" });

    const res = await PATCH(makeReq({ status: "RESOLVED" }), makeParams());
    expect(res.status).toBe(200);
    const updateCall = mockPrisma.residentTicket.update.mock.calls[0][0] as never as {
      data: Record<string, unknown>;
    };
    expect(updateCall.data.resolvedAt).toBeInstanceOf(Date);
  });

  it("sets closedAt and closedReason when CLOSED", async () => {
    mockPrisma.residentTicket.findUnique.mockResolvedValue({ id: "t-1", status: "IN_PROGRESS" });
    mockPrisma.residentTicket.update.mockResolvedValue({ id: "t-1", status: "CLOSED" });

    const res = await PATCH(
      makeReq({ status: "CLOSED", reason: "Duplicate ticket" }),
      makeParams(),
    );
    expect(res.status).toBe(200);
    const updateCall = mockPrisma.residentTicket.update.mock.calls[0][0] as never as {
      data: Record<string, unknown>;
    };
    expect(updateCall.data.closedAt).toBeInstanceOf(Date);
    expect(updateCall.data.closedReason).toBe("Duplicate ticket");
  });

  it("sets closedAt without closedReason when no reason provided", async () => {
    mockPrisma.residentTicket.findUnique.mockResolvedValue({ id: "t-1", status: "IN_PROGRESS" });
    mockPrisma.residentTicket.update.mockResolvedValue({ id: "t-1", status: "CLOSED" });

    const res = await PATCH(makeReq({ status: "CLOSED" }), makeParams());
    expect(res.status).toBe(200);
    const updateCall = mockPrisma.residentTicket.update.mock.calls[0][0] as never as {
      data: Record<string, unknown>;
    };
    expect(updateCall.data.closedAt).toBeInstanceOf(Date);
    expect(updateCall.data.closedReason).toBeUndefined();
  });

  it("returns 500 on DB error", async () => {
    mockPrisma.residentTicket.findUnique.mockRejectedValue(new Error("DB failure"));
    const res = await PATCH(makeReq({ status: "IN_PROGRESS" }), makeParams());
    expect(res.status).toBe(500);
  });
});
