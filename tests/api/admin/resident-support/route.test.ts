import { describe, it, expect, vi, beforeEach } from "vitest";

const mockGetCurrentUser = vi.hoisted(() => vi.fn());
const mockPrisma = vi.hoisted(() => ({
  residentTicket: { findMany: vi.fn(), count: vi.fn() },
}));

vi.mock("@/lib/get-current-user", () => ({ getCurrentUser: mockGetCurrentUser }));
vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

import { GET } from "@/app/api/v1/admin/resident-support/route";

const mockAdmin = {
  userId: "u-1",
  authUserId: "auth-1",
  societyId: "soc-1",
  role: "RWA_ADMIN",
  adminPermission: "FULL_ACCESS",
};

function makeRequest(params = "") {
  return new Request(`http://localhost/api/v1/admin/resident-support${params ? `?${params}` : ""}`);
}

describe("GET /api/v1/admin/resident-support", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCurrentUser.mockResolvedValue(mockAdmin);
    mockPrisma.residentTicket.findMany.mockResolvedValue([]);
    mockPrisma.residentTicket.count.mockResolvedValue(0);
  });

  it("returns 403 when not admin", async () => {
    mockGetCurrentUser.mockResolvedValue(null);

    const res = await GET(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(body.error.code).toBe("FORBIDDEN");
    expect(mockGetCurrentUser).toHaveBeenCalledWith("RWA_ADMIN");
  });

  it("lists society-scoped tickets with pagination", async () => {
    const tickets = [
      { id: "t-1", subject: "Ticket 1", societyId: "soc-1" },
      { id: "t-2", subject: "Ticket 2", societyId: "soc-1" },
    ];
    mockPrisma.residentTicket.findMany.mockResolvedValue(tickets);
    mockPrisma.residentTicket.count.mockResolvedValue(25);

    const res = await GET(makeRequest("page=2&limit=10"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data).toEqual(tickets);
    expect(body.total).toBe(25);
    expect(body.page).toBe(2);
    expect(body.limit).toBe(10);
    expect(mockPrisma.residentTicket.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { societyId: "soc-1" },
        skip: 10,
        take: 10,
      }),
    );
  });

  it("filters by status", async () => {
    mockPrisma.residentTicket.findMany.mockResolvedValue([]);
    mockPrisma.residentTicket.count.mockResolvedValue(0);

    const res = await GET(makeRequest("status=OPEN"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data).toEqual([]);
    expect(mockPrisma.residentTicket.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { societyId: "soc-1", status: "OPEN" },
      }),
    );
  });

  it("filters by type", async () => {
    const res = await GET(makeRequest("type=COMPLAINT"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data).toEqual([]);
    expect(mockPrisma.residentTicket.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { societyId: "soc-1", type: "COMPLAINT" },
      }),
    );
  });

  it("filters by priority", async () => {
    const res = await GET(makeRequest("priority=HIGH"));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data).toEqual([]);
    expect(mockPrisma.residentTicket.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { societyId: "soc-1", priority: "HIGH" },
      }),
    );
  });

  it("returns 500 on DB error", async () => {
    mockPrisma.residentTicket.findMany.mockRejectedValue(new Error("DB fail"));

    const res = await GET(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error.code).toBe("INTERNAL_ERROR");
  });
});
