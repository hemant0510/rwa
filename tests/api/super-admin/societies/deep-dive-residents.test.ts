import { NextRequest } from "next/server";

import { describe, it, expect, vi, beforeEach } from "vitest";

const mockRequireSuperAdmin = vi.hoisted(() => vi.fn());
const mockPrisma = vi.hoisted(() => ({
  user: { findMany: vi.fn(), count: vi.fn(), findUnique: vi.fn() },
}));

vi.mock("@/lib/auth-guard", () => ({ requireSuperAdmin: mockRequireSuperAdmin }));
vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

import { GET as GET_DETAIL } from "@/app/api/v1/super-admin/societies/[id]/residents/[rid]/route";
import { GET } from "@/app/api/v1/super-admin/societies/[id]/residents/route";

const saOk = {
  data: { superAdminId: "sa-1", authUserId: "auth-1", email: "admin@superadmin.com" },
  error: null,
};

const mockResident = {
  id: "user-1",
  name: "John Doe",
  email: "john@example.com",
  mobile: "9876543210",
  rwaid: "RWA-2026-001",
  status: "ACTIVE_PAID",
  ownershipType: "OWNER",
  createdAt: new Date("2026-01-01"),
  societyId: "soc-1",
  role: "RESIDENT",
  userUnits: [],
  membershipFees: [],
};

function makeReq(url: string) {
  return new NextRequest(url);
}

// ---------------------------------------------------------------------------
// Residents list
// ---------------------------------------------------------------------------
describe("GET /api/v1/super-admin/societies/[id]/residents", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireSuperAdmin.mockResolvedValue(saOk);
    mockPrisma.user.findMany.mockResolvedValue([mockResident]);
    mockPrisma.user.count.mockResolvedValue(1);
    mockPrisma.user.findUnique.mockResolvedValue(mockResident);
  });

  it("returns 403 when not super admin", async () => {
    mockRequireSuperAdmin.mockResolvedValue({
      data: null,
      error: new Response(JSON.stringify({ error: { code: "FORBIDDEN" } }), { status: 403 }),
    });
    const res = await GET(
      makeReq("http://localhost/api/v1/super-admin/societies/soc-1/residents"),
      {
        params: Promise.resolve({ id: "soc-1" }),
      },
    );
    expect(res.status).toBe(403);
  });

  it("returns paginated residents list with defaults (page 1, limit 20)", async () => {
    const res = await GET(
      makeReq("http://localhost/api/v1/super-admin/societies/soc-1/residents"),
      {
        params: Promise.resolve({ id: "soc-1" }),
      },
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toHaveLength(1);
    expect(body.data[0].id).toBe("user-1");
    expect(body.total).toBe(1);
    expect(body.page).toBe(1);
    expect(body.limit).toBe(20);
    expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { societyId: "soc-1", role: "RESIDENT" },
        skip: 0,
        take: 20,
      }),
    );
  });

  it("filters by status=ACTIVE (maps to multiple ACTIVE_* statuses)", async () => {
    const res = await GET(
      makeReq("http://localhost/api/v1/super-admin/societies/soc-1/residents?status=ACTIVE"),
      { params: Promise.resolve({ id: "soc-1" }) },
    );
    expect(res.status).toBe(200);
    expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: {
            in: [
              "ACTIVE_PAID",
              "ACTIVE_PENDING",
              "ACTIVE_OVERDUE",
              "ACTIVE_PARTIAL",
              "ACTIVE_EXEMPTED",
            ],
          },
        }),
      }),
    );
  });

  it("filters by status=PENDING (maps to PENDING_APPROVAL)", async () => {
    const res = await GET(
      makeReq("http://localhost/api/v1/super-admin/societies/soc-1/residents?status=PENDING"),
      { params: Promise.resolve({ id: "soc-1" }) },
    );
    expect(res.status).toBe(200);
    expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: "PENDING_APPROVAL" }),
      }),
    );
  });

  it("filters by a raw status string (e.g. DEACTIVATED)", async () => {
    const res = await GET(
      makeReq("http://localhost/api/v1/super-admin/societies/soc-1/residents?status=DEACTIVATED"),
      { params: Promise.resolve({ id: "soc-1" }) },
    );
    expect(res.status).toBe(200);
    expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: "DEACTIVATED" }),
      }),
    );
  });

  it("filters by search query", async () => {
    const res = await GET(
      makeReq("http://localhost/api/v1/super-admin/societies/soc-1/residents?search=john"),
      { params: Promise.resolve({ id: "soc-1" }) },
    );
    expect(res.status).toBe(200);
    expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          OR: [
            { name: { contains: "john", mode: "insensitive" } },
            { mobile: { contains: "john" } },
            { email: { contains: "john", mode: "insensitive" } },
            { rwaid: { contains: "john", mode: "insensitive" } },
          ],
        }),
      }),
    );
  });

  it("returns 500 on DB error", async () => {
    mockPrisma.user.findMany.mockRejectedValue(new Error("DB error"));
    const res = await GET(
      makeReq("http://localhost/api/v1/super-admin/societies/soc-1/residents"),
      {
        params: Promise.resolve({ id: "soc-1" }),
      },
    );
    expect(res.status).toBe(500);
  });
});

