import { describe, it, expect, vi, beforeEach } from "vitest";

const mockRequireSuperAdmin = vi.hoisted(() => vi.fn());
const mockPrisma = vi.hoisted(() => ({
  serviceRequest: { findUnique: vi.fn(), update: vi.fn() },
  serviceRequestMessage: { create: vi.fn() },
}));

vi.mock("@/lib/auth-guard", () => ({ requireSuperAdmin: mockRequireSuperAdmin }));
vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

import { POST } from "@/app/api/v1/super-admin/support/[id]/messages/route";

const mockSA = {
  data: { superAdminId: "sa-1", authUserId: "auth-sa-1", email: "sa@rwa.com" },
  error: null,
};

function makeReq(id: string, body: Record<string, unknown>) {
  return [
    new Request(`http://localhost/api/v1/super-admin/support/${id}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ id }) },
  ] as const;
}

describe("SA Support Messages", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireSuperAdmin.mockResolvedValue(mockSA);
  });

  it("POST reply sets status to AWAITING_ADMIN", async () => {
    mockPrisma.serviceRequest.findUnique.mockResolvedValue({ id: "r-1", status: "IN_PROGRESS" });
    mockPrisma.serviceRequestMessage.create.mockResolvedValue({ id: "msg-1" });
    mockPrisma.serviceRequest.update.mockResolvedValue({});

    const [req, ctx] = makeReq("r-1", { content: "Working on it" });
    const res = await POST(req, ctx);
    expect(res.status).toBe(201);
    expect(mockPrisma.serviceRequest.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: "AWAITING_ADMIN" } }),
    );
  });

  it("POST internal note does NOT change status", async () => {
    mockPrisma.serviceRequest.findUnique.mockResolvedValue({ id: "r-1", status: "IN_PROGRESS" });
    mockPrisma.serviceRequestMessage.create.mockResolvedValue({ id: "msg-2", isInternal: true });

    const [req, ctx] = makeReq("r-1", { content: "Internal investigation note", isInternal: true });
    const res = await POST(req, ctx);
    expect(res.status).toBe(201);
    expect(mockPrisma.serviceRequest.update).not.toHaveBeenCalled();
  });

  it("POST to CLOSED request returns 400", async () => {
    mockPrisma.serviceRequest.findUnique.mockResolvedValue({ id: "r-1", status: "CLOSED" });
    const [req, ctx] = makeReq("r-1", { content: "Test" });
    const res = await POST(req, ctx);
    expect(res.status).toBe(400);
  });

  it("returns 404 when request not found", async () => {
    mockPrisma.serviceRequest.findUnique.mockResolvedValue(null);
    const [req, ctx] = makeReq("bad-id", { content: "Test" });
    const res = await POST(req, ctx);
    expect(res.status).toBe(404);
  });

  it("returns 403 when not SA", async () => {
    mockRequireSuperAdmin.mockResolvedValue({
      data: null,
      error: new Response(JSON.stringify({ error: { code: "FORBIDDEN" } }), { status: 403 }),
    });
    const [req, ctx] = makeReq("r-1", { content: "Test" });
    const res = await POST(req, ctx);
    expect(res.status).toBe(403);
  });

  it("does not update status if already AWAITING_ADMIN", async () => {
    mockPrisma.serviceRequest.findUnique.mockResolvedValue({ id: "r-1", status: "AWAITING_ADMIN" });
    mockPrisma.serviceRequestMessage.create.mockResolvedValue({ id: "msg-3" });

    const [req, ctx] = makeReq("r-1", { content: "Follow up" });
    await POST(req, ctx);
    expect(mockPrisma.serviceRequest.update).not.toHaveBeenCalled();
  });

  it("returns 422 on invalid message content", async () => {
    mockPrisma.serviceRequest.findUnique.mockResolvedValue({ id: "r-1", status: "OPEN" });
    const [req, ctx] = makeReq("r-1", { content: "" });
    const res = await POST(req, ctx);
    expect(res.status).toBe(422);
  });

  it("returns 500 on DB error", async () => {
    mockPrisma.serviceRequest.findUnique.mockRejectedValue(new Error("DB"));
    const [req, ctx] = makeReq("r-1", { content: "Test" });
    const res = await POST(req, ctx);
    expect(res.status).toBe(500);
  });
});
