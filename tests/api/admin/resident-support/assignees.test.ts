import { describe, it, expect, vi, beforeEach } from "vitest";

const mockGetCurrentUser = vi.hoisted(() => vi.fn());
const mockPrisma = vi.hoisted(() => ({
  residentTicket: { findUnique: vi.fn() },
  governingBodyMember: { findFirst: vi.fn() },
  residentTicketAssignee: {
    create: vi.fn(),
    delete: vi.fn(),
  },
  auditLog: { create: vi.fn() },
}));
const mockLogAudit = vi.hoisted(() => vi.fn());

vi.mock("@/lib/get-current-user", () => ({ getCurrentUser: mockGetCurrentUser }));
vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/audit", () => ({ logAudit: mockLogAudit }));

import { POST, DELETE } from "@/app/api/v1/admin/resident-support/[id]/assignees/route";

const ADMIN_ID = "00000000-0000-4000-8000-000000000001";
const MEMBER_ID = "00000000-0000-4000-8000-000000000002";
const TICKET_ID = "00000000-0000-4000-8000-000000000010";
const ASSIGNEE_ID = "00000000-0000-4000-8000-000000000020";

const MOCK_ADMIN = {
  userId: ADMIN_ID,
  authUserId: "auth-admin",
  societyId: "soc-1",
  role: "RWA_ADMIN",
  adminPermission: "FULL_ACCESS",
  name: "Admin User",
};

const MOCK_ASSIGNEE_RESULT = {
  id: ASSIGNEE_ID,
  ticketId: TICKET_ID,
  userId: MEMBER_ID,
  assignedBy: ADMIN_ID,
  assignedAt: new Date().toISOString(),
  assignee: {
    id: MEMBER_ID,
    name: "Ravi Kumar",
    governingBodyMembership: { designation: { name: "Secretary" } },
  },
};

