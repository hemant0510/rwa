import { describe, it, expect, vi, beforeEach } from "vitest";

const mockGetCurrentUser = vi.hoisted(() => vi.fn());
const mockPrisma = vi.hoisted(() => ({
  residentTicket: { count: vi.fn() },
}));

vi.mock("@/lib/get-current-user", () => ({ getCurrentUser: mockGetCurrentUser }));
vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

import { GET } from "@/app/api/v1/admin/resident-support/unread-count/route";

const mockAdmin = {
  userId: "u-1",
  authUserId: "auth-1",
  societyId: "soc-1",
  role: "RWA_ADMIN",
  adminPermission: "FULL_ACCESS",
};

describe("GET /api/v1/admin/resident-support/unread-count", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCurrentUser.mockResolvedValue(mockAdmin);
    mockPrisma.residentTicket.count.mockResolvedValue(0);
  });

  it("returns 403 when not admin", async () => {
    mockGetCurrentUser.mockResolvedValue(null);

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(body.error.code).toBe("FORBIDDEN");
    expect(mockGetCurrentUser).toHaveBeenCalledWith("RWA_ADMIN");
  });

  it("returns count of AWAITING_ADMIN tickets", async () => {
    mockPrisma.residentTicket.count.mockResolvedValue(7);

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.count).toBe(7);
    expect(mockPrisma.residentTicket.count).toHaveBeenCalledWith({
      where: {
        societyId: "soc-1",
        status: "AWAITING_ADMIN",
      },
    });
  });

  it("returns 500 on DB error", async () => {
    mockPrisma.residentTicket.count.mockRejectedValue(new Error("DB fail"));

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error.code).toBe("INTERNAL_ERROR");
  });
});
