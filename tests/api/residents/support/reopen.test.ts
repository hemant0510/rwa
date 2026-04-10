import { describe, it, expect, vi, beforeEach } from "vitest";

const mockGetCurrentUser = vi.hoisted(() => vi.fn());
const mockPrisma = vi.hoisted(() => ({
  residentTicket: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
}));
const mockLogAudit = vi.hoisted(() => vi.fn());

vi.mock("@/lib/get-current-user", () => ({ getCurrentUser: mockGetCurrentUser }));
vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/audit", () => ({ logAudit: mockLogAudit }));

import { POST } from "@/app/api/v1/residents/me/support/[id]/reopen/route";

const mockResident = {
  userId: "u-1",
  authUserId: "auth-1",
  societyId: "soc-1",
  role: "RESIDENT",
  adminPermission: null,
};

const makeParams = (id = "t-1") => ({ params: Promise.resolve({ id }) });

function makePostReq() {
  return new Request("http://localhost/api/v1/residents/me/support/t-1/reopen", {
    method: "POST",
  });
}

describe("Resident Support Reopen API — POST", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCurrentUser.mockResolvedValue(mockResident);
    mockLogAudit.mockResolvedValue(undefined);
  });

  it("returns 401 when not authenticated", async () => {
    mockGetCurrentUser.mockResolvedValue(null);
    const res = await POST(makePostReq() as never, makeParams());
    expect(res.status).toBe(401);
  });

  it("returns 404 when ticket not found", async () => {
    mockPrisma.residentTicket.findUnique.mockResolvedValue(null);
    const res = await POST(makePostReq() as never, makeParams());
    expect(res.status).toBe(404);
  });

  it("returns 403 when not ticket creator", async () => {
    mockPrisma.residentTicket.findUnique.mockResolvedValue({
      id: "t-1",
      status: "RESOLVED",
      createdBy: "u-other",
      resolvedAt: new Date(),
    });
    const res = await POST(makePostReq() as never, makeParams());
    expect(res.status).toBe(403);
  });

  it("returns 400 when ticket is not RESOLVED", async () => {
    mockPrisma.residentTicket.findUnique.mockResolvedValue({
      id: "t-1",
      status: "OPEN",
      createdBy: "u-1",
      resolvedAt: null,
    });
    const res = await POST(makePostReq() as never, makeParams());
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.message).toContain("resolved");
  });

  it("returns 400 when reopen window expired", async () => {
    mockPrisma.residentTicket.findUnique.mockResolvedValue({
      id: "t-1",
      status: "RESOLVED",
      createdBy: "u-1",
      resolvedAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000),
    });
    const res = await POST(makePostReq() as never, makeParams());
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.message).toContain("expired");
  });

  it("successfully reopens ticket within 7-day window", async () => {
    mockPrisma.residentTicket.findUnique.mockResolvedValue({
      id: "t-1",
      status: "RESOLVED",
      createdBy: "u-1",
      resolvedAt: new Date(),
    });
    const updated = { id: "t-1", status: "OPEN", resolvedAt: null };
    mockPrisma.residentTicket.update.mockResolvedValue(updated);

    const res = await POST(makePostReq() as never, makeParams());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("OPEN");
    expect(mockPrisma.residentTicket.update).toHaveBeenCalledWith({
      where: { id: "t-1" },
      data: { status: "OPEN", resolvedAt: null },
    });
  });

  it("calls logAudit on success", async () => {
    mockPrisma.residentTicket.findUnique.mockResolvedValue({
      id: "t-1",
      status: "RESOLVED",
      createdBy: "u-1",
      resolvedAt: new Date(),
    });
    mockPrisma.residentTicket.update.mockResolvedValue({ id: "t-1", status: "OPEN" });

    await POST(makePostReq() as never, makeParams());
    expect(mockLogAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        actionType: "RESIDENT_TICKET_REOPENED",
        userId: "u-1",
        societyId: "soc-1",
        entityType: "ResidentTicket",
        entityId: "t-1",
        oldValue: { status: "RESOLVED" },
        newValue: { status: "OPEN" },
      }),
    );
  });

  it("returns 500 on DB error", async () => {
    mockPrisma.residentTicket.findUnique.mockRejectedValue(new Error("DB"));
    const res = await POST(makePostReq() as never, makeParams());
    expect(res.status).toBe(500);
  });
});
