import { describe, it, expect, vi, beforeEach } from "vitest";

const mockGetCurrentUser = vi.hoisted(() => vi.fn());
const mockPrisma = vi.hoisted(() => ({
  residentTicket: { findUnique: vi.fn(), update: vi.fn() },
  residentTicketMessage: { create: vi.fn() },
}));
const mockLogAudit = vi.hoisted(() => vi.fn());

vi.mock("@/lib/get-current-user", () => ({ getCurrentUser: mockGetCurrentUser }));
vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/audit", () => ({ logAudit: mockLogAudit }));

import { POST } from "@/app/api/v1/residents/me/support/[id]/messages/route";

const mockResident = {
  userId: "u-1",
  authUserId: "auth-1",
  societyId: "soc-1",
  role: "RESIDENT",
  adminPermission: null,
};

function makePostReq(body: Record<string, unknown>) {
  return new Request("http://localhost/api/v1/residents/me/support/t-1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function makeParams(id = "t-1") {
  return { params: Promise.resolve({ id }) };
}

const openTicket = { id: "t-1", status: "OPEN" };
const awaitingResidentTicket = { id: "t-1", status: "AWAITING_RESIDENT" };
const closedTicket = { id: "t-1", status: "CLOSED" };

describe("Resident Support Messages API — POST", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCurrentUser.mockResolvedValue(mockResident);
    mockPrisma.residentTicket.findUnique.mockResolvedValue(openTicket);
    mockPrisma.residentTicketMessage.create.mockResolvedValue({ id: "m-1" });
    mockLogAudit.mockResolvedValue(undefined);
  });

  it("returns 401 when not authenticated", async () => {
    mockGetCurrentUser.mockResolvedValue(null);
    const res = await POST(makePostReq({ content: "Hello" }), makeParams());
    expect(res.status).toBe(401);
  });

  it("returns 404 when ticket not found", async () => {
    mockPrisma.residentTicket.findUnique.mockResolvedValue(null);
    const res = await POST(makePostReq({ content: "Hello" }), makeParams());
    expect(res.status).toBe(404);
  });

  it("allows any society resident (non-creator) to post — returns 201", async () => {
    mockPrisma.residentTicket.findUnique.mockResolvedValue({ id: "t-1", status: "OPEN" });
    const otherResident = { ...mockResident, userId: "u-other" };
    mockGetCurrentUser.mockResolvedValue(otherResident);
    const res = await POST(makePostReq({ content: "My perspective on this" }), makeParams());
    expect(res.status).toBe(201);
  });

  it("returns 400 when ticket is CLOSED", async () => {
    mockPrisma.residentTicket.findUnique.mockResolvedValue(closedTicket);
    const res = await POST(makePostReq({ content: "Hello" }), makeParams());
    expect(res.status).toBe(400);
  });

  it("returns 422 on invalid message (empty content)", async () => {
    const res = await POST(makePostReq({ content: "" }), makeParams());
    expect(res.status).toBe(422);
  });

  it("creates message with correct authorRole", async () => {
    const res = await POST(makePostReq({ content: "Please fix ASAP" }), makeParams());
    expect(res.status).toBe(201);
    expect(mockPrisma.residentTicketMessage.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          ticketId: "t-1",
          authorId: "u-1",
          authorRole: "RESIDENT",
          content: "Please fix ASAP",
        }),
      }),
    );
  });

  it("auto-transitions status from AWAITING_RESIDENT to AWAITING_ADMIN", async () => {
    mockPrisma.residentTicket.findUnique.mockResolvedValue(awaitingResidentTicket);
    await POST(makePostReq({ content: "Here is the update" }), makeParams());
    expect(mockPrisma.residentTicket.update).toHaveBeenCalledWith({
      where: { id: "t-1" },
      data: { status: "AWAITING_ADMIN" },
    });
  });

  it("does NOT transition when status is not AWAITING_RESIDENT", async () => {
    mockPrisma.residentTicket.findUnique.mockResolvedValue(openTicket);
    await POST(makePostReq({ content: "Just a follow-up" }), makeParams());
    expect(mockPrisma.residentTicket.update).not.toHaveBeenCalled();
  });

  it("calls logAudit on success", async () => {
    mockPrisma.residentTicketMessage.create.mockResolvedValue({ id: "m-42" });
    await POST(makePostReq({ content: "Audit this please" }), makeParams());
    expect(mockLogAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        actionType: "RESIDENT_TICKET_MESSAGE_SENT",
        userId: "u-1",
        societyId: "soc-1",
        entityType: "ResidentTicketMessage",
        entityId: "m-42",
      }),
    );
  });

  it("returns 500 on DB error", async () => {
    mockPrisma.residentTicket.findUnique.mockRejectedValue(new Error("DB"));
    const res = await POST(makePostReq({ content: "Hello" }), makeParams());
    expect(res.status).toBe(500);
  });
});
