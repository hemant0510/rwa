import { describe, it, expect, vi, beforeEach } from "vitest";

// --- Hoisted mocks ---
const mockGetCurrentUser = vi.hoisted(() => vi.fn());
const mockPrisma = vi.hoisted(() => ({
  announcementRead: { findMany: vi.fn() },
  platformAnnouncement: { findMany: vi.fn() },
}));

vi.mock("@/lib/get-current-user", () => ({
  getCurrentUser: mockGetCurrentUser,
}));
vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

// --- Import after mocks ---
import { GET } from "@/app/api/v1/admin/announcements/route";

const mockAdmin = {
  userId: "u-admin-1",
  authUserId: "auth-admin-1",
  societyId: "soc-1",
  role: "RWA_ADMIN",
  adminPermission: "FULL_ACCESS",
};

describe("GET /api/v1/admin/announcements", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCurrentUser.mockResolvedValue(mockAdmin);
    mockPrisma.announcementRead.findMany.mockResolvedValue([]);
    mockPrisma.platformAnnouncement.findMany.mockResolvedValue([]);
  });

  it("returns 403 when user is not admin", async () => {
    mockGetCurrentUser.mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(403);
  });

  it("returns unread announcements for admin's society", async () => {
    mockPrisma.platformAnnouncement.findMany.mockResolvedValue([
      { id: "ann-1", subject: "Update", priority: "NORMAL", body: "Test" },
    ]);

    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveLength(1);
    expect(body[0].subject).toBe("Update");
  });

  it("excludes already-read announcements", async () => {
    mockPrisma.announcementRead.findMany.mockResolvedValue([{ announcementId: "ann-read" }]);
    mockPrisma.platformAnnouncement.findMany.mockResolvedValue([]);

    const res = await GET();
    expect(res.status).toBe(200);

    // Verify findMany was called with notIn filter
    expect(mockPrisma.platformAnnouncement.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: { notIn: ["ann-read"] },
        }),
      }),
    );
  });

  it("includes ALL scope and TARGETED matching admin society", async () => {
    mockPrisma.platformAnnouncement.findMany.mockResolvedValue([
      { id: "ann-all", subject: "Platform-wide" },
      { id: "ann-targeted", subject: "For soc-1" },
    ]);

    const res = await GET();
    const body = await res.json();
    expect(body).toHaveLength(2);

    // Verify OR filter includes both scopes
    expect(mockPrisma.platformAnnouncement.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: expect.arrayContaining([
            { scope: "ALL" },
            { scope: "TARGETED", societyIds: { has: "soc-1" } },
          ]),
        }),
      }),
    );
  });

  it("does not pass notIn when no announcements are read", async () => {
    mockPrisma.announcementRead.findMany.mockResolvedValue([]);

    await GET();

    expect(mockPrisma.platformAnnouncement.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: { notIn: undefined },
        }),
      }),
    );
  });

  it("returns 500 when Prisma throws", async () => {
    mockPrisma.announcementRead.findMany.mockRejectedValue(new Error("DB error"));
    const res = await GET();
    expect(res.status).toBe(500);
  });
});
