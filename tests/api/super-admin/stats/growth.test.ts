import { describe, it, expect, vi, beforeEach } from "vitest";

const mockRequireSuperAdmin = vi.hoisted(() => vi.fn());
const mockPrisma = vi.hoisted(() => ({
  society: { findMany: vi.fn() },
}));

vi.mock("@/lib/auth-guard", () => ({ requireSuperAdmin: mockRequireSuperAdmin }));
vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

import { GET } from "@/app/api/v1/super-admin/stats/growth/route";

const saOk = {
  data: { superAdminId: "sa-1", authUserId: "auth-1", email: "sa@rwa.com" },
  error: null,
};

describe("GET /api/v1/super-admin/stats/growth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireSuperAdmin.mockResolvedValue(saOk);
    mockPrisma.society.findMany.mockResolvedValue([]);
  });

  it("returns 403 when not super admin", async () => {
    const forbiddenResponse = new Response(JSON.stringify({ error: { code: "FORBIDDEN" } }), {
      status: 403,
    });
    mockRequireSuperAdmin.mockResolvedValue({ data: null, error: forbiddenResponse });

    const res = await GET();
    expect(res.status).toBe(403);
  });

  it("returns 200 with data array of 12 months", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toHaveLength(12);
    expect(body).toHaveProperty("totalBefore");
  });

  it("returns zero counts when no societies", async () => {
    const res = await GET();
    const body = await res.json();
    expect(body.data.every((d: { count: number }) => d.count === 0)).toBe(true);
    expect(body.totalBefore).toBe(0);
  });

  it("includes society onboarded this month in last bucket", async () => {
    const thisMonth = new Date();
    thisMonth.setDate(5);
    mockPrisma.society.findMany.mockResolvedValue([{ onboardingDate: thisMonth }]);

    const res = await GET();
    const body = await res.json();
    const lastBucket = body.data[11];
    expect(lastBucket.count).toBe(1);
  });

  it("cumulates societies from earlier months in later buckets", async () => {
    const now = new Date();
    // One society each: 3 months ago and 1 month ago
    const threeMo = new Date(now.getFullYear(), now.getMonth() - 3, 15);
    const oneMo = new Date(now.getFullYear(), now.getMonth() - 1, 15);
    mockPrisma.society.findMany.mockResolvedValue([
      { onboardingDate: threeMo },
      { onboardingDate: oneMo },
    ]);

    const res = await GET();
    const body = await res.json();
    // Last bucket should include both
    expect(body.data[11].count).toBe(2);
    // 3 months ago bucket should include only the first
    expect(body.data[8].count).toBe(1);
  });

  it("counts societies before 12-month window in totalBefore", async () => {
    const now = new Date();
    const twoYearsAgo = new Date(now.getFullYear() - 2, now.getMonth(), 15);
    mockPrisma.society.findMany.mockResolvedValue([{ onboardingDate: twoYearsAgo }]);

    const res = await GET();
    const body = await res.json();
    expect(body.totalBefore).toBe(1);
    // But it still appears in cumulative counts for all 12 months
  });

  it("each data point has month label and count fields", async () => {
    const res = await GET();
    const body = await res.json();
    for (const d of body.data) {
      expect(d).toHaveProperty("month");
      expect(d).toHaveProperty("count");
      expect(typeof d.month).toBe("string");
      expect(typeof d.count).toBe("number");
    }
  });

  it("returns 500 on DB error", async () => {
    mockPrisma.society.findMany.mockRejectedValue(new Error("DB error"));

    const res = await GET();
    expect(res.status).toBe(500);
  });
});
