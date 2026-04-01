import { describe, it, expect, vi, beforeEach } from "vitest";

const mockGetCurrentUser = vi.hoisted(() => vi.fn());
const mockPrisma = vi.hoisted(() => ({
  serviceRequest: { findUnique: vi.fn(), update: vi.fn() },
  serviceRequestMessage: { create: vi.fn() },
}));

vi.mock("@/lib/get-current-user", () => ({ getCurrentUser: mockGetCurrentUser }));
vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

import { POST } from "@/app/api/v1/admin/support/[id]/messages/route";

const mockAdmin = {
  userId: "u-1",
  authUserId: "auth-1",
  societyId: "soc-1",
  role: "RWA_ADMIN",
  adminPermission: "FULL_ACCESS",
};

function makeReq(id: string, body: Record<string, unknown>) {
  return [
    new Request(`http://localhost/api/v1/admin/support/${id}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ id }) },
  ] as const;
}

describe("Admin Support Messages", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCurrentUser.mockResolvedValue(mockAdmin);
  });

  it("POST adds message and sets status to AWAITING_SA", async () => {
    mockPrisma.serviceRequest.findUnique.mockResolvedValue({ id: "r-1", status: "OPEN" });
    mockPrisma.serviceRequestMessage.create.mockResolvedValue({ id: "msg-1" });
    mockPrisma.serviceRequest.update.mockResolvedValue({});

    const [req, ctx] = makeReq("r-1", { content: "Here is more info" });
    const res = await POST(req, ctx);
    expect(res.status).toBe(201);
    expect(mockPrisma.serviceRequest.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: "AWAITING_SA" } }),
    );
  });

  it("POST to CLOSED request returns 400", async () => {
    mockPrisma.serviceRequest.findUnique.mockResolvedValue({ id: "r-1", status: "CLOSED" });

    const [req, ctx] = makeReq("r-1", { content: "Test message" });
    const res = await POST(req, ctx);
    expect(res.status).toBe(400);
  });

  it("returns 404 when request not found", async () => {
    mockPrisma.serviceRequest.findUnique.mockResolvedValue(null);
    const [req, ctx] = makeReq("bad-id", { content: "Test" });
    const res = await POST(req, ctx);
    expect(res.status).toBe(404);
  });

  it("returns 403 when not admin", async () => {
    mockGetCurrentUser.mockResolvedValue(null);
    const [req, ctx] = makeReq("r-1", { content: "Test" });
    const res = await POST(req, ctx);
    expect(res.status).toBe(403);
  });

  it("does not update status if already AWAITING_SA", async () => {
    mockPrisma.serviceRequest.findUnique.mockResolvedValue({ id: "r-1", status: "AWAITING_SA" });
    mockPrisma.serviceRequestMessage.create.mockResolvedValue({ id: "msg-1" });

    const [req, ctx] = makeReq("r-1", { content: "Another message" });
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
