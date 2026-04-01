import { describe, it, expect, vi, beforeEach } from "vitest";

// --- Hoisted mocks ---
const mockRequireSuperAdmin = vi.hoisted(() => vi.fn());
const mockPrisma = vi.hoisted(() => ({
  platformAnnouncement: { findUnique: vi.fn() },
  user: { count: vi.fn() },
}));

vi.mock("@/lib/auth-guard", () => ({
  requireSuperAdmin: mockRequireSuperAdmin,
}));
vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

// --- Import after mocks ---
import { GET } from "@/app/api/v1/super-admin/announcements/[id]/route";

const mockSAContext = {
  data: { superAdminId: "sa-1", authUserId: "auth-sa-1", email: "sa@rwa.com" },
  error: null,
};

function makeRequest(id: string) {
  return [
    new Request(`http://localhost/api/v1/super-admin/announcements/${id}`),
    { params: Promise.resolve({ id }) },
  ] as const;
}

describe("GET /api/v1/super-admin/announcements/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireSuperAdmin.mockResolvedValue(mockSAContext);
  });

  it("returns 403 when requireSuperAdmin fails", async () => {
    const forbiddenResponse = new Response(JSON.stringify({ error: { code: "FORBIDDEN" } }), {
      status: 403,
    });
    mockRequireSuperAdmin.mockResolvedValue({ data: null, error: forbiddenResponse });

    const [req, ctx] = makeRequest("ann-1");
    const res = await GET(req, ctx);
    expect(res.status).toBe(403);
  });

  it("returns 404 when announcement not found", async () => {
    mockPrisma.platformAnnouncement.findUnique.mockResolvedValue(null);

    const [req, ctx] = makeRequest("non-existent");
    const res = await GET(req, ctx);
    expect(res.status).toBe(404);
  });

  it("returns announcement detail with read stats for ALL scope", async () => {
    mockPrisma.platformAnnouncement.findUnique.mockResolvedValue({
      id: "ann-1",
      subject: "Update",
      scope: "ALL",
      societyIds: [],
      _count: { reads: 3 },
    });
    mockPrisma.user.count.mockResolvedValue(10);

    const [req, ctx] = makeRequest("ann-1");
    const res = await GET(req, ctx);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.totalTargeted).toBe(10);
    expect(body._count.reads).toBe(3);
  });

  it("returns announcement detail with read stats for TARGETED scope", async () => {
    mockPrisma.platformAnnouncement.findUnique.mockResolvedValue({
      id: "ann-2",
      subject: "Billing",
      scope: "TARGETED",
      societyIds: ["soc-1", "soc-2"],
      _count: { reads: 1 },
    });
    mockPrisma.user.count.mockResolvedValue(5);

    const [req, ctx] = makeRequest("ann-2");
    const res = await GET(req, ctx);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.totalTargeted).toBe(5);

    // Verify count was called with correct filter
    expect(mockPrisma.user.count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          role: "RWA_ADMIN",
          societyId: { in: ["soc-1", "soc-2"] },
        }),
      }),
    );
  });

  it("returns 500 when Prisma throws", async () => {
    mockPrisma.platformAnnouncement.findUnique.mockRejectedValue(new Error("DB error"));

    const [req, ctx] = makeRequest("ann-1");
    const res = await GET(req, ctx);
    expect(res.status).toBe(500);
  });
});
