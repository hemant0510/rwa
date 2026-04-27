import { describe, it, expect, vi, beforeEach } from "vitest";

// --- Hoisted mocks ---
const mockRequireSuperAdmin = vi.hoisted(() => vi.fn());
const mockPrisma = vi.hoisted(() => ({
  user: {
    findMany: vi.fn(),
    count: vi.fn(),
  },
}));
const mockCreateSignedUrl = vi.hoisted(() =>
  vi.fn().mockResolvedValue({
    data: { signedUrl: "https://example.com/signed-photo" },
    error: null,
  }),
);

vi.mock("@/lib/auth-guard", () => ({
  requireSuperAdmin: mockRequireSuperAdmin,
}));
vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    storage: {
      from: () => ({
        createSignedUrl: mockCreateSignedUrl,
      }),
    },
  }),
}));

// --- Import after mocks ---
import { GET } from "@/app/api/v1/super-admin/residents/route";

const mockSAContext = {
  data: {
    superAdminId: "sa-1",
    authUserId: "auth-sa-1",
    email: "sa@rwa.com",
  },
  error: null,
};

function makeRequest(params: Record<string, string> = {}) {
  const url = new URL("http://localhost:3000/api/v1/super-admin/residents");
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return new Request(url.toString()) as unknown as import("next/server").NextRequest;
}

