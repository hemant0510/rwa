import { describe, it, expect, vi, beforeEach } from "vitest";

const mockRequireSuperAdmin = vi.hoisted(() => vi.fn());
const mockPrisma = vi.hoisted(() => ({
  serviceRequest: { count: vi.fn(), aggregate: vi.fn(), findMany: vi.fn() },
}));

vi.mock("@/lib/auth-guard", () => ({ requireSuperAdmin: mockRequireSuperAdmin }));
vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

import { GET } from "@/app/api/v1/super-admin/support/stats/route";

const mockSA = {
  data: { superAdminId: "sa-1", authUserId: "auth-sa-1", email: "sa@rwa.com" },
  error: null,
};

describe("SA Support Stats", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireSuperAdmin.mockResolvedValue(mockSA);
    mockPrisma.serviceRequest.count.mockResolvedValue(0);
    mockPrisma.serviceRequest.aggregate.mockResolvedValue({
      _avg: { requestNumber: null },
      _count: 0,
    });
    mockPrisma.serviceRequest.findMany.mockResolvedValue([]);
  });

  it("returns 403 when not SA", async () => {
    mockRequireSuperAdmin.mockResolvedValue({
      data: null,
      error: new Response(JSON.stringify({ error: { code: "FORBIDDEN" } }), { status: 403 }),
    });
    const res = await GET();
    expect(res.status).toBe(403);
  });

  it("returns correct counts", async () => {
    mockPrisma.serviceRequest.count
      .mockResolvedValueOnce(5) // open
      .mockResolvedValueOnce(3) // inProgress
      .mockResolvedValueOnce(2) // awaitingSA
      .mockResolvedValueOnce(7); // resolved7d

    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.open).toBe(5);
    expect(body.inProgress).toBe(3);
    expect(body.awaitingSA).toBe(2);
    expect(body.resolved7d).toBe(7);
  });

  it("returns null avgResolutionHours when no resolved requests", async () => {
    const res = await GET();
    const body = await res.json();
    expect(body.avgResolutionHours).toBeNull();
  });

  it("handles resolved requests with null resolvedAt in average calc", async () => {
    mockPrisma.serviceRequest.aggregate.mockResolvedValue({
      _avg: { requestNumber: 1 },
      _count: 1,
    });
    const now = Date.now();
    mockPrisma.serviceRequest.findMany.mockResolvedValue([
      { createdAt: new Date(now - 24 * 60 * 60 * 1000), resolvedAt: null }, // null resolvedAt
    ]);

    const res = await GET();
    const body = await res.json();
    // With null resolvedAt, the sum stays 0, so avg = 0
    expect(body.avgResolutionHours).toBe(0);
  });

  it("calculates avgResolutionHours from resolved requests", async () => {
    mockPrisma.serviceRequest.aggregate.mockResolvedValue({
      _avg: { requestNumber: 1 },
      _count: 2,
    });
    const now = Date.now();
    mockPrisma.serviceRequest.findMany.mockResolvedValue([
      { createdAt: new Date(now - 48 * 60 * 60 * 1000), resolvedAt: new Date(now) }, // 48h
      { createdAt: new Date(now - 24 * 60 * 60 * 1000), resolvedAt: new Date(now) }, // 24h
    ]);

    const res = await GET();
    const body = await res.json();
    expect(body.avgResolutionHours).toBe(36); // average of 48 and 24
  });

  it("returns 500 on DB error", async () => {
    mockPrisma.serviceRequest.count.mockRejectedValue(new Error("DB"));
    const res = await GET();
    expect(res.status).toBe(500);
  });
});
