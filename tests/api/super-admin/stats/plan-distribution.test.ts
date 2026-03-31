import { describe, it, expect, vi, beforeEach } from "vitest";

const mockRequireSuperAdmin = vi.hoisted(() => vi.fn());
const mockPrisma = vi.hoisted(() => ({
  societySubscription: { groupBy: vi.fn() },
  platformPlan: { findMany: vi.fn() },
}));

vi.mock("@/lib/auth-guard", () => ({ requireSuperAdmin: mockRequireSuperAdmin }));
vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

import { GET } from "@/app/api/v1/super-admin/stats/plan-distribution/route";

const saOk = {
  data: { superAdminId: "sa-1", authUserId: "auth-1", email: "sa@rwa.com" },
  error: null,
};

describe("GET /api/v1/super-admin/stats/plan-distribution", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireSuperAdmin.mockResolvedValue(saOk);
    mockPrisma.societySubscription.groupBy.mockResolvedValue([]);
    mockPrisma.platformPlan.findMany.mockResolvedValue([]);
  });

  it("returns 403 when not super admin", async () => {
    const forbiddenResponse = new Response(JSON.stringify({ error: { code: "FORBIDDEN" } }), {
      status: 403,
    });
    mockRequireSuperAdmin.mockResolvedValue({ data: null, error: forbiddenResponse });

    const res = await GET();
    expect(res.status).toBe(403);
  });

  it("returns 200 with empty array when no active subscriptions", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual([]);
  });

  it("returns distribution with plan names and percentages", async () => {
    mockPrisma.societySubscription.groupBy.mockResolvedValue([
      { planId: "plan-1", _count: { planId: 3 } },
      { planId: "plan-2", _count: { planId: 1 } },
    ]);
    mockPrisma.platformPlan.findMany.mockResolvedValue([
      { id: "plan-1", name: "Basic" },
      { id: "plan-2", name: "Pro" },
    ]);

    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveLength(2);

    const basic = body.find((d: { planName: string }) => d.planName === "Basic");
    expect(basic.count).toBe(3);
    expect(basic.percentage).toBe(75); // 3/4 * 100

    const pro = body.find((d: { planName: string }) => d.planName === "Pro");
    expect(pro.count).toBe(1);
    expect(pro.percentage).toBe(25);
  });

  it("sorts results by count descending", async () => {
    mockPrisma.societySubscription.groupBy.mockResolvedValue([
      { planId: "plan-1", _count: { planId: 1 } },
      { planId: "plan-2", _count: { planId: 5 } },
    ]);
    mockPrisma.platformPlan.findMany.mockResolvedValue([
      { id: "plan-1", name: "Basic" },
      { id: "plan-2", name: "Pro" },
    ]);

    const res = await GET();
    const body = await res.json();
    expect(body[0].planName).toBe("Pro");
    expect(body[1].planName).toBe("Basic");
  });

  it("uses 'Unknown' when plan name is not found", async () => {
    mockPrisma.societySubscription.groupBy.mockResolvedValue([
      { planId: "plan-orphan", _count: { planId: 2 } },
    ]);
    mockPrisma.platformPlan.findMany.mockResolvedValue([]);

    const res = await GET();
    const body = await res.json();
    expect(body[0].planName).toBe("Unknown");
  });

  it("each item has planId, planName, count, percentage fields", async () => {
    mockPrisma.societySubscription.groupBy.mockResolvedValue([
      { planId: "plan-1", _count: { planId: 2 } },
    ]);
    mockPrisma.platformPlan.findMany.mockResolvedValue([{ id: "plan-1", name: "Basic" }]);

    const res = await GET();
    const body = await res.json();
    expect(body[0]).toHaveProperty("planId");
    expect(body[0]).toHaveProperty("planName");
    expect(body[0]).toHaveProperty("count");
    expect(body[0]).toHaveProperty("percentage");
  });

  it("returns 500 on DB error", async () => {
    mockPrisma.societySubscription.groupBy.mockRejectedValue(new Error("DB error"));

    const res = await GET();
    expect(res.status).toBe(500);
  });
});
