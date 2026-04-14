import { describe, it, expect, vi, beforeEach } from "vitest";

const mockGetCurrentUser = vi.hoisted(() => vi.fn());
const mockPrisma = vi.hoisted(() => ({
  counsellorSocietyAssignment: { findFirst: vi.fn() },
}));

vi.mock("@/lib/get-current-user", () => ({ getCurrentUser: mockGetCurrentUser }));
vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

import { GET } from "@/app/api/v1/admin/counsellor/route";

const adminUser = {
  userId: "u-1",
  authUserId: "auth-1",
  societyId: "soc-1",
  role: "RWA_ADMIN",
  adminPermission: "FULL_ACCESS",
  name: "Admin",
};

describe("GET /api/v1/admin/counsellor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCurrentUser.mockResolvedValue(adminUser);
  });

  it("returns 401 when not authenticated as admin", async () => {
    mockGetCurrentUser.mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("returns counsellor: null when no assignment exists", async () => {
    mockPrisma.counsellorSocietyAssignment.findFirst.mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.counsellor).toBeNull();
  });

  it("returns counsellor: null when assigned counsellor is inactive", async () => {
    mockPrisma.counsellorSocietyAssignment.findFirst.mockResolvedValue({
      isPrimary: true,
      assignedAt: new Date(),
      counsellor: { id: "c-1", name: "X", email: "x@x.com", isActive: false },
    });
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.counsellor).toBeNull();
  });

  it("returns counsellor profile when active primary assignment exists", async () => {
    mockPrisma.counsellorSocietyAssignment.findFirst.mockResolvedValue({
      isPrimary: true,
      assignedAt: new Date("2026-03-01"),
      counsellor: {
        id: "c-1",
        name: "Asha",
        email: "asha@x.com",
        publicBlurb: "Neutral advisor",
        photoUrl: null,
        isActive: true,
      },
    });
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.counsellor.id).toBe("c-1");
    expect(body.counsellor.name).toBe("Asha");
  });

  it("returns 500 on prisma error", async () => {
    mockPrisma.counsellorSocietyAssignment.findFirst.mockRejectedValue(new Error("DB"));
    const res = await GET();
    expect(res.status).toBe(500);
  });
});
