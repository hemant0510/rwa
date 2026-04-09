import { describe, it, expect, vi, beforeEach } from "vitest";

import { mockPrisma } from "../../__mocks__/prisma";
import { mockStorageBucket } from "../../__mocks__/supabase";

const { mockGetCurrentUser } = vi.hoisted(() => ({
  mockGetCurrentUser: vi.fn(),
}));

vi.mock("@/lib/get-current-user", () => ({
  getCurrentUser: mockGetCurrentUser,
}));

// eslint-disable-next-line import/order
import { GET } from "@/app/api/v1/residents/me/governing-body/route";

describe("GET /api/v1/residents/me/governing-body", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
    mockStorageBucket.createSignedUrl.mockResolvedValue({
      data: { signedUrl: "https://example.com/signed-photo" },
      error: null,
    });
  });

  it("returns 403 when not authenticated as resident", async () => {
    mockGetCurrentUser.mockResolvedValue(null);

    const res = await GET();
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error.code).toBe("FORBIDDEN");
  });

  it("returns empty members array when no governing body members", async () => {
    mockGetCurrentUser.mockResolvedValue({
      userId: "u1",
      authUserId: "auth-1",
      societyId: "soc-1",
      role: "RESIDENT",
      adminPermission: null,
    });
    mockPrisma.governingBodyMember.findMany.mockResolvedValue([]);

    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.members).toEqual([]);
  });

  it("returns governing body members with masked mobile and photoUrl", async () => {
    mockGetCurrentUser.mockResolvedValue({
      userId: "u1",
      authUserId: "auth-1",
      societyId: "soc-1",
      role: "RESIDENT",
      adminPermission: null,
    });
    mockPrisma.governingBodyMember.findMany.mockResolvedValue([
      {
        id: "gbm-1",
        societyId: "soc-1",
        userId: "u2",
        designationId: "des-1",
        assignedAt: "2025-01-15T00:00:00.000Z",
        user: {
          name: "Rajesh Kumar",
          email: "rajesh@test.com",
          mobile: "9876543210",
          photoUrl: "soc-1/u2/photo.jpg",
        },
        designation: { name: "President", sortOrder: 1 },
      },
      {
        id: "gbm-2",
        societyId: "soc-1",
        userId: "u3",
        designationId: "des-2",
        assignedAt: "2025-01-15T00:00:00.000Z",
        user: {
          name: "Sunita Sharma",
          email: "sunita@test.com",
          mobile: "8765432109",
          photoUrl: null,
        },
        designation: { name: "Secretary", sortOrder: 2 },
      },
    ]);

    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();

    expect(body.members).toHaveLength(2);
    expect(body.members[0]).toEqual({
      id: "gbm-1",
      name: "Rajesh Kumar",
      email: "rajesh@test.com",
      mobile: "XXXXX 43210",
      designation: "President",
      assignedAt: "2025-01-15T00:00:00.000Z",
      photoUrl: "https://example.com/signed-photo",
    });
    expect(body.members[1]).toEqual({
      id: "gbm-2",
      name: "Sunita Sharma",
      email: "sunita@test.com",
      mobile: "XXXXX 32109",
      designation: "Secretary",
      assignedAt: "2025-01-15T00:00:00.000Z",
      photoUrl: null,
    });
  });

  it("handles member with null mobile", async () => {
    mockGetCurrentUser.mockResolvedValue({
      userId: "u1",
      authUserId: "auth-1",
      societyId: "soc-1",
      role: "RESIDENT",
      adminPermission: null,
    });
    mockPrisma.governingBodyMember.findMany.mockResolvedValue([
      {
        id: "gbm-1",
        societyId: "soc-1",
        userId: "u2",
        designationId: "des-1",
        assignedAt: "2025-02-01T00:00:00.000Z",
        user: { name: "No Phone", email: "nophone@test.com", mobile: null, photoUrl: null },
        designation: { name: "Treasurer", sortOrder: 3 },
      },
    ]);

    const res = await GET();
    const body = await res.json();

    expect(body.members[0].mobile).toBe("—");
    expect(body.members[0].photoUrl).toBeNull();
  });

  it("queries governing body members scoped to resident society", async () => {
    mockGetCurrentUser.mockResolvedValue({
      userId: "u1",
      authUserId: "auth-1",
      societyId: "soc-42",
      role: "RESIDENT",
      adminPermission: null,
    });
    mockPrisma.governingBodyMember.findMany.mockResolvedValue([]);

    await GET();

    expect(mockGetCurrentUser).toHaveBeenCalledWith("RESIDENT");
    expect(mockPrisma.governingBodyMember.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { societyId: "soc-42" },
        orderBy: { designation: { sortOrder: "asc" } },
      }),
    );
  });

  it("falls back to null photoUrl when signed URL generation fails", async () => {
    mockGetCurrentUser.mockResolvedValue({
      userId: "u1",
      authUserId: "auth-1",
      societyId: "soc-1",
      role: "RESIDENT",
      adminPermission: null,
    });
    mockPrisma.governingBodyMember.findMany.mockResolvedValue([
      {
        id: "gbm-1",
        societyId: "soc-1",
        userId: "u2",
        designationId: "des-1",
        assignedAt: "2025-01-15T00:00:00.000Z",
        user: {
          name: "Rajesh Kumar",
          email: "rajesh@test.com",
          mobile: "9876543210",
          photoUrl: "soc-1/u2/photo.jpg",
        },
        designation: { name: "President", sortOrder: 1 },
      },
    ]);
    mockStorageBucket.createSignedUrl.mockResolvedValue({
      data: null,
      error: { message: "Storage error" },
    });

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.members[0].photoUrl).toBeNull();
  });

  it("returns 500 on server error", async () => {
    mockGetCurrentUser.mockRejectedValue(new Error("DB error"));

    const res = await GET();
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error.code).toBe("INTERNAL_ERROR");
  });
});