function makePostReq(body: Record<string, unknown>) {
  return new Request(`http://localhost/api/v1/admin/resident-support/${TICKET_ID}/assignees`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function makeDeleteReq(userId = MEMBER_ID) {
  return new Request(
    `http://localhost/api/v1/admin/resident-support/${TICKET_ID}/assignees?userId=${userId}`,
    { method: "DELETE" },
  ) as never;
}

const mockParams = Promise.resolve({ id: TICKET_ID });

describe("Ticket Assignees API", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCurrentUser.mockResolvedValue(MOCK_ADMIN);
    mockPrisma.residentTicket.findUnique.mockResolvedValue({ id: TICKET_ID });
    mockPrisma.governingBodyMember.findFirst.mockResolvedValue({ id: "gbm-1" });
    mockPrisma.residentTicketAssignee.create.mockResolvedValue(MOCK_ASSIGNEE_RESULT);
    mockPrisma.residentTicketAssignee.delete.mockResolvedValue({ id: "ass-1" });
    mockLogAudit.mockResolvedValue(undefined);
  });

  // ── POST ─────────────────────────────────────────────────────────

  it("POST returns 403 when not authenticated", async () => {
    mockGetCurrentUser.mockResolvedValue(null);
    const res = await POST(makePostReq({ userId: MEMBER_ID }), { params: mockParams });
    expect(res.status).toBe(403);
  });

  it("POST returns 403 when not FULL_ACCESS", async () => {
    mockGetCurrentUser.mockResolvedValue({ ...MOCK_ADMIN, adminPermission: "READ_NOTIFY" });
    const res = await POST(makePostReq({ userId: MEMBER_ID }), { params: mockParams });
    expect(res.status).toBe(403);
  });

  it("POST returns 404 when ticket not found", async () => {
    mockPrisma.residentTicket.findUnique.mockResolvedValue(null);
    const res = await POST(makePostReq({ userId: MEMBER_ID }), { params: mockParams });
    expect(res.status).toBe(404);
  });

  it("POST returns 422 on invalid userId", async () => {
    const res = await POST(makePostReq({ userId: "not-a-uuid" }), { params: mockParams });
    expect(res.status).toBe(422);
  });

  it("POST returns 400 when user is not a governing body member", async () => {
    mockPrisma.governingBodyMember.findFirst.mockResolvedValue(null);
    const res = await POST(makePostReq({ userId: MEMBER_ID }), { params: mockParams });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.message).toMatch(/governing body member/);
  });

  it("POST returns 409 when member already assigned (P2002)", async () => {
    mockPrisma.residentTicketAssignee.create.mockRejectedValue({ code: "P2002" });
    const res = await POST(makePostReq({ userId: MEMBER_ID }), { params: mockParams });
    expect(res.status).toBe(409);
  });

  it("POST creates assignee and returns 201", async () => {
    const res = await POST(makePostReq({ userId: MEMBER_ID }), { params: mockParams });
    expect(res.status).toBe(201);
    expect(mockPrisma.residentTicketAssignee.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          ticketId: TICKET_ID,
          userId: MEMBER_ID,
          assignedBy: ADMIN_ID,
        }),
      }),
    );
  });

  it("POST calls logAudit on success", async () => {
    await POST(makePostReq({ userId: MEMBER_ID }), { params: mockParams });
    expect(mockLogAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        actionType: "RESIDENT_TICKET_ASSIGNEE_ADDED",
        userId: ADMIN_ID,
        entityId: TICKET_ID,
      }),
    );
  });

  it("POST returns 500 on unexpected DB error", async () => {
    mockPrisma.residentTicketAssignee.create.mockRejectedValue(new Error("DB error"));
    const res = await POST(makePostReq({ userId: MEMBER_ID }), { params: mockParams });
    expect(res.status).toBe(500);
  });

  // ── DELETE ───────────────────────────────────────────────────────

  it("DELETE returns 403 when not authenticated", async () => {
    mockGetCurrentUser.mockResolvedValue(null);
    const res = await DELETE(makeDeleteReq(), { params: mockParams });
    expect(res.status).toBe(403);
  });

  it("DELETE returns 403 when not FULL_ACCESS", async () => {
    mockGetCurrentUser.mockResolvedValue({ ...MOCK_ADMIN, adminPermission: "READ_NOTIFY" });
    const res = await DELETE(makeDeleteReq(), { params: mockParams });
    expect(res.status).toBe(403);
  });

  it("DELETE returns 404 when ticket not found", async () => {
    mockPrisma.residentTicket.findUnique.mockResolvedValue(null);
    const res = await DELETE(makeDeleteReq(), { params: mockParams });
    expect(res.status).toBe(404);
  });

  it("DELETE returns 400 when userId param missing", async () => {
    const req = new Request("http://localhost/api/v1/admin/resident-support/t-1/assignees", {
      method: "DELETE",
    }) as never;
    const res = await DELETE(req, { params: mockParams });
    expect(res.status).toBe(400);
  });

  it("DELETE returns 404 when assignment not found (P2025)", async () => {
    mockPrisma.residentTicketAssignee.delete.mockRejectedValue({ code: "P2025" });
    const res = await DELETE(makeDeleteReq(), { params: mockParams });
    expect(res.status).toBe(404);
  });

  it("DELETE removes assignee and returns 200", async () => {
    const res = await DELETE(makeDeleteReq(), { params: mockParams });
    expect(res.status).toBe(200);
    expect(mockPrisma.residentTicketAssignee.delete).toHaveBeenCalledWith({
      where: { ticketId_userId: { ticketId: TICKET_ID, userId: MEMBER_ID } },
    });
  });

  it("DELETE calls logAudit on success", async () => {
    await DELETE(makeDeleteReq(), { params: mockParams });
    expect(mockLogAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        actionType: "RESIDENT_TICKET_ASSIGNEE_REMOVED",
        userId: ADMIN_ID,
        entityId: TICKET_ID,
      }),
    );
  });

  it("DELETE returns 500 on unexpected DB error", async () => {
    mockPrisma.residentTicketAssignee.delete.mockRejectedValue(new Error("DB error"));
    const res = await DELETE(makeDeleteReq(), { params: mockParams });
    expect(res.status).toBe(500);
  });
});
