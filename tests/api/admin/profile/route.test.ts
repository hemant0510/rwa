import { NextRequest } from "next/server";

import { beforeEach, describe, expect, it, vi } from "vitest";

// ─── Hoisted mocks ────────────────────────────────────────────────────────────

const mockGetCurrentUser = vi.hoisted(() => vi.fn());
const mockGetAuthUser = vi.hoisted(() => vi.fn());
const mockPrisma = vi.hoisted(() => ({
  user: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  superAdmin: {
    findUnique: vi.fn(),
  },
}));

vi.mock("@/lib/get-current-user", () => ({
  getCurrentUser: mockGetCurrentUser,
  getAuthUser: mockGetAuthUser,
}));
vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

// ─── Import after mocks ───────────────────────────────────────────────────────

import { GET, PATCH } from "@/app/api/v1/admin/profile/route";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

const mockAdmin = {
  userId: "user-1",
  authUserId: "auth-1",
  societyId: "soc-1",
  role: "RWA_ADMIN",
  adminPermission: "FULL_ACCESS",
  name: "Hemant Bhagat",
};

const mockDbUser = {
  id: "user-1",
  name: "Hemant Bhagat",
  email: "hemant@example.com",
  mobile: "9876543210",
  role: "RWA_ADMIN",
  adminPermission: "FULL_ACCESS",
  society: { name: "Eden Estate RWA", societyCode: "EDEN" },
};

function makePatchReq(body: unknown) {
  return new NextRequest("http://localhost/api/v1/admin/profile", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

// ─── GET tests ────────────────────────────────────────────────────────────────

describe("GET /api/v1/admin/profile", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCurrentUser.mockResolvedValue(mockAdmin);
    mockPrisma.user.findUnique.mockResolvedValue(mockDbUser);
  });

  it("returns 403 when not authenticated (neither admin nor SA)", async () => {
    mockGetCurrentUser.mockResolvedValue(null);
    mockGetAuthUser.mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(403);
  });

  it("returns 403 when admin user not found in DB", async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(403);
  });

  it("returns SA profile when caller is Super Admin", async () => {
    mockGetCurrentUser.mockResolvedValue(null);
    mockGetAuthUser.mockResolvedValue({ id: "auth-sa-1" });
    mockPrisma.superAdmin.findUnique.mockResolvedValue({
      id: "sa-1",
      name: "Super Admin",
      email: "sa@platform.com",
      isActive: true,
    });

    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.role).toBe("SUPER_ADMIN");
    expect(body.name).toBe("Super Admin");
    expect(body.adminPermission).toBe("FULL_ACCESS");
    expect(body.societyName).toBeNull();
  });

  it("returns 403 when SA is inactive", async () => {
    mockGetCurrentUser.mockResolvedValue(null);
    mockGetAuthUser.mockResolvedValue({ id: "auth-sa-1" });
    mockPrisma.superAdmin.findUnique.mockResolvedValue({
      id: "sa-1",
      name: "Super Admin",
      email: "sa@platform.com",
      isActive: false,
    });

    const res = await GET();
    expect(res.status).toBe(403);
  });

  it("returns profile data for authenticated admin", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toMatchObject({
      id: "user-1",
      name: "Hemant Bhagat",
      email: "hemant@example.com",
      mobile: "9876543210",
      role: "RWA_ADMIN",
      adminPermission: "FULL_ACCESS",
      societyName: "Eden Estate RWA",
      societyCode: "EDEN",
    });
  });

  it("returns empty string for null mobile", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ ...mockDbUser, mobile: null });
    const res = await GET();
    const body = await res.json();
    expect(body.mobile).toBe("");
  });

  it("returns null for societyName and societyCode when society is null", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ ...mockDbUser, society: null });
    const res = await GET();
    const body = await res.json();
    expect(body.societyName).toBeNull();
    expect(body.societyCode).toBeNull();
  });

  it("queries by correct userId", async () => {
    await GET();
    expect(mockPrisma.user.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "user-1" } }),
    );
  });

  it("returns 500 on unexpected error", async () => {
    mockPrisma.user.findUnique.mockRejectedValue(new Error("DB error"));
    const res = await GET();
    expect(res.status).toBe(500);
  });
});

// ─── PATCH tests ──────────────────────────────────────────────────────────────

describe("PATCH /api/v1/admin/profile", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCurrentUser.mockResolvedValue(mockAdmin);
    mockPrisma.user.update.mockResolvedValue({
      id: "user-1",
      name: "Updated Name",
      email: "hemant@example.com",
      mobile: "9123456789",
    });
  });

  it("returns 403 when not authenticated", async () => {
    mockGetCurrentUser.mockResolvedValue(null);
    const res = await PATCH(makePatchReq({ name: "Test" }));
    expect(res.status).toBe(403);
  });

  it("updates name successfully", async () => {
    const res = await PATCH(makePatchReq({ name: "Updated Name" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.message).toBe("Profile updated");
    expect(mockPrisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "user-1" },
        data: expect.objectContaining({ name: "Updated Name" }),
      }),
    );
  });

  it("updates mobile successfully", async () => {
    const res = await PATCH(makePatchReq({ mobile: "9123456789" }));
    expect(res.status).toBe(200);
    expect(mockPrisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ mobile: "9123456789" }),
      }),
    );
  });

  it("sets mobile to null when empty string is provided", async () => {
    mockPrisma.user.update.mockResolvedValue({
      id: "user-1",
      name: "Hemant Bhagat",
      email: "hemant@example.com",
      mobile: null,
    });
    const res = await PATCH(makePatchReq({ mobile: "" }));
    expect(res.status).toBe(200);
    expect(mockPrisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ mobile: null }),
      }),
    );
  });

  it("updates both name and mobile together", async () => {
    const res = await PATCH(makePatchReq({ name: "New Name", mobile: "9000000001" }));
    expect(res.status).toBe(200);
    expect(mockPrisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { name: "New Name", mobile: "9000000001" },
      }),
    );
  });

  it("returns 422 for name shorter than 2 characters", async () => {
    const res = await PATCH(makePatchReq({ name: "A" }));
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error.message).toContain("at least 2 characters");
  });

  it("returns 422 for invalid mobile format (5-digit)", async () => {
    const res = await PATCH(makePatchReq({ mobile: "12345" }));
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error.message).toContain("10-digit");
  });

  it("returns 422 for mobile starting with invalid digit", async () => {
    const res = await PATCH(makePatchReq({ mobile: "1234567890" }));
    expect(res.status).toBe(422);
  });

  it("does not include name in update when not provided", async () => {
    await PATCH(makePatchReq({ mobile: "9123456789" }));
    const callArg = mockPrisma.user.update.mock.calls[0]?.[0] as { data: Record<string, unknown> };
    expect(callArg?.data).not.toHaveProperty("name");
  });

  it("does not include mobile in update when not provided", async () => {
    await PATCH(makePatchReq({ name: "Only Name" }));
    const callArg = mockPrisma.user.update.mock.calls[0]?.[0] as { data: Record<string, unknown> };
    expect(callArg?.data).not.toHaveProperty("mobile");
  });

  it("returns 500 on unexpected DB error", async () => {
    mockPrisma.user.update.mockRejectedValue(new Error("DB error"));
    const res = await PATCH(makePatchReq({ name: "Test User" }));
    expect(res.status).toBe(500);
  });
});
