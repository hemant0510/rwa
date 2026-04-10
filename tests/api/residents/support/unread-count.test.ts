import { describe, it, expect, vi, beforeEach } from "vitest";

const mockGetCurrentUser = vi.hoisted(() => vi.fn());
const mockPrisma = vi.hoisted(() => ({
  residentTicket: {
    count: vi.fn(),
  },
}));

vi.mock("@/lib/get-current-user", () => ({ getCurrentUser: mockGetCurrentUser }));
vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

import { GET } from "@/app/api/v1/residents/me/support/unread-count/route";

const mockResident = {
  userId: "u-1",
  authUserId: "auth-1",
  societyId: "soc-1",
  role: "RESIDENT",
  adminPermission: null,
};

describe("Resident Support Unread Count API — GET", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCurrentUser.mockResolvedValue(mockResident);
  });

  it("returns 401 when not authenticated", async () => {
    mockGetCurrentUser.mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("returns count of AWAITING_RESIDENT tickets", async () => {
    mockPrisma.residentTicket.count.mockResolvedValue(3);
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.count).toBe(3);
    expect(mockPrisma.residentTicket.count).toHaveBeenCalledWith({
      where: {
        societyId: "soc-1",
        createdBy: "u-1",
        status: "AWAITING_RESIDENT",
      },
    });
  });

  it("returns 0 when no awaiting tickets", async () => {
    mockPrisma.residentTicket.count.mockResolvedValue(0);
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.count).toBe(0);
  });

  it("returns 500 on DB error", async () => {
    mockPrisma.residentTicket.count.mockRejectedValue(new Error("DB"));
    const res = await GET();
    expect(res.status).toBe(500);
  });
});
