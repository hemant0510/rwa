import { describe, it, expect, vi, beforeEach } from "vitest";

const mockRequireCounsellor = vi.hoisted(() => vi.fn());
const mockPrisma = vi.hoisted(() => ({
  counsellorSocietyAssignment: { findMany: vi.fn() },
}));

vi.mock("@/lib/auth-guard", () => ({ requireCounsellor: mockRequireCounsellor }));
vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

import { GET } from "@/app/api/v1/counsellor/societies/route";

const authedContext = {
  data: { counsellorId: "c-1", authUserId: "auth-1", email: "c@x.com", name: "Counsellor" },
  error: null,
};

describe("GET /api/v1/counsellor/societies", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireCounsellor.mockResolvedValue(authedContext);
    mockPrisma.counsellorSocietyAssignment.findMany.mockResolvedValue([
      {
        assignedAt: new Date("2026-01-01"),
        isPrimary: true,
        society: {
          id: "s-1",
          name: "Alpha",
          societyCode: "ALPHA",
          city: "Pune",
          state: "MH",
          totalUnits: 120,
        },
      },
      {
        assignedAt: new Date("2026-02-01"),
        isPrimary: false,
        society: {
          id: "s-2",
          name: "Beta",
          societyCode: "BETA",
          city: "Mumbai",
          state: "MH",
          totalUnits: 64,
        },
      },
    ]);
  });

  it("returns 403 when guard rejects", async () => {
    const res403 = new Response("{}", { status: 403 });
    mockRequireCounsellor.mockResolvedValue({ data: null, error: res403 });
    const res = await GET();
    expect(res.status).toBe(403);
  });

  it("returns flattened society assignments", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.societies).toHaveLength(2);
    expect(body.societies[0]).toMatchObject({
      id: "s-1",
      name: "Alpha",
      isPrimary: true,
      totalUnits: 120,
    });
    expect(mockPrisma.counsellorSocietyAssignment.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { counsellorId: "c-1", isActive: true },
      }),
    );
  });

  it("returns empty list when no assignments", async () => {
    mockPrisma.counsellorSocietyAssignment.findMany.mockResolvedValue([]);
    const res = await GET();
    const body = await res.json();
    expect(body.societies).toEqual([]);
  });

  it("returns 500 on prisma failure", async () => {
    mockPrisma.counsellorSocietyAssignment.findMany.mockRejectedValue(new Error("DB"));
    const res = await GET();
    expect(res.status).toBe(500);
  });
});