describe("GET /api/v1/super-admin/residents", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireSuperAdmin.mockResolvedValue(mockSAContext);
    mockPrisma.user.findMany.mockResolvedValue([]);
    mockPrisma.user.count.mockResolvedValue(0);
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

    const res = await GET(makeRequest());
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error.code).toBe("FORBIDDEN");
  });

  it("returns 401 when not authenticated", async () => {
    const unauthorizedResponse = new Response(
      JSON.stringify({
        error: { code: "UNAUTHORIZED", message: "Not authenticated" },
      }),
      { status: 401, headers: { "Content-Type": "application/json" } },
    );
    mockRequireSuperAdmin.mockResolvedValue({
      data: null,
      error: unauthorizedResponse,
    });

    const res = await GET(makeRequest());
    expect(res.status).toBe(401);
  });

  it("returns residents with KPI data on success", async () => {
    const mockUsers = [
      {
        id: "u-1",
        name: "John",
        email: "john@test.com",
        mobile: "9876543210",
        rwaid: "EDEN-001",
        status: "ACTIVE_PAID",
        ownershipType: "OWNER",
        createdAt: new Date(),
        societyId: "soc-1",
        society: { name: "Greenwood Residency" },
        userUnits: [{ unit: { unitNumber: "A-101" } }],
      },
    ];

    mockPrisma.user.findMany.mockResolvedValue(mockUsers);
    // count calls: filtered total, totalAll, activePaid, pending, overdue
    mockPrisma.user.count
      .mockResolvedValueOnce(1) // filtered total
      .mockResolvedValueOnce(100) // totalAll
      .mockResolvedValueOnce(60) // activePaid
      .mockResolvedValueOnce(20) // pending
      .mockResolvedValueOnce(10); // overdue

    const res = await GET(makeRequest());
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.data).toHaveLength(1);
    expect(body.data[0].name).toBe("John");
    expect(body.total).toBe(1);
    expect(body.page).toBe(1);
    expect(body.limit).toBe(50);
    expect(body.totalPages).toBe(1);
    expect(body.kpis.totalAll).toBe(100);
    expect(body.kpis.activePaid).toBe(60);
    expect(body.kpis.pending).toBe(20);
    expect(body.kpis.overdue).toBe(10);
  });

  it("applies ACTIVE status filter correctly", async () => {
    mockPrisma.user.findMany.mockResolvedValue([]);
    mockPrisma.user.count.mockResolvedValue(0);

    await GET(makeRequest({ status: "ACTIVE" }));

    const findManyCall = mockPrisma.user.findMany.mock.calls[0][0];
    expect(findManyCall.where.status).toEqual({
      in: ["ACTIVE_PAID", "ACTIVE_PENDING", "ACTIVE_OVERDUE", "ACTIVE_PARTIAL", "ACTIVE_EXEMPTED"],
    });
  });

  it("applies PENDING status filter correctly", async () => {
    mockPrisma.user.findMany.mockResolvedValue([]);
    mockPrisma.user.count.mockResolvedValue(0);

    await GET(makeRequest({ status: "PENDING" }));

    const findManyCall = mockPrisma.user.findMany.mock.calls[0][0];
    expect(findManyCall.where.status).toBe("PENDING_APPROVAL");
  });

  it("applies OVERDUE status filter correctly", async () => {
    mockPrisma.user.findMany.mockResolvedValue([]);
    mockPrisma.user.count.mockResolvedValue(0);

    await GET(makeRequest({ status: "OVERDUE" }));

    const findManyCall = mockPrisma.user.findMany.mock.calls[0][0];
    expect(findManyCall.where.status).toBe("ACTIVE_OVERDUE");
  });

  it("applies custom status filter", async () => {
    mockPrisma.user.findMany.mockResolvedValue([]);
    mockPrisma.user.count.mockResolvedValue(0);

    await GET(makeRequest({ status: "DEACTIVATED" }));

    const findManyCall = mockPrisma.user.findMany.mock.calls[0][0];
    expect(findManyCall.where.status).toBe("DEACTIVATED");
  });

  it("applies search filter across name, mobile, email, rwaid", async () => {
    mockPrisma.user.findMany.mockResolvedValue([]);
    mockPrisma.user.count.mockResolvedValue(0);

    await GET(makeRequest({ search: "john" }));

    const findManyCall = mockPrisma.user.findMany.mock.calls[0][0];
    expect(findManyCall.where.OR).toHaveLength(4);
    expect(findManyCall.where.OR[0]).toEqual({
      name: { contains: "john", mode: "insensitive" },
    });
  });

  it("applies societyId filter", async () => {
    mockPrisma.user.findMany.mockResolvedValue([]);
    mockPrisma.user.count.mockResolvedValue(0);

    await GET(makeRequest({ societyId: "soc-123" }));

    const findManyCall = mockPrisma.user.findMany.mock.calls[0][0];
    expect(findManyCall.where.societyId).toBe("soc-123");
  });

  it("handles pagination parameters", async () => {
    mockPrisma.user.findMany.mockResolvedValue([]);
    mockPrisma.user.count.mockResolvedValue(200);

    const res = await GET(makeRequest({ page: "3", limit: "25" }));
    const body = await res.json();

    expect(body.page).toBe(3);
    expect(body.limit).toBe(25);
    expect(body.totalPages).toBe(8);

    const findManyCall = mockPrisma.user.findMany.mock.calls[0][0];
    expect(findManyCall.skip).toBe(50); // (3-1) * 25
    expect(findManyCall.take).toBe(25);
  });

  it("clamps limit to MAX_PAGE_SIZE (100)", async () => {
    mockPrisma.user.findMany.mockResolvedValue([]);
    mockPrisma.user.count.mockResolvedValue(0);

    await GET(makeRequest({ limit: "500" }));

    const findManyCall = mockPrisma.user.findMany.mock.calls[0][0];
    expect(findManyCall.take).toBe(100);
  });

  it("defaults page to 1 for invalid values", async () => {
    mockPrisma.user.findMany.mockResolvedValue([]);
    mockPrisma.user.count.mockResolvedValue(0);

    await GET(makeRequest({ page: "-5" }));

    const findManyCall = mockPrisma.user.findMany.mock.calls[0][0];
    expect(findManyCall.skip).toBe(0);
  });

  it("defaults limit for NaN values", async () => {
    mockPrisma.user.findMany.mockResolvedValue([]);
    mockPrisma.user.count.mockResolvedValue(0);

    await GET(makeRequest({ limit: "abc" }));

    const findManyCall = mockPrisma.user.findMany.mock.calls[0][0];
    expect(findManyCall.take).toBe(50);
  });

  it("does not call Prisma when auth fails", async () => {
    const forbiddenResponse = new Response(JSON.stringify({ error: { code: "FORBIDDEN" } }), {
      status: 403,
    });
    mockRequireSuperAdmin.mockResolvedValue({
      data: null,
      error: forbiddenResponse,
    });

    await GET(makeRequest());
    expect(mockPrisma.user.findMany).not.toHaveBeenCalled();
    expect(mockPrisma.user.count).not.toHaveBeenCalled();
  });

  it("generates signed photo URL for residents with photoUrl", async () => {
    const mockUsers = [
      {
        id: "u-1",
        name: "John",
        email: "john@test.com",
        mobile: "9876543210",
        rwaid: "EDEN-001",
        status: "ACTIVE_PAID",
        ownershipType: "OWNER",
        createdAt: new Date(),
        societyId: "soc-1",
        photoUrl: "soc-1/u-1/photo.jpg",
        society: { name: "Greenwood Residency" },
        userUnits: [{ unit: { unitNumber: "A-101" } }],
      },
    ];

    mockPrisma.user.findMany.mockResolvedValue(mockUsers);
    mockPrisma.user.count
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(100)
      .mockResolvedValueOnce(60)
      .mockResolvedValueOnce(20)
      .mockResolvedValueOnce(10);

    const res = await GET(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data[0].photoUrl).toBe("https://example.com/signed-photo");
    expect(mockCreateSignedUrl).toHaveBeenCalledWith("soc-1/u-1/photo.jpg", 3600);
  });

  it("skips signed URL generation when resident has no photoUrl", async () => {
    const mockUsers = [
      {
        id: "u-1",
        name: "John",
        email: "john@test.com",
        mobile: "9876543210",
        rwaid: "EDEN-001",
        status: "ACTIVE_PAID",
        ownershipType: "OWNER",
        createdAt: new Date(),
        societyId: "soc-1",
        photoUrl: null,
        society: { name: "Greenwood Residency" },
        userUnits: [],
      },
    ];

    mockPrisma.user.findMany.mockResolvedValue(mockUsers);
    mockPrisma.user.count
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(100)
      .mockResolvedValueOnce(60)
      .mockResolvedValueOnce(20)
      .mockResolvedValueOnce(10);

    const res = await GET(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data[0].photoUrl).toBeNull();
    expect(mockCreateSignedUrl).not.toHaveBeenCalled();
  });

  it("falls back to null when signed URL generation fails", async () => {
    const mockUsers = [
      {
        id: "u-1",
        name: "John",
        email: "john@test.com",
        mobile: "9876543210",
        rwaid: "EDEN-001",
        status: "ACTIVE_PAID",
        ownershipType: "OWNER",
        createdAt: new Date(),
        societyId: "soc-1",
        photoUrl: "soc-1/u-1/photo.jpg",
        society: { name: "Greenwood Residency" },
        userUnits: [],
      },
    ];

    mockCreateSignedUrl.mockResolvedValue({
      data: null,
      error: { message: "Storage error" },
    });
    mockPrisma.user.findMany.mockResolvedValue(mockUsers);
    mockPrisma.user.count
      .mockResolvedValueOnce(1)
      .mockResolvedValueOnce(100)
      .mockResolvedValueOnce(60)
      .mockResolvedValueOnce(20)
      .mockResolvedValueOnce(10);

    const res = await GET(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data[0].photoUrl).toBeNull();
  });

  it("returns 500 when Prisma throws", async () => {
    mockPrisma.user.findMany.mockRejectedValue(new Error("DB connection failed"));

    const res = await GET(makeRequest());
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error.code).toBe("INTERNAL_ERROR");
  });
});
