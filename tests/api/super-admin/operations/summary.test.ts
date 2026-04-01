import { describe, it, expect, vi, beforeEach } from "vitest";

// --- Hoisted mocks ---
const mockRequireSuperAdmin = vi.hoisted(() => vi.fn());
const mockPrisma = vi.hoisted(() => ({
  user: { count: vi.fn() },
  membershipFee: { aggregate: vi.fn() },
  expense: { aggregate: vi.fn() },
  communityEvent: { count: vi.fn() },
  petition: { count: vi.fn() },
  broadcast: { count: vi.fn() },
}));

vi.mock("@/lib/auth-guard", () => ({
  requireSuperAdmin: mockRequireSuperAdmin,
}));
vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

// --- Import after mocks ---
import { GET } from "@/app/api/v1/super-admin/operations/summary/route";

const mockSAContext = {
  data: {
    superAdminId: "sa-1",
    authUserId: "auth-sa-1",
    email: "sa@rwa.com",
  },
  error: null,
};

describe("GET /api/v1/super-admin/operations/summary", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireSuperAdmin.mockResolvedValue(mockSAContext);
    mockPrisma.user.count.mockResolvedValue(0);
    mockPrisma.membershipFee.aggregate.mockResolvedValue({
      _sum: { amountPaid: null, amountDue: null },
    });
    mockPrisma.expense.aggregate.mockResolvedValue({
      _sum: { amount: null },
    });
    mockPrisma.communityEvent.count.mockResolvedValue(0);
    mockPrisma.petition.count.mockResolvedValue(0);
    mockPrisma.broadcast.count.mockResolvedValue(0);
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

  it("returns summary KPIs on success", async () => {
    mockPrisma.user.count.mockResolvedValue(500);
    mockPrisma.membershipFee.aggregate
      .mockResolvedValueOnce({ _sum: { amountPaid: 80000 } })
      .mockResolvedValueOnce({ _sum: { amountDue: 100000 } });
    mockPrisma.expense.aggregate.mockResolvedValue({
      _sum: { amount: 25000 },
    });
    mockPrisma.communityEvent.count.mockResolvedValue(12);
    mockPrisma.petition.count.mockResolvedValue(3);
    mockPrisma.broadcast.count.mockResolvedValue(8);

    const res = await GET();
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.totalResidents).toBe(500);
    expect(body.collectionRate).toBe(80);
    expect(body.totalExpensesThisMonth).toBe(25000);
    expect(body.activeEvents).toBe(12);
    expect(body.activePetitions).toBe(3);
    expect(body.broadcastsThisMonth).toBe(8);
  });

  it("returns 0% collection rate when no dues exist", async () => {
    mockPrisma.membershipFee.aggregate
      .mockResolvedValueOnce({ _sum: { amountPaid: null } })
      .mockResolvedValueOnce({ _sum: { amountDue: null } });

    const res = await GET();
    const body = await res.json();
    expect(body.collectionRate).toBe(0);
  });

  it("handles null aggregate sums gracefully", async () => {
    const res = await GET();
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.totalResidents).toBe(0);
    expect(body.collectionRate).toBe(0);
    expect(body.totalExpensesThisMonth).toBe(0);
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
    expect(mockPrisma.user.count).not.toHaveBeenCalled();
    expect(mockPrisma.membershipFee.aggregate).not.toHaveBeenCalled();
  });

  it("returns 500 when Prisma throws", async () => {
    mockPrisma.user.count.mockRejectedValue(new Error("DB connection failed"));

    const res = await GET();
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error.code).toBe("INTERNAL_ERROR");
  });

  it("rounds collection rate to 2 decimal places", async () => {
    mockPrisma.membershipFee.aggregate
      .mockResolvedValueOnce({ _sum: { amountPaid: 33333 } })
      .mockResolvedValueOnce({ _sum: { amountDue: 100000 } });

    const res = await GET();
    const body = await res.json();
    expect(body.collectionRate).toBe(33.33);
  });
});
