import { describe, it, expect, vi, beforeEach } from "vitest";

const mockRequireSuperAdmin = vi.hoisted(() => vi.fn());
const mockPrisma = vi.hoisted(() => ({
  serviceRequest: { findUnique: vi.fn(), update: vi.fn() },
  serviceRequestMessage: { count: vi.fn() },
}));

vi.mock("@/lib/auth-guard", () => ({ requireSuperAdmin: mockRequireSuperAdmin }));
vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

import { PATCH } from "@/app/api/v1/super-admin/support/[id]/status/route";

const mockSA = {
  data: { superAdminId: "sa-1", authUserId: "auth-sa-1", email: "sa@rwa.com" },
  error: null,
};

function makeReq(id: string, body: Record<string, unknown>) {
  return [
    new Request(`http://localhost/api/v1/super-admin/support/${id}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ id }) },
  ] as const;
}

describe("SA Support Status Change", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireSuperAdmin.mockResolvedValue(mockSA);
  });

  it("PATCH to IN_PROGRESS (pick up)", async () => {
    mockPrisma.serviceRequest.findUnique.mockResolvedValue({ id: "r-1", status: "OPEN" });
    mockPrisma.serviceRequest.update.mockResolvedValue({ id: "r-1", status: "IN_PROGRESS" });

    const [req, ctx] = makeReq("r-1", { status: "IN_PROGRESS" });
    const res = await PATCH(req, ctx);
    expect(res.status).toBe(200);
  });

  it("PATCH to RESOLVED sets resolvedAt", async () => {
    mockPrisma.serviceRequest.findUnique.mockResolvedValue({ id: "r-1", status: "IN_PROGRESS" });
    mockPrisma.serviceRequest.update.mockResolvedValue({ id: "r-1", status: "RESOLVED" });

    const [req, ctx] = makeReq("r-1", { status: "RESOLVED" });
    const res = await PATCH(req, ctx);
    expect(res.status).toBe(200);
    expect(mockPrisma.serviceRequest.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "RESOLVED", resolvedAt: expect.any(Date) }),
      }),
    );
  });

  it("PATCH to CLOSED with reason", async () => {
    mockPrisma.serviceRequest.findUnique.mockResolvedValue({ id: "r-1", status: "OPEN" });
    mockPrisma.serviceRequest.update.mockResolvedValue({ id: "r-1", status: "CLOSED" });

    const [req, ctx] = makeReq("r-1", { status: "CLOSED", reason: "Duplicate of #1" });
    const res = await PATCH(req, ctx);
    expect(res.status).toBe(200);
    expect(mockPrisma.serviceRequest.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ closedReason: "Duplicate of #1" }),
      }),
    );
  });

  it("PATCH to CLOSED without reason requires messages", async () => {
    mockPrisma.serviceRequest.findUnique.mockResolvedValue({ id: "r-1", status: "OPEN" });
    mockPrisma.serviceRequestMessage.count.mockResolvedValue(0);

    const [req, ctx] = makeReq("r-1", { status: "CLOSED" });
    const res = await PATCH(req, ctx);
    expect(res.status).toBe(422);
  });

  it("PATCH to CLOSED without reason but with messages succeeds", async () => {
    mockPrisma.serviceRequest.findUnique.mockResolvedValue({ id: "r-1", status: "OPEN" });
    mockPrisma.serviceRequestMessage.count.mockResolvedValue(3);
    mockPrisma.serviceRequest.update.mockResolvedValue({ id: "r-1", status: "CLOSED" });

    const [req, ctx] = makeReq("r-1", { status: "CLOSED" });
    const res = await PATCH(req, ctx);
    expect(res.status).toBe(200);
  });

  it("invalid transition CLOSED → OPEN returns 400", async () => {
    mockPrisma.serviceRequest.findUnique.mockResolvedValue({ id: "r-1", status: "CLOSED" });

    const [req, ctx] = makeReq("r-1", { status: "OPEN" });
    const res = await PATCH(req, ctx);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.message).toContain("Cannot transition");
  });

  it("returns 404 when request not found", async () => {
    mockPrisma.serviceRequest.findUnique.mockResolvedValue(null);
    const [req, ctx] = makeReq("bad-id", { status: "IN_PROGRESS" });
    const res = await PATCH(req, ctx);
    expect(res.status).toBe(404);
  });

  it("returns 403 when not SA", async () => {
    mockRequireSuperAdmin.mockResolvedValue({
      data: null,
      error: new Response(JSON.stringify({ error: { code: "FORBIDDEN" } }), { status: 403 }),
    });
    const [req, ctx] = makeReq("r-1", { status: "IN_PROGRESS" });
    const res = await PATCH(req, ctx);
    expect(res.status).toBe(403);
  });

  it("returns 500 on DB error", async () => {
    mockPrisma.serviceRequest.findUnique.mockRejectedValue(new Error("DB"));
    const [req, ctx] = makeReq("r-1", { status: "IN_PROGRESS" });
    const res = await PATCH(req, ctx);
    expect(res.status).toBe(500);
  });
});