// ---------------------------------------------------------------------------
// Resident detail
// ---------------------------------------------------------------------------
describe("GET /api/v1/super-admin/societies/[id]/residents/[rid]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireSuperAdmin.mockResolvedValue(saOk);
    mockPrisma.user.findMany.mockResolvedValue([mockResident]);
    mockPrisma.user.count.mockResolvedValue(1);
    mockPrisma.user.findUnique.mockResolvedValue(mockResident);
  });

  it("returns 403 when not super admin", async () => {
    mockRequireSuperAdmin.mockResolvedValue({
      data: null,
      error: new Response(JSON.stringify({ error: { code: "FORBIDDEN" } }), { status: 403 }),
    });
    const res = await GET_DETAIL(
      makeReq("http://localhost/api/v1/super-admin/societies/soc-1/residents/user-1"),
      { params: Promise.resolve({ id: "soc-1", rid: "user-1" }) },
    );
    expect(res.status).toBe(403);
  });

  it("returns resident detail successfully", async () => {
    const res = await GET_DETAIL(
      makeReq("http://localhost/api/v1/super-admin/societies/soc-1/residents/user-1"),
      { params: Promise.resolve({ id: "soc-1", rid: "user-1" }) },
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe("user-1");
    expect(body.name).toBe("John Doe");
    expect(body.societyId).toBe("soc-1");
    expect(mockPrisma.user.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "user-1" } }),
    );
  });

  it("returns 404 when resident not found (prisma returns null)", async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);
    const res = await GET_DETAIL(
      makeReq("http://localhost/api/v1/super-admin/societies/soc-1/residents/user-1"),
      { params: Promise.resolve({ id: "soc-1", rid: "user-1" }) },
    );
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error.code).toBe("NOT_FOUND");
  });

  it("returns 404 when resident belongs to a different society (societyId mismatch)", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ ...mockResident, societyId: "soc-other" });
    const res = await GET_DETAIL(
      makeReq("http://localhost/api/v1/super-admin/societies/soc-1/residents/user-1"),
      { params: Promise.resolve({ id: "soc-1", rid: "user-1" }) },
    );
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error.code).toBe("NOT_FOUND");
  });

  it("returns 500 on DB error", async () => {
    mockPrisma.user.findUnique.mockRejectedValue(new Error("DB error"));
    const res = await GET_DETAIL(
      makeReq("http://localhost/api/v1/super-admin/societies/soc-1/residents/user-1"),
      { params: Promise.resolve({ id: "soc-1", rid: "user-1" }) },
    );
    expect(res.status).toBe(500);
  });
});
