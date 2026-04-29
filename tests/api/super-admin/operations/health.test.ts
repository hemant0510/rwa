import { describe, it, expect, vi, beforeEach } from "vitest";

// --- Hoisted mocks ---
const mockRequireSuperAdmin = vi.hoisted(() => vi.fn());
const mockPrisma = vi.hoisted(() => ({
  society: { findMany: vi.fn() },
  user: { count: vi.fn(), findFirst: vi.fn() },
  membershipFee: { aggregate: vi.fn() },
  expense: { aggregate: vi.fn() },
  feePayment: { aggregate: vi.fn() },
  communityEvent: { count: vi.fn() },
  petition: { count: vi.fn() },
}));

vi.mock("@/lib/auth-guard", () => ({
  requireSuperAdmin: mockRequireSuperAdmin,
}));
vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

// --- Import after mocks ---
import { computeHealthScore } from "@/app/api/v1/super-admin/operations/health/compute-health-score";
import { GET } from "@/app/api/v1/super-admin/operations/health/route";

const mockSAContext = {
  data: {
    superAdminId: "sa-1",
    authUserId: "auth-sa-1",
    email: "sa@rwa.com",
  },
  error: null,
};

describe("GET /api/v1/super-admin/operations/health", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireSuperAdmin.mockResolvedValue(mockSAContext);
    mockPrisma.society.findMany.mockResolvedValue([]);
  });

  it("returns 403 when requireSuperAdmin fails", async () => {
    const forbiddenResponse = new Response(
      JSON.stringify({
        error: { code: "FORBIDDEN", message: "Super admin access required" },
      }),
      { status: 403, headers: { "Content-Type": "application/json" } },
    );
    mockRequireSuperAdmin.mockResolvedValue({
      data: null,
      error: forbiddenResponse,
    });

    const res = await GET();
    expect(res.status).toBe(403);
  });

  it("returns empty array when no societies exist", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.societies).toEqual([]);
  });

  it("returns health data for societies", async () => {
    mockPrisma.society.findMany.mockResolvedValue([
      { id: "soc-1", name: "Greenwood Residency", status: "ACTIVE" },
    ]);

    // Per-society queries (9 parallel calls per society)
    mockPrisma.user.count
      .mockResolvedValueOnce(50) // residentCount
      .mockResolvedValueOnce(5); // newResidents30d
    mockPrisma.membershipFee.aggregate
      .mockResolvedValueOnce({ _sum: { amountPaid: 80000 } }) // feeAgg
      .mockResolvedValueOnce({ _sum: { amountDue: 100000 } }); // dueAgg
    mockPrisma.expense.aggregate.mockResolvedValue({
      _sum: { amount: 20000 },
    });
    mockPrisma.feePayment.aggregate.mockResolvedValue({
      _sum: { amount: 90000 },
    });
    mockPrisma.communityEvent.count.mockResolvedValue(3);
    mockPrisma.petition.count.mockResolvedValue(2);
    mockPrisma.user.findFirst.mockResolvedValue({
      updatedAt: new Date(),
    });

    const res = await GET();
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.societies).toHaveLength(1);
    expect(body.societies[0].name).toBe("Greenwood Residency");
    expect(body.societies[0].residents).toBe(50);
    expect(body.societies[0].collectionRate).toBe(80);
    expect(body.societies[0].events30d).toBe(3);
    expect(body.societies[0].petitions30d).toBe(2);
    expect(typeof body.societies[0].healthScore).toBe("number");
    expect(body.societies[0].lastAdminLogin).not.toBeNull();
  });

  it("handles null aggregate sums", async () => {
    mockPrisma.society.findMany.mockResolvedValue([
      { id: "soc-1", name: "Empty Society", status: "TRIAL" },
    ]);
    mockPrisma.user.count.mockResolvedValue(0);
    mockPrisma.membershipFee.aggregate.mockResolvedValue({
      _sum: { amountPaid: null, amountDue: null },
    });
    mockPrisma.expense.aggregate.mockResolvedValue({
      _sum: { amount: null },
    });
    mockPrisma.feePayment.aggregate.mockResolvedValue({
      _sum: { amount: null },
    });
    mockPrisma.communityEvent.count.mockResolvedValue(0);
    mockPrisma.petition.count.mockResolvedValue(0);
    mockPrisma.user.findFirst.mockResolvedValue(null);

    const res = await GET();
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.societies[0].collectionRate).toBe(0);
    expect(body.societies[0].balance).toBe(0);
    expect(body.societies[0].lastAdminLogin).toBeNull();
  });

  it("sorts societies by health score descending", async () => {
    mockPrisma.society.findMany.mockResolvedValue([
      { id: "soc-1", name: "Low Health", status: "ACTIVE" },
      { id: "soc-2", name: "High Health", status: "ACTIVE" },
    ]);

    // Society 1: low health (0% collection, no admin, no growth)
    mockPrisma.user.count
      .mockResolvedValueOnce(10) // soc-1 residents
      .mockResolvedValueOnce(0) // soc-1 new residents
      .mockResolvedValueOnce(50) // soc-2 residents
      .mockResolvedValueOnce(10); // soc-2 new residents
    mockPrisma.membershipFee.aggregate
      .mockResolvedValueOnce({ _sum: { amountPaid: 0 } }) // soc-1 paid
      .mockResolvedValueOnce({ _sum: { amountDue: 100000 } }) // soc-1 due
      .mockResolvedValueOnce({ _sum: { amountPaid: 95000 } }) // soc-2 paid
      .mockResolvedValueOnce({ _sum: { amountDue: 100000 } }); // soc-2 due
    mockPrisma.expense.aggregate
      .mockResolvedValueOnce({ _sum: { amount: 50000 } }) // soc-1
      .mockResolvedValueOnce({ _sum: { amount: 10000 } }); // soc-2
    mockPrisma.feePayment.aggregate
      .mockResolvedValueOnce({ _sum: { amount: 0 } }) // soc-1
      .mockResolvedValueOnce({ _sum: { amount: 90000 } }); // soc-2
    mockPrisma.communityEvent.count
      .mockResolvedValueOnce(0) // soc-1
      .mockResolvedValueOnce(5); // soc-2
    mockPrisma.petition.count
      .mockResolvedValueOnce(0) // soc-1
      .mockResolvedValueOnce(3); // soc-2
    mockPrisma.user.findFirst
      .mockResolvedValueOnce(null) // soc-1: no admin login
      .mockResolvedValueOnce({ updatedAt: new Date() }); // soc-2: recent login

    const res = await GET();
    const body = await res.json();

    expect(body.societies[0].name).toBe("High Health");
    expect(body.societies[1].name).toBe("Low Health");
    expect(body.societies[0].healthScore).toBeGreaterThan(body.societies[1].healthScore);
  });

  it("does not call Prisma when auth fails", async () => {
    const forbiddenResponse = new Response(JSON.stringify({ error: { code: "FORBIDDEN" } }), {
      status: 403,
    });
    mockRequireSuperAdmin.mockResolvedValue({
      data: null,
      error: forbiddenResponse,
    });

    await GET();
    expect(mockPrisma.society.findMany).not.toHaveBeenCalled();
  });

  it("returns 500 when Prisma throws", async () => {
    mockPrisma.society.findMany.mockRejectedValue(new Error("DB connection failed"));

    const res = await GET();
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error.code).toBe("INTERNAL_ERROR");
  });
});

