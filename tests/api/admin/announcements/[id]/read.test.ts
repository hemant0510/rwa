import { describe, it, expect, vi, beforeEach } from "vitest";

// --- Hoisted mocks ---
const mockGetCurrentUser = vi.hoisted(() => vi.fn());
const mockPrisma = vi.hoisted(() => ({
  announcementRead: { upsert: vi.fn() },
}));

vi.mock("@/lib/get-current-user", () => ({
  getCurrentUser: mockGetCurrentUser,
}));
vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

// --- Import after mocks ---
import { POST } from "@/app/api/v1/admin/announcements/[id]/read/route";

const mockAdmin = {
  userId: "u-admin-1",
  authUserId: "auth-admin-1",
  societyId: "soc-1",
  role: "RWA_ADMIN",
  adminPermission: "FULL_ACCESS",
};

function makeRequest(id: string) {
  return [
    new Request(`http://localhost/api/v1/admin/announcements/${id}/read`, {
      method: "POST",
    }),
    { params: Promise.resolve({ id }) },
  ] as const;
}

describe("POST /api/v1/admin/announcements/[id]/read", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCurrentUser.mockResolvedValue(mockAdmin);
  });

  it("returns 403 when user is not admin", async () => {
    mockGetCurrentUser.mockResolvedValue(null);
    const [req, ctx] = makeRequest("ann-1");
    const res = await POST(req, ctx);
    expect(res.status).toBe(403);
  });

  it("marks announcement as read", async () => {
    mockPrisma.announcementRead.upsert.mockResolvedValue({
      id: "read-1",
      announcementId: "ann-1",
      userId: "u-admin-1",
    });

    const [req, ctx] = makeRequest("ann-1");
    const res = await POST(req, ctx);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);

    expect(mockPrisma.announcementRead.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          announcementId_userId: {
            announcementId: "ann-1",
            userId: "u-admin-1",
          },
        },
        create: { announcementId: "ann-1", userId: "u-admin-1" },
        update: {},
      }),
    );
  });

  it("is idempotent — no error on duplicate", async () => {
    mockPrisma.announcementRead.upsert.mockResolvedValue({
      id: "read-1",
      announcementId: "ann-1",
      userId: "u-admin-1",
    });

    const [req1, ctx1] = makeRequest("ann-1");
    const res1 = await POST(req1, ctx1);
    expect(res1.status).toBe(200);

    const [req2, ctx2] = makeRequest("ann-1");
    const res2 = await POST(req2, ctx2);
    expect(res2.status).toBe(200);
  });

  it("returns 500 when Prisma throws", async () => {
    mockPrisma.announcementRead.upsert.mockRejectedValue(new Error("DB error"));
    const [req, ctx] = makeRequest("ann-1");
    const res = await POST(req, ctx);
    expect(res.status).toBe(500);
  });
});
