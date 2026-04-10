import { describe, it, expect, vi, beforeEach } from "vitest";

const mockGetCurrentUser = vi.hoisted(() => vi.fn());
const mockPrisma = vi.hoisted(() => ({
  residentTicket: { findUnique: vi.fn(), update: vi.fn() },
  residentTicketMessage: { create: vi.fn() },
}));
const mockLogAudit = vi.hoisted(() => vi.fn());
const mockSendResidentTicketReply = vi.hoisted(() => vi.fn());

vi.mock("@/lib/get-current-user", () => ({ getCurrentUser: mockGetCurrentUser }));
vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/audit", () => ({ logAudit: mockLogAudit }));
vi.mock("@/lib/whatsapp", () => ({ sendResidentTicketReply: mockSendResidentTicketReply }));

import { POST } from "@/app/api/v1/admin/resident-support/[id]/messages/route";

const mockAdmin = {
  userId: "u-1",
  authUserId: "auth-1",
  societyId: "soc-1",
  role: "RWA_ADMIN",
  adminPermission: "FULL_ACCESS",
};

const makeParams = (id = "t-1") => ({ params: Promise.resolve({ id }) });

function makeReq(body: Record<string, unknown>, id = "t-1") {
  return new Request(`http://localhost/api/v1/admin/resident-support/${id}/messages`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("Admin Resident Support - POST Messages", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCurrentUser.mockResolvedValue(mockAdmin);
    mockLogAudit.mockResolvedValue(undefined);
    mockSendResidentTicketReply.mockResolvedValue({ success: true });
  });

  it("returns 403 when not admin", async () => {
    mockGetCurrentUser.mockResolvedValue(null);
    const res = await POST(makeReq({ content: "Hello" }), makeParams());
    expect(res.status).toBe(403);
  });

  it("returns 403 for READ_NOTIFY admin", async () => {
    mockGetCurrentUser.mockResolvedValue({ ...mockAdmin, adminPermission: "READ_NOTIFY" });
    const res = await POST(makeReq({ content: "Hello" }), makeParams());
    expect(res.status).toBe(403);
  });

  it("returns 404 when ticket not found", async () => {
    mockPrisma.residentTicket.findUnique.mockResolvedValue(null);
    const res = await POST(makeReq({ content: "Hello" }), makeParams());
    expect(res.status).toBe(404);
  });

  it("returns 400 when ticket is CLOSED", async () => {
    mockPrisma.residentTicket.findUnique.mockResolvedValue({
      id: "t-1",
      status: "CLOSED",
      subject: "Test",
      createdByUser: { name: "Priya", mobile: null, consentWhatsapp: false },
    });
    const res = await POST(makeReq({ content: "Hello" }), makeParams());
    expect(res.status).toBe(400);
  });

  it("returns 422 on invalid message", async () => {
    mockPrisma.residentTicket.findUnique.mockResolvedValue({
      id: "t-1",
      status: "OPEN",
      subject: "Test",
      createdByUser: { name: "Priya", mobile: null, consentWhatsapp: false },
    });
    const res = await POST(makeReq({ content: "" }), makeParams());
    expect(res.status).toBe(422);
  });

  it("creates message with authorRole ADMIN", async () => {
    mockPrisma.residentTicket.findUnique.mockResolvedValue({
      id: "t-1",
      status: "OPEN",
      subject: "Test",
      createdByUser: { name: "Priya", mobile: null, consentWhatsapp: false },
    });
    mockPrisma.residentTicketMessage.create.mockResolvedValue({ id: "msg-1" });
    mockPrisma.residentTicket.update.mockResolvedValue({});

    const res = await POST(makeReq({ content: "We are looking into it" }), makeParams());
    expect(res.status).toBe(201);
    expect(mockPrisma.residentTicketMessage.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          ticketId: "t-1",
          authorId: "u-1",
          authorRole: "ADMIN",
          content: "We are looking into it",
          isInternal: false,
        }),
      }),
    );
  });

  it("non-internal message auto-transitions to AWAITING_RESIDENT", async () => {
    mockPrisma.residentTicket.findUnique.mockResolvedValue({
      id: "t-1",
      status: "OPEN",
      subject: "Test",
      createdByUser: { name: "Priya", mobile: null, consentWhatsapp: false },
    });
    mockPrisma.residentTicketMessage.create.mockResolvedValue({ id: "msg-1" });
    mockPrisma.residentTicket.update.mockResolvedValue({});

    const res = await POST(makeReq({ content: "Reply here", isInternal: false }), makeParams());
    expect(res.status).toBe(201);
    expect(mockPrisma.residentTicket.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "t-1" },
        data: { status: "AWAITING_RESIDENT" },
      }),
    );
  });

  it("does NOT transition when already AWAITING_RESIDENT", async () => {
    mockPrisma.residentTicket.findUnique.mockResolvedValue({
      id: "t-1",
      status: "AWAITING_RESIDENT",
      subject: "Test",
      createdByUser: { name: "Priya", mobile: null, consentWhatsapp: false },
    });
    mockPrisma.residentTicketMessage.create.mockResolvedValue({ id: "msg-1" });

    const res = await POST(makeReq({ content: "Follow up" }), makeParams());
    expect(res.status).toBe(201);
    expect(mockPrisma.residentTicket.update).not.toHaveBeenCalled();
  });

  it("internal message does NOT change status", async () => {
    mockPrisma.residentTicket.findUnique.mockResolvedValue({
      id: "t-1",
      status: "OPEN",
      subject: "Test",
      createdByUser: { name: "Priya", mobile: null, consentWhatsapp: false },
    });
    mockPrisma.residentTicketMessage.create.mockResolvedValue({ id: "msg-1" });

    const res = await POST(makeReq({ content: "Internal note", isInternal: true }), makeParams());
    expect(res.status).toBe(201);
    expect(mockPrisma.residentTicket.update).not.toHaveBeenCalled();
  });

  it("sends WhatsApp notification on non-internal message when creator has mobile + consent", async () => {
    mockPrisma.residentTicket.findUnique.mockResolvedValue({
      id: "t-1",
      status: "OPEN",
      subject: "Leaking pipe",
      createdByUser: { name: "Priya", mobile: "9876543210", consentWhatsapp: true },
    });
    mockPrisma.residentTicketMessage.create.mockResolvedValue({ id: "msg-1" });
    mockPrisma.residentTicket.update.mockResolvedValue({});

    const res = await POST(makeReq({ content: "We are on it", isInternal: false }), makeParams());
    expect(res.status).toBe(201);
    expect(mockSendResidentTicketReply).toHaveBeenCalledWith("9876543210", "Priya", "Leaking pipe");
  });

  it("does NOT send WhatsApp notification for internal messages", async () => {
    mockPrisma.residentTicket.findUnique.mockResolvedValue({
      id: "t-1",
      status: "OPEN",
      subject: "Leaking pipe",
      createdByUser: { name: "Priya", mobile: "9876543210", consentWhatsapp: true },
    });
    mockPrisma.residentTicketMessage.create.mockResolvedValue({ id: "msg-1" });

    await POST(makeReq({ content: "Internal note", isInternal: true }), makeParams());
    expect(mockSendResidentTicketReply).not.toHaveBeenCalled();
  });

  it("returns 500 on DB error", async () => {
    mockPrisma.residentTicket.findUnique.mockRejectedValue(new Error("DB failure"));
    const res = await POST(makeReq({ content: "Hello" }), makeParams());
    expect(res.status).toBe(500);
  });
});
