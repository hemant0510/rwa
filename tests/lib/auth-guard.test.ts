import { describe, it, expect, vi, beforeEach } from "vitest";

// --- Hoisted mocks ---
const mockGetAuthUser = vi.hoisted(() => vi.fn());
const mockSuperAdminFindUnique = vi.hoisted(() => vi.fn());
const mockCounsellorFindUnique = vi.hoisted(() => vi.fn());
const mockIsCounsellorRoleEnabled = vi.hoisted(() => vi.fn());

vi.mock("@/lib/get-current-user", () => ({ getAuthUser: mockGetAuthUser }));
vi.mock("@/lib/prisma", () => ({
  prisma: {
    superAdmin: { findUnique: mockSuperAdminFindUnique },
    counsellor: { findUnique: mockCounsellorFindUnique },
  },
}));
vi.mock("@/lib/counsellor/feature-flag", () => ({
  isCounsellorRoleEnabled: mockIsCounsellorRoleEnabled,
}));

// --- Import after mocks ---
import { requireSuperAdmin, requireCounsellor } from "@/lib/auth-guard";

describe("requireSuperAdmin", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAuthUser.mockResolvedValue({ id: "auth-sa-1" });
  });

  it("returns 401 when no Supabase user (not logged in)", async () => {
    mockGetAuthUser.mockResolvedValue(null);

    const result = await requireSuperAdmin();

    expect(result.data).toBeNull();
    expect(result.error).toBeInstanceOf(Response);
    const body = await (result.error as Response).json();
    expect(body.error.code).toBe("UNAUTHORIZED");
    expect((result.error as Response).status).toBe(401);
  });

  it("returns 403 when user exists but is not in super_admins table", async () => {
    mockGetAuthUser.mockResolvedValue({ id: "auth-user-999" });
    mockSuperAdminFindUnique.mockResolvedValue(null);

    const result = await requireSuperAdmin();

    expect(result.data).toBeNull();
    const body = await (result.error as Response).json();
    expect(body.error.code).toBe("FORBIDDEN");
    expect((result.error as Response).status).toBe(403);
  });

  it("returns 403 when super admin is inactive", async () => {
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
    mockGetAuthUser.mockResolvedValue({ id: "specific-auth-id" });
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
    mockGetAuthUser.mockResolvedValue({ id: "auth-c-1" });
    mockIsCounsellorRoleEnabled.mockResolvedValue(true);
  });

  it("returns 403 when feature flag is disabled", async () => {
    mockIsCounsellorRoleEnabled.mockResolvedValue(false);

    const result = await requireCounsellor();

    expect(result.data).toBeNull();
    const body = await (result.error as Response).json();
    expect(body.error.code).toBe("FORBIDDEN");
    expect(body.error.message).toBe("Counsellor role is disabled");
    expect(mockGetAuthUser).not.toHaveBeenCalled();
  });

  it("returns 401 when no Supabase user (not logged in)", async () => {
    mockGetAuthUser.mockResolvedValue(null);

    const result = await requireCounsellor();

    expect(result.data).toBeNull();
    expect(result.error).toBeInstanceOf(Response);
    const body = await (result.error as Response).json();
    expect(body.error.code).toBe("UNAUTHORIZED");
    expect((result.error as Response).status).toBe(401);
  });

  it("returns 403 when user exists but is not in counsellors table", async () => {
    mockGetAuthUser.mockResolvedValue({ id: "auth-user-999" });
    mockCounsellorFindUnique.mockResolvedValue(null);

    const result = await requireCounsellor();

    expect(result.data).toBeNull();
    const body = await (result.error as Response).json();
    expect(body.error.code).toBe("FORBIDDEN");
    expect(body.error.message).toBe("Counsellor access required");
    expect((result.error as Response).status).toBe(403);
  });

  it("returns 403 when counsellor is inactive (suspended)", async () => {
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
    mockGetAuthUser.mockResolvedValue({ id: "specific-auth-id" });
    mockCounsellorFindUnique.mockResolvedValue(null);

    await requireCounsellor();

    expect(mockCounsellorFindUnique).toHaveBeenCalledWith({
      where: { authUserId: "specific-auth-id" },
      select: { id: true, authUserId: true, email: true, name: true, isActive: true },
    });
  });
});
