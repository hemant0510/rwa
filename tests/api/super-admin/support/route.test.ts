import { describe, it, expect, vi, beforeEach } from "vitest";

const mockRequireSuperAdmin = vi.hoisted(() => vi.fn());
const mockPrisma = vi.hoisted(() => ({
  serviceRequest: { findMany: vi.fn(), count: vi.fn() },
}));

vi.mock("@/lib/auth-guard", () => ({ requireSuperAdmin: mockRequireSuperAdmin }));
vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

import { GET } from "@/app/api/v1/super-admin/support/route";

const mockSA = {
  data: { superAdminId: "sa-1", authUserId: "auth-sa-1", email: "sa@rwa.com" },
  error: null,
};

function makeReq(params = "") {
  return new Request(`http://localhost/api/v1/super-admin/support${params}`);
}

describe("SA Support List", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireSuperAdmin.mockResolvedValue(mockSA);
    mockPrisma.serviceRequest.findMany.mockResolvedValue([]);
    mockPrisma.serviceRequest.count.mockResolvedValue(0);
  });

  it("returns 403 when not SA", async () => {
    mockRequireSuperAdmin.mockResolvedValue({
      data: null,
      error: new Response(JSON.stringify({ error: { code: "FORBIDDEN" } }), { status: 403 }),
    });
    const res = await GET(makeReq() as never);
    expect(res.status).toBe(403);
  });

  it("lists all requests across societies", async () => {
    mockPrisma.serviceRequest.findMany.mockResolvedValue([{ id: "r-1" }, { id: "r-2" }]);
    mockPrisma.serviceRequest.count.mockResolvedValue(2);
    const res = await GET(makeReq() as never);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toHaveLength(2);
  });

  it("filters by status, societyId, type, priority", async () => {
    await GET(makeReq("?status=OPEN&societyId=soc-1&type=BUG_REPORT&priority=HIGH") as never);
    expect(mockPrisma.serviceRequest.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: "OPEN",
          societyId: "soc-1",
          type: "BUG_REPORT",
          priority: "HIGH",
        }),
      }),
    );
  });

  it("sorts by priority desc then updatedAt desc", async () => {
    await GET(makeReq() as never);
    expect(mockPrisma.serviceRequest.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [{ priority: "desc" }, { updatedAt: "desc" }],
      }),
    );
  });

  it("returns 500 on DB error", async () => {
    mockPrisma.serviceRequest.findMany.mockRejectedValue(new Error("DB"));
    const res = await GET(makeReq() as never);
    expect(res.status).toBe(500);
  });
});
