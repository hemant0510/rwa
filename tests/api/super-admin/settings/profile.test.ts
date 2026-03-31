import { NextRequest } from "next/server";

import { describe, it, expect, vi, beforeEach } from "vitest";

const mockRequireSuperAdmin = vi.hoisted(() => vi.fn());
const mockLogAudit = vi.hoisted(() => vi.fn());
const mockPrisma = vi.hoisted(() => ({
  superAdmin: { findUnique: vi.fn(), update: vi.fn() },
}));
const mockGetUser = vi.hoisted(() => vi.fn());
const mockCreateClient = vi.hoisted(() =>
  vi.fn().mockResolvedValue({ auth: { getUser: mockGetUser } }),
);

vi.mock("@/lib/auth-guard", () => ({ requireSuperAdmin: mockRequireSuperAdmin }));
vi.mock("@/lib/audit", () => ({ logAudit: mockLogAudit }));
vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/supabase/server", () => ({ createClient: mockCreateClient }));

import { GET, PATCH } from "@/app/api/v1/super-admin/settings/profile/route";

const saOk = {
  data: {
    superAdminId: "00000000-0000-4000-8000-000000000001",
    authUserId: "auth-1",
    email: "admin@superadmin.com",
  },
  error: null,
};

const mockProfile = {
  id: "00000000-0000-4000-8000-000000000001",
  name: "Super Admin",
  email: "admin@superadmin.com",
  createdAt: new Date("2024-01-01"),
};

function makePatchReq(body: unknown) {
  return new NextRequest("http://localhost/api/v1/super-admin/settings/profile", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("GET /api/v1/super-admin/settings/profile", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireSuperAdmin.mockResolvedValue(saOk);
    mockPrisma.superAdmin.findUnique.mockResolvedValue(mockProfile);
    mockGetUser.mockResolvedValue({ data: { user: { last_sign_in_at: "2024-06-01T10:00:00Z" } } });
  });

  it("returns 403 when not super admin", async () => {
    const forbiddenResponse = new Response(JSON.stringify({ error: { code: "FORBIDDEN" } }), {
      status: 403,
    });
    mockRequireSuperAdmin.mockResolvedValue({ data: null, error: forbiddenResponse });

    const res = await GET();
    expect(res.status).toBe(403);
  });

  it("returns 200 with profile including lastLogin", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe(mockProfile.id);
    expect(body.name).toBe(mockProfile.name);
    expect(body.email).toBe(mockProfile.email);
    expect(body.lastLogin).toBe("2024-06-01T10:00:00Z");
  });

  it("returns null lastLogin when supabase user has no last_sign_in_at", async () => {
    mockGetUser.mockResolvedValue({ data: { user: {} } });

    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.lastLogin).toBeNull();
  });

  it("returns 404 when super admin not found in DB", async () => {
    mockPrisma.superAdmin.findUnique.mockResolvedValue(null);

    const res = await GET();
    expect(res.status).toBe(404);
  });

  it("returns 500 on DB error", async () => {
    mockPrisma.superAdmin.findUnique.mockRejectedValue(new Error("DB error"));

    const res = await GET();
    expect(res.status).toBe(500);
  });
});

describe("PATCH /api/v1/super-admin/settings/profile", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRequireSuperAdmin.mockResolvedValue(saOk);
    mockLogAudit.mockResolvedValue(undefined);
    mockPrisma.superAdmin.findUnique.mockResolvedValue(mockProfile);
    mockPrisma.superAdmin.update.mockResolvedValue({
      ...mockProfile,
      name: "New Name",
      updatedAt: new Date(),
    });
  });

  it("returns 403 when not super admin", async () => {
    const forbiddenResponse = new Response(JSON.stringify({ error: { code: "FORBIDDEN" } }), {
      status: 403,
    });
    mockRequireSuperAdmin.mockResolvedValue({ data: null, error: forbiddenResponse });

    const res = await PATCH(makePatchReq({ name: "New Name" }));
    expect(res.status).toBe(403);
  });

  it("returns 422 for invalid name (too short)", async () => {
    const res = await PATCH(makePatchReq({ name: "X" }));
    expect(res.status).toBe(422);
  });

  it("returns 200 and updated name", async () => {
    const res = await PATCH(makePatchReq({ name: "New Name" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.name).toBe("New Name");
  });

  it("logs audit on success", async () => {
    await PATCH(makePatchReq({ name: "New Name" }));
    expect(mockLogAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        actionType: "SA_SETTINGS_UPDATED",
        entityType: "SuperAdmin",
        oldValue: { name: "Super Admin" },
        newValue: { name: "New Name" },
      }),
    );
  });

  it("returns 404 when super admin not found in DB", async () => {
    mockPrisma.superAdmin.findUnique.mockResolvedValue(null);

    const res = await PATCH(makePatchReq({ name: "New Name" }));
    expect(res.status).toBe(404);
  });

  it("returns 500 on DB error", async () => {
    mockPrisma.superAdmin.findUnique.mockResolvedValue(mockProfile);
    mockPrisma.superAdmin.update.mockRejectedValue(new Error("DB error"));

    const res = await PATCH(makePatchReq({ name: "New Name" }));
    expect(res.status).toBe(500);
  });
});
