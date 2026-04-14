import { describe, it, expect, vi, beforeEach } from "vitest";

const mockGetCurrentUser = vi.hoisted(() => vi.fn());
const mockPrisma = vi.hoisted(() => ({
  residentTicket: { findUnique: vi.fn() },
  counsellorSocietyAssignment: { findFirst: vi.fn() },
  residentTicketEscalation: { findFirst: vi.fn(), create: vi.fn() },
}));
const mockLogAudit = vi.hoisted(() => vi.fn());

vi.mock("@/lib/get-current-user", () => ({ getCurrentUser: mockGetCurrentUser }));
vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/audit", () => ({ logAudit: mockLogAudit }));

import { POST } from "@/app/api/v1/admin/resident-support/[id]/escalate/route";

const admin = {
  userId: "u-1",
  authUserId: "auth-1",
  societyId: "soc-1",
  role: "RWA_ADMIN",
  adminPermission: "FULL_ACCESS",
};

const makeParams = (id = "t-1") => ({ params: Promise.resolve({ id }) });
const makeReq = (body: unknown, id = "t-1") =>
  new Request(`http://localhost/api/v1/admin/resident-support/${id}/escalate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

beforeEach(() => {
  vi.clearAllMocks();
  mockGetCurrentUser.mockResolvedValue(admin);
  mockLogAudit.mockResolvedValue(undefined);
});

describe("Admin escalate POST", () => {
  it("returns 403 when not admin", async () => {
    mockGetCurrentUser.mockResolvedValue(null);
    const res = await POST(makeReq({ reason: "x".repeat(20) }), makeParams());
    expect(res.status).toBe(403);
  });

  it("returns 403 when admin is READ_NOTIFY", async () => {
    mockGetCurrentUser.mockResolvedValue({ ...admin, adminPermission: "READ_NOTIFY" });
    const res = await POST(makeReq({ reason: "x".repeat(20) }), makeParams());
    expect(res.status).toBe(403);
  });

  it("returns 404 when ticket not found", async () => {
    mockPrisma.residentTicket.findUnique.mockResolvedValue(null);
    const res = await POST(makeReq({ reason: "x".repeat(20) }), makeParams());
    expect(res.status).toBe(404);
  });

  it("returns 422 on validation error", async () => {
    mockPrisma.residentTicket.findUnique.mockResolvedValue({ id: "t-1", subject: "S" });
    const res = await POST(makeReq({ reason: "" }), makeParams());
    expect(res.status).toBe(422);
  });

  it("returns 409 when no counsellor assigned", async () => {
    mockPrisma.residentTicket.findUnique.mockResolvedValue({ id: "t-1", subject: "S" });
    mockPrisma.counsellorSocietyAssignment.findFirst.mockResolvedValue(null);
    const res = await POST(makeReq({ reason: "x".repeat(20) }), makeParams());
    expect(res.status).toBe(409);
    const json = await res.json();
    expect(json.error.code).toBe("NO_COUNSELLOR_ASSIGNED");
  });

  it("returns 409 when already escalated", async () => {
    mockPrisma.residentTicket.findUnique.mockResolvedValue({ id: "t-1", subject: "S" });
    mockPrisma.counsellorSocietyAssignment.findFirst.mockResolvedValue({ counsellorId: "c-1" });
    mockPrisma.residentTicketEscalation.findFirst.mockResolvedValue({ id: "e-1" });
    const res = await POST(makeReq({ reason: "x".repeat(20) }), makeParams());
    expect(res.status).toBe(409);
    const json = await res.json();
    expect(json.error.code).toBe("ALREADY_ESCALATED");
  });

  it("creates escalation (201) and logs audit", async () => {
    mockPrisma.residentTicket.findUnique.mockResolvedValue({ id: "t-1", subject: "S" });
    mockPrisma.counsellorSocietyAssignment.findFirst.mockResolvedValue({ counsellorId: "c-1" });
    mockPrisma.residentTicketEscalation.findFirst.mockResolvedValue(null);
    mockPrisma.residentTicketEscalation.create.mockResolvedValue({ id: "e-42" });

    const res = await POST(makeReq({ reason: "valid escalation reason text" }), makeParams());
    expect(res.status).toBe(201);
    expect(mockPrisma.residentTicketEscalation.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        ticketId: "t-1",
        counsellorId: "c-1",
        source: "ADMIN_ASSIGN",
        status: "PENDING",
        reason: "valid escalation reason text",
        createdById: "u-1",
      }),
    });
    expect(mockLogAudit).toHaveBeenCalledWith(
      expect.objectContaining({ actionType: "TICKET_ESCALATED_BY_ADMIN", entityId: "e-42" }),
    );
  });

  it("returns 500 on unexpected error", async () => {
    mockPrisma.residentTicket.findUnique.mockRejectedValue(new Error("db"));
    const res = await POST(makeReq({ reason: "x".repeat(20) }), makeParams());
    expect(res.status).toBe(500);
  });
});
