import { describe, it, expect, vi, beforeEach } from "vitest";

const mockGetCurrentUser = vi.hoisted(() => vi.fn());
const mockPrisma = vi.hoisted(() => ({
  serviceRequest: { count: vi.fn() },
}));

vi.mock("@/lib/get-current-user", () => ({ getCurrentUser: mockGetCurrentUser }));
vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

import { GET } from "@/app/api/v1/admin/support/unread-count/route";

const mockAdmin = {
  userId: "u-1",
  authUserId: "auth-1",
  societyId: "soc-1",
  role: "RWA_ADMIN",
  adminPermission: "FULL_ACCESS",
};

describe("Admin Support Unread Count", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCurrentUser.mockResolvedValue(mockAdmin);
  });

  it("returns count of AWAITING_ADMIN requests", async () => {
    mockPrisma.serviceRequest.count.mockResolvedValue(3);
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.count).toBe(3);
    expect(mockPrisma.serviceRequest.count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { societyId: "soc-1", status: "AWAITING_ADMIN" },
      }),
    );
  });

  it("returns 403 when not admin", async () => {
    mockGetCurrentUser.mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(403);
  });

  it("returns 500 on DB error", async () => {
    mockPrisma.serviceRequest.count.mockRejectedValue(new Error("DB"));
    const res = await GET();
    expect(res.status).toBe(500);
  });
});
