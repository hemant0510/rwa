import { describe, it, expect, vi, beforeEach } from "vitest";

const mockGetCurrentUser = vi.hoisted(() => vi.fn());
const mockPrisma = vi.hoisted(() => ({
  serviceRequest: { findUnique: vi.fn(), update: vi.fn() },
}));

vi.mock("@/lib/get-current-user", () => ({ getCurrentUser: mockGetCurrentUser }));
vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

import { POST } from "@/app/api/v1/admin/support/[id]/reopen/route";

const mockAdmin = {
  userId: "u-1",
  authUserId: "auth-1",
  societyId: "soc-1",
  role: "RWA_ADMIN",
  adminPermission: "FULL_ACCESS",
};

function makeReq(id: string) {
  return [
    new Request(`http://localhost/api/v1/admin/support/${id}/reopen`, { method: "POST" }),
    { params: Promise.resolve({ id }) },
  ] as const;
}

describe("Admin Support Reopen", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCurrentUser.mockResolvedValue(mockAdmin);
  });

  it("reopens RESOLVED request within 7 days", async () => {
    mockPrisma.serviceRequest.findUnique.mockResolvedValue({
      id: "r-1",
      status: "RESOLVED",
      resolvedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // 3 days ago
    });
    mockPrisma.serviceRequest.update.mockResolvedValue({});

    const [req, ctx] = makeReq("r-1");
    const res = await POST(req, ctx);
    expect(res.status).toBe(200);
    expect(mockPrisma.serviceRequest.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { status: "OPEN", resolvedAt: null } }),
    );
  });

  it("rejects reopen after 7 days", async () => {
    mockPrisma.serviceRequest.findUnique.mockResolvedValue({
      id: "r-1",
      status: "RESOLVED",
      resolvedAt: new Date(Date.now() - 8 * 24 * 60 * 60 * 1000), // 8 days ago
    });

    const [req, ctx] = makeReq("r-1");
    const res = await POST(req, ctx);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.message).toContain("expired");
  });

  it("rejects reopen of non-RESOLVED request", async () => {
    mockPrisma.serviceRequest.findUnique.mockResolvedValue({
      id: "r-1",
      status: "OPEN",
    });

    const [req, ctx] = makeReq("r-1");
    const res = await POST(req, ctx);
    expect(res.status).toBe(400);
  });

  it("returns 404 when request not found", async () => {
    mockPrisma.serviceRequest.findUnique.mockResolvedValue(null);
    const [req, ctx] = makeReq("bad-id");
    const res = await POST(req, ctx);
    expect(res.status).toBe(404);
  });

  it("returns 403 when not admin", async () => {
    mockGetCurrentUser.mockResolvedValue(null);
    const [req, ctx] = makeReq("r-1");
    const res = await POST(req, ctx);
    expect(res.status).toBe(403);
  });

  it("reopens when resolvedAt is null", async () => {
    mockPrisma.serviceRequest.findUnique.mockResolvedValue({
      id: "r-1",
      status: "RESOLVED",
      resolvedAt: null,
    });
    mockPrisma.serviceRequest.update.mockResolvedValue({});

    const [req, ctx] = makeReq("r-1");
    const res = await POST(req, ctx);
    expect(res.status).toBe(200);
  });

  it("returns 500 on DB error", async () => {
    mockPrisma.serviceRequest.findUnique.mockRejectedValue(new Error("DB"));
    const [req, ctx] = makeReq("r-1");
    const res = await POST(req, ctx);
    expect(res.status).toBe(500);
  });
});
