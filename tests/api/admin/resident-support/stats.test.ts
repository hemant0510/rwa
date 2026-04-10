import { describe, it, expect, vi, beforeEach } from "vitest";

const mockGetCurrentUser = vi.hoisted(() => vi.fn());
const mockPrisma = vi.hoisted(() => ({
  residentTicket: { count: vi.fn(), findMany: vi.fn() },
}));

vi.mock("@/lib/get-current-user", () => ({ getCurrentUser: mockGetCurrentUser }));
vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

import { GET } from "@/app/api/v1/admin/resident-support/stats/route";

const mockAdmin = {
  userId: "u-1",
  authUserId: "auth-1",
  societyId: "soc-1",
  role: "RWA_ADMIN",
  adminPermission: "FULL_ACCESS",
};

describe("GET /api/v1/admin/resident-support/stats", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCurrentUser.mockResolvedValue(mockAdmin);
    mockPrisma.residentTicket.count.mockResolvedValue(0);
    mockPrisma.residentTicket.findMany.mockResolvedValue([]);
  });

  it("returns 403 when not admin", async () => {
    mockGetCurrentUser.mockResolvedValue(null);

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(body.error.code).toBe("FORBIDDEN");
    expect(mockGetCurrentUser).toHaveBeenCalledWith("RWA_ADMIN");
  });

  it("returns all KPI stats", async () => {
    // count is called 4 times: open, inProgress, awaitingAdmin, resolved7d
    mockPrisma.residentTicket.count
      .mockResolvedValueOnce(5) // open
      .mockResolvedValueOnce(3) // inProgress
      .mockResolvedValueOnce(2) // awaitingAdmin
      .mockResolvedValueOnce(10); // resolved7d

    mockPrisma.residentTicket.findMany.mockResolvedValue([
      { createdAt: new Date("2024-01-01T00:00:00Z"), resolvedAt: new Date("2024-01-01T10:00:00Z") },
    ]);

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.open).toBe(5);
    expect(body.inProgress).toBe(3);
    expect(body.awaitingAdmin).toBe(2);
    expect(body.resolved7d).toBe(10);
    expect(body.avgResolutionHours).toBe(10);
    expect(mockPrisma.residentTicket.count).toHaveBeenCalledTimes(4);
    expect(mockPrisma.residentTicket.findMany).toHaveBeenCalledTimes(1);
  });

  it("returns avgResolutionHours as null when no resolved tickets", async () => {
    mockPrisma.residentTicket.findMany.mockResolvedValue([]);

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.avgResolutionHours).toBeNull();
  });

  it("returns 500 on DB error", async () => {
    mockPrisma.residentTicket.count.mockRejectedValue(new Error("DB fail"));

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error.code).toBe("INTERNAL_ERROR");
  });
});
