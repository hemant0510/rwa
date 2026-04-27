import { describe, it, expect, vi, beforeEach } from "vitest";

// --- Hoisted mocks ---
const mockRequireSuperAdmin = vi.hoisted(() => vi.fn());
const mockPrisma = vi.hoisted(() => ({
  society: {
    count: vi.fn(),
    findMany: vi.fn(),
  },
}));

vi.mock("@/lib/auth-guard", () => ({ requireSuperAdmin: mockRequireSuperAdmin }));
vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

// --- Import after mocks ---
import { GET } from "@/app/api/v1/super-admin/stats/route";

const mockSAContext = {
  data: { superAdminId: "sa-1", authUserId: "auth-sa-1", email: "sa@rwa.com" },
  error: null,
};

describe("GET /api/v1/super-admin/stats", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireSuperAdmin.mockResolvedValue(mockSAContext);
    mockPrisma.society.count.mockResolvedValue(0);
    mockPrisma.society.findMany.mockResolvedValue([]);
  });

  it("returns 403 when requireSuperAdmin fails", async () => {
    const forbiddenResponse = new Response(
      JSON.stringify({ error: { code: "FORBIDDEN", message: "Super admin access required" } }),
      { status: 403, headers: { "Content-Type": "application/json" } },
    );
    mockRequireSuperAdmin.mockResolvedValue({ data: null, error: forbiddenResponse });

    const res = await GET();
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error.code).toBe("FORBIDDEN");
  });

  it("returns 401 when not authenticated", async () => {
    const unauthorizedResponse = new Response(
      JSON.stringify({ error: { code: "UNAUTHORIZED", message: "Not authenticated" } }),
      { status: 401, headers: { "Content-Type": "application/json" } },
    );
    mockRequireSuperAdmin.mockResolvedValue({ data: null, error: unauthorizedResponse });

    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("returns stats when SA is authenticated", async () => {
    mockPrisma.society.count
      .mockResolvedValueOnce(10) // total
      .mockResolvedValueOnce(5) // active
      .mockResolvedValueOnce(3) // trial
      .mockResolvedValueOnce(2); // suspended
    mockPrisma.society.findMany.mockResolvedValue([
      {
        id: "soc-1",
        name: "Greenwood Residency",
        societyCode: "GRNW",
        city: "Gurgaon",
        status: "ACTIVE",
        onboardingDate: new Date("2026-01-15"),
      },
    ]);

    const res = await GET();
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.total).toBe(10);
    expect(body.active).toBe(5);
    expect(body.trial).toBe(3);
    expect(body.suspended).toBe(2);
    expect(body.recentSocieties).toHaveLength(1);
    expect(body.recentSocieties[0].name).toBe("Greenwood Residency");
  });

  it("does not call Prisma when auth fails", async () => {
    const forbiddenResponse = new Response(JSON.stringify({ error: { code: "FORBIDDEN" } }), {
      status: 403,
    });
    mockRequireSuperAdmin.mockResolvedValue({ data: null, error: forbiddenResponse });

    await GET();
    expect(mockPrisma.society.count).not.toHaveBeenCalled();
    expect(mockPrisma.society.findMany).not.toHaveBeenCalled();
  });

  it("returns 500 when Prisma throws", async () => {
    mockPrisma.society.count.mockRejectedValue(new Error("DB connection failed"));

    const res = await GET();
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error.code).toBe("INTERNAL_ERROR");
  });
});
