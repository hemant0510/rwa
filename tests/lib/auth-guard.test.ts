import { describe, it, expect, vi, beforeEach } from "vitest";

// --- Hoisted mocks ---
const mockGetUser = vi.hoisted(() => vi.fn());
const mockCreateClient = vi.hoisted(() =>
  vi.fn().mockResolvedValue({ auth: { getUser: mockGetUser } }),
);
const mockSuperAdminFindUnique = vi.hoisted(() => vi.fn());
const mockCounsellorFindUnique = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabase/server", () => ({ createClient: mockCreateClient }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    superAdmin: { findUnique: mockSuperAdminFindUnique },
    counsellor: { findUnique: mockCounsellorFindUnique },
  },
}));

// --- Import after mocks ---
import { requireSuperAdmin, requireCounsellor } from "@/lib/auth-guard";

describe("requireSuperAdmin", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateClient.mockResolvedValue({ auth: { getUser: mockGetUser } });
  });

  it("returns 401 when no Supabase user (not logged in)", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });

    const result = await requireSuperAdmin();

    expect(result.data).toBeNull();
    expect(result.error).toBeInstanceOf(Response);
    const body = await (result.error as Response).json();
    expect(body.error.code).toBe("UNAUTHORIZED");
    expect((result.error as Response).status).toBe(401);
  });

  it("returns 403 when user exists but is not in super_admins table", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "auth-user-999" } },
      error: null,
    });
    mockSuperAdminFindUnique.mockResolvedValue(null);

    const result = await requireSuperAdmin();

    expect(result.data).toBeNull();
    const body = await (result.error as Response).json();
    expect(body.error.code).toBe("FORBIDDEN");
    expect((result.error as Response).status).toBe(403);
  });

  it("returns 403 when super admin is inactive", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "auth-sa-1" } },
      error: null,
    });
    mockSuperAdminFindUnique.mockResolvedValue({
      id: "sa-1",
      authUserId: "auth-sa-1",
      email: "sa@rwa.com",
      isActive: false,
    });

    const result = await requireSuperAdmin();

    expect(result.data).toBeNull();
    const body = await (result.error as Response).json();
    expect(body.error.code).toBe("FORBIDDEN");
    expect(body.error.message).toBe("Super admin access required");
  });

  it("returns SA context when active super admin", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "auth-sa-1" } },
      error: null,
    });
    mockSuperAdminFindUnique.mockResolvedValue({
      id: "sa-1",
      authUserId: "auth-sa-1",
      email: "sa@rwa.com",
      isActive: true,
    });

    const result = await requireSuperAdmin();

    expect(result.error).toBeNull();
    expect(result.data).toEqual({
      superAdminId: "sa-1",
      authUserId: "auth-sa-1",
      email: "sa@rwa.com",
    });
  });

  it("queries super_admins by authUserId from Supabase user", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "specific-auth-id" } },
      error: null,
    });
    mockSuperAdminFindUnique.mockResolvedValue(null);

    await requireSuperAdmin();

    expect(mockSuperAdminFindUnique).toHaveBeenCalledWith({
      where: { authUserId: "specific-auth-id" },
      select: { id: true, authUserId: true, email: true, isActive: true },
    });
  });
});

describe("requireCounsellor", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateClient.mockResolvedValue({ auth: { getUser: mockGetUser } });
  });

  it("returns 401 when no Supabase user (not logged in)", async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });

    const result = await requireCounsellor();

    expect(result.data).toBeNull();
    expect(result.error).toBeInstanceOf(Response);
    const body = await (result.error as Response).json();
    expect(body.error.code).toBe("UNAUTHORIZED");
    expect((result.error as Response).status).toBe(401);
  });

  it("returns 403 when user exists but is not in counsellors table", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "auth-user-999" } },
      error: null,
    });
    mockCounsellorFindUnique.mockResolvedValue(null);

    const result = await requireCounsellor();

    expect(result.data).toBeNull();
    const body = await (result.error as Response).json();
    expect(body.error.code).toBe("FORBIDDEN");
    expect(body.error.message).toBe("Counsellor access required");
    expect((result.error as Response).status).toBe(403);
  });

  it("returns 403 when counsellor is inactive (suspended)", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "auth-c-1" } },
      error: null,
    });
    mockCounsellorFindUnique.mockResolvedValue({
      id: "c-1",
      authUserId: "auth-c-1",
      email: "counsellor@rwa.com",
      name: "Asha Patel",
      isActive: false,
    });

    const result = await requireCounsellor();

    expect(result.data).toBeNull();
    const body = await (result.error as Response).json();
    expect(body.error.code).toBe("FORBIDDEN");
  });

  it("returns counsellor context when active", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "auth-c-1" } },
      error: null,
    });
    mockCounsellorFindUnique.mockResolvedValue({
      id: "c-1",
      authUserId: "auth-c-1",
      email: "counsellor@rwa.com",
      name: "Asha Patel",
      isActive: true,
    });

    const result = await requireCounsellor();

    expect(result.error).toBeNull();
    expect(result.data).toEqual({
      counsellorId: "c-1",
      authUserId: "auth-c-1",
      email: "counsellor@rwa.com",
      name: "Asha Patel",
    });
  });

  it("queries counsellors by authUserId from Supabase user", async () => {
    mockGetUser.mockResolvedValue({
      data: { user: { id: "specific-auth-id" } },
      error: null,
    });
    mockCounsellorFindUnique.mockResolvedValue(null);

    await requireCounsellor();

    expect(mockCounsellorFindUnique).toHaveBeenCalledWith({
      where: { authUserId: "specific-auth-id" },
      select: { id: true, authUserId: true, email: true, name: true, isActive: true },
    });
  });
});
