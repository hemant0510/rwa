import { describe, it, expect, vi, beforeEach } from "vitest";

const mockGetAdminContext = vi.hoisted(() => vi.fn());
const mockGetFullAccessAdmin = vi.hoisted(() => vi.fn());
const mockPrisma = vi.hoisted(() => ({
  governingBodyMember: { findMany: vi.fn(), upsert: vi.fn() },
  designation: { findMany: vi.fn(), findFirst: vi.fn() },
  user: { findFirst: vi.fn() },
}));

vi.mock("@/lib/get-current-user", () => ({
  getAdminContext: mockGetAdminContext,
  getFullAccessAdmin: mockGetFullAccessAdmin,
}));
vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

import { GET, POST } from "@/app/api/v1/admin/governing-body/route";

const mockAdmin = {
  userId: "admin-1",
  authUserId: "auth-admin-1",
  societyId: "soc-1",
  role: "RWA_ADMIN",
  adminPermission: "FULL_ACCESS",
  isSuperAdmin: false,
  name: "Admin",
};

const makeRequest = (societyId = "soc-1") =>
  new Request(`http://localhost/api/v1/admin/governing-body?societyId=${societyId}`);

describe("GET /api/v1/admin/governing-body", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAdminContext.mockResolvedValue(mockAdmin);
    mockPrisma.governingBodyMember.findMany.mockResolvedValue([]);
    mockPrisma.designation.findMany.mockResolvedValue([]);
  });

  it("returns 403 when caller is not admin", async () => {
    mockGetAdminContext.mockResolvedValue(null);
    const res = await GET(makeRequest());
    expect(res.status).toBe(403);
  });

  it("returns 403 when admin has READ_ONLY permission (not SA)", async () => {
    mockGetAdminContext.mockResolvedValue({
      ...mockAdmin,
      adminPermission: "READ_NOTIFY",
    });
    const res = await GET(makeRequest());
    expect(res.status).toBe(403);
  });

  it("returns members and designations for FULL_ACCESS admin", async () => {
    mockPrisma.governingBodyMember.findMany.mockResolvedValue([
      {
        id: "gb-1",
        userId: "u-1",
        designationId: "d-1",
        assignedAt: new Date("2026-01-01"),
        user: { id: "u-1", name: "Resident", email: "r@test.com", mobile: "9999999999" },
        designation: { id: "d-1", name: "President" },
      },
    ]);
    mockPrisma.designation.findMany.mockResolvedValue([
      { id: "d-1", name: "President", sortOrder: 1 },
    ]);

    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.members).toHaveLength(1);
    expect(body.members[0].designation).toBe("President");
    expect(body.designations).toHaveLength(1);
  });

  it("returns data for Super Admin with societyId", async () => {
    mockGetAdminContext.mockResolvedValue({
      ...mockAdmin,
      userId: null,
      role: "SUPER_ADMIN",
      isSuperAdmin: true,
    });
    mockPrisma.governingBodyMember.findMany.mockResolvedValue([]);
    mockPrisma.designation.findMany.mockResolvedValue([]);

    const res = await GET(makeRequest());
    expect(res.status).toBe(200);
  });

  it("scopes query to admin's societyId", async () => {
    await GET(makeRequest());
    expect(mockPrisma.governingBodyMember.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { societyId: "soc-1" },
      }),
    );
  });

  it("returns 500 on DB error", async () => {
    mockPrisma.governingBodyMember.findMany.mockRejectedValue(new Error("DB"));
    const res = await GET(makeRequest());
    expect(res.status).toBe(500);
  });
});

function makePostRequest(body: unknown) {
  return new Request("http://localhost/api/v1/admin/governing-body", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }) as never;
}

describe("POST /api/v1/admin/governing-body", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetFullAccessAdmin.mockResolvedValue(mockAdmin);
  });

  it("returns 403 when not full-access admin", async () => {
    mockGetFullAccessAdmin.mockResolvedValue(null);
    const res = await POST(makePostRequest({ userId: "u-1", designationId: "d-1" }));
    expect(res.status).toBe(403);
  });

  it("returns 422 for invalid body", async () => {
    const res = await POST(makePostRequest({ userId: "not-uuid" }));
    expect(res.status).toBe(422);
  });

  it("returns 404 when resident not found", async () => {
    mockPrisma.user.findFirst.mockResolvedValue(null);
    const res = await POST(
      makePostRequest({
        userId: "d9b1d7db-3a53-4e32-b8f0-5e6e6d3c4f1a",
        designationId: "a2c3d4e5-6f78-4a9b-bc01-2d3e4f5a6b7c",
      }),
    );
    expect(res.status).toBe(404);
  });

  it("returns 404 when designation not found", async () => {
    mockPrisma.user.findFirst.mockResolvedValue({ id: "u-1", name: "R" });
    mockPrisma.designation.findFirst.mockResolvedValue(null);
    const res = await POST(
      makePostRequest({
        userId: "d9b1d7db-3a53-4e32-b8f0-5e6e6d3c4f1a",
        designationId: "a2c3d4e5-6f78-4a9b-bc01-2d3e4f5a6b7c",
      }),
    );
    expect(res.status).toBe(404);
  });

  it("assigns member successfully", async () => {
    mockPrisma.user.findFirst.mockResolvedValue({ id: "u-1", name: "Resident" });
    mockPrisma.designation.findFirst.mockResolvedValue({ id: "d-1", name: "President" });
    mockPrisma.governingBodyMember.upsert.mockResolvedValue({
      id: "gb-1",
      userId: "u-1",
      user: { name: "Resident" },
      designation: { name: "President" },
    });
    const res = await POST(
      makePostRequest({
        userId: "d9b1d7db-3a53-4e32-b8f0-5e6e6d3c4f1a",
        designationId: "a2c3d4e5-6f78-4a9b-bc01-2d3e4f5a6b7c",
      }),
    );
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.designation).toBe("President");
  });

  it("returns 500 on DB error", async () => {
    mockPrisma.user.findFirst.mockRejectedValue(new Error("DB"));
    const res = await POST(
      makePostRequest({
        userId: "d9b1d7db-3a53-4e32-b8f0-5e6e6d3c4f1a",
        designationId: "a2c3d4e5-6f78-4a9b-bc01-2d3e4f5a6b7c",
      }),
    );
    expect(res.status).toBe(500);
  });
});