describe("computeHealthScore", () => {
  it("returns max score for perfect metrics", () => {
    const score = computeHealthScore(100, 1, 100, 10, 50000);
    expect(score).toBe(100);
  });

  it("returns low score for poor metrics", () => {
    const score = computeHealthScore(0, null, 0, 0, -1000);
    expect(score).toBe(0);
  });

  it("handles admin login within 3 days", () => {
    const score = computeHealthScore(0, 2, 0, 0, 0);
    // adminScore = 100 * 0.25 = 25, balanceScore = 50 * 0.15 = 7.5
    expect(score).toBe(33); // 25 + 7.5 rounded
  });

  it("handles admin login within 7 days", () => {
    const score = computeHealthScore(0, 5, 0, 0, 0);
    // adminScore = 70 * 0.25 = 17.5, balanceScore = 50 * 0.15 = 7.5
    expect(score).toBe(25);
  });

  it("handles admin login within 14 days", () => {
    const score = computeHealthScore(0, 10, 0, 0, 0);
    // adminScore = 40 * 0.25 = 10, balanceScore = 50 * 0.15 = 7.5
    expect(score).toBe(18);
  });

  it("handles admin login beyond 14 days", () => {
    const score = computeHealthScore(0, 30, 0, 0, 0);
    // adminScore = 10 * 0.25 = 2.5, balanceScore = 50 * 0.15 = 7.5
    expect(score).toBe(10);
  });

  it("caps collection rate at 100", () => {
    const score = computeHealthScore(200, 1, 100, 10, 50000);
    // Even if collectionRate > 100, it caps at 100
    expect(score).toBe(100);
  });

  it("handles zero balance as 50 score for balance component", () => {
    const score = computeHealthScore(0, null, 0, 0, 0);
    // balanceScore = 50 * 0.15 = 7.5, everything else 0
    expect(score).toBe(8); // rounds up from 7.5
  });

  it("handles engagement score capping at 5 activities", () => {
    // 5 * 20 = 100 (capped)
    const score5 = computeHealthScore(0, null, 0, 5, 0);
    const score10 = computeHealthScore(0, null, 0, 10, 0);
    // Both should have same engagement component: 100 * 0.15 = 15
    expect(score5).toBe(score10);
  });
});
