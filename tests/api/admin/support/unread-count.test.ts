import { describe, it, expect, vi, beforeEach } from "vitest";

const mockGetAdminContext = vi.hoisted(() => vi.fn());
const mockPrisma = vi.hoisted(() => ({
  serviceRequest: { count: vi.fn() },
}));

vi.mock("@/lib/get-current-user", () => ({ getAdminContext: mockGetAdminContext }));
vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

import { GET } from "@/app/api/v1/admin/support/unread-count/route";

const mockAdmin = {
  userId: "u-1",
  authUserId: "auth-1",
  societyId: "soc-1",
  role: "RWA_ADMIN",
  adminPermission: "FULL_ACCESS",
  isSuperAdmin: false,
  name: "Admin",
};

const makeRequest = () =>
  new Request("http://localhost/api/v1/admin/support/unread-count?societyId=soc-1");

describe("Admin Support Unread Count", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAdminContext.mockResolvedValue(mockAdmin);
  });

  it("returns count of AWAITING_ADMIN requests", async () => {
    mockPrisma.serviceRequest.count.mockResolvedValue(3);
    const res = await GET(makeRequest());
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
    mockGetAdminContext.mockResolvedValue(null);
    const res = await GET(makeRequest());
    expect(res.status).toBe(403);
  });

  it("returns count for Super Admin", async () => {
    mockGetAdminContext.mockResolvedValue({
      ...mockAdmin,
      userId: null,
      role: "SUPER_ADMIN",
      isSuperAdmin: true,
    });
    mockPrisma.serviceRequest.count.mockResolvedValue(5);
    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.count).toBe(5);
  });

  it("returns 500 on DB error", async () => {
    mockPrisma.serviceRequest.count.mockRejectedValue(new Error("DB"));
    const res = await GET(makeRequest());
    expect(res.status).toBe(500);
  });
});
