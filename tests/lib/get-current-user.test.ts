import { describe, it, expect, vi, beforeEach } from "vitest";

import { mockPrisma } from "../__mocks__/prisma";
import { mockSupabaseClient } from "../__mocks__/supabase";

const { mockGetActiveSocietyId } = vi.hoisted(() => ({
  mockGetActiveSocietyId: vi.fn(),
}));

vi.mock("@/lib/active-society-server", () => ({
  getActiveSocietyId: mockGetActiveSocietyId,
}));

import {
  getAdminContext,
  getAuthUser,
  getCurrentUser,
  getFullAccessAdmin,
} from "@/lib/get-current-user";

const baseUser = {
  id: "u1",
  name: "Test User",
  societyId: "soc-1",
  role: "RESIDENT",
  adminPermission: null,
};

describe("getAuthUser", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSupabaseClient.auth.getUser.mockResolvedValue({
      data: { user: { id: "auth-1" } },
      error: null,
    });
  });

  it("returns the Supabase auth user when authenticated", async () => {
    const user = await getAuthUser();
    expect(user).toEqual({ id: "auth-1" });
    expect(mockSupabaseClient.auth.getUser).toHaveBeenCalledTimes(1);
  });

  it("returns null when not authenticated", async () => {
    mockSupabaseClient.auth.getUser.mockResolvedValueOnce({
      data: { user: null },
      error: null,
    });
    const user = await getAuthUser();
    expect(user).toBeNull();
  });
});

describe("getCurrentUser", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetActiveSocietyId.mockResolvedValue(null);
    mockSupabaseClient.auth.getUser.mockResolvedValue({
      data: { user: { id: "auth-1" } },
      error: null,
    });
  });

  it("returns null when not authenticated", async () => {
    mockSupabaseClient.auth.getUser.mockResolvedValueOnce({
      data: { user: null },
      error: null,
    });
    const result = await getCurrentUser();
    expect(result).toBeNull();
  });

  it("returns user when authenticated without requiredRole", async () => {
    mockPrisma.user.findFirst.mockResolvedValue(baseUser);
    const result = await getCurrentUser();
    expect(result).not.toBeNull();
    expect(result?.userId).toBe("u1");
    expect(result?.societyId).toBe("soc-1");
    expect(result?.authUserId).toBe("auth-1");
  });

  it("returns null when user is not found", async () => {
    mockPrisma.user.findFirst.mockResolvedValue(null);
    const result = await getCurrentUser();
    expect(result).toBeNull();
  });

  it("returns null when user has no societyId", async () => {
    mockPrisma.user.findFirst.mockResolvedValue({ ...baseUser, societyId: null });
    const result = await getCurrentUser();
    expect(result).toBeNull();
  });

  it("includes role in where clause when requiredRole is provided", async () => {
    mockPrisma.user.findFirst.mockResolvedValue({ ...baseUser, role: "RWA_ADMIN" });
    await getCurrentUser("RWA_ADMIN");
    expect(mockPrisma.user.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ role: "RWA_ADMIN" }),
      }),
    );
  });

  it("does not include role in where clause when no requiredRole", async () => {
    mockPrisma.user.findFirst.mockResolvedValue(baseUser);
    await getCurrentUser();
    const callArgs = mockPrisma.user.findFirst.mock.calls[0][0];
    expect(callArgs.where.role).toBeUndefined();
  });

  it("includes societyId in where clause when activeSocietyId is set", async () => {
    mockGetActiveSocietyId.mockResolvedValue("soc-42");
    mockPrisma.user.findFirst.mockResolvedValue(baseUser);
    await getCurrentUser();
    expect(mockPrisma.user.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ societyId: "soc-42" }),
      }),
    );
  });

  it("does not include societyId in where clause when no active society", async () => {
    mockGetActiveSocietyId.mockResolvedValue(null);
    mockPrisma.user.findFirst.mockResolvedValue(baseUser);
    await getCurrentUser();
    const callArgs = mockPrisma.user.findFirst.mock.calls[0][0];
    expect(callArgs.where.societyId).toBeUndefined();
  });

  it("returns adminPermission in result", async () => {
    mockPrisma.user.findFirst.mockResolvedValue({ ...baseUser, adminPermission: "FULL_ACCESS" });
    const result = await getCurrentUser();
    expect(result?.adminPermission).toBe("FULL_ACCESS");
  });
});

describe("getFullAccessAdmin", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetActiveSocietyId.mockResolvedValue(null);
    mockSupabaseClient.auth.getUser.mockResolvedValue({
      data: { user: { id: "auth-1" } },
      error: null,
    });
  });

  it("returns user when admin with FULL_ACCESS permission", async () => {
    mockPrisma.user.findFirst.mockResolvedValue({
      ...baseUser,
      role: "RWA_ADMIN",
      adminPermission: "FULL_ACCESS",
    });
    const result = await getFullAccessAdmin();
    expect(result).not.toBeNull();
    expect(result?.adminPermission).toBe("FULL_ACCESS");
  });

  it("returns null when user is not found", async () => {
    mockPrisma.user.findFirst.mockResolvedValue(null);
    const result = await getFullAccessAdmin();
    expect(result).toBeNull();
  });

  it("returns null when admin has READ_ONLY permission", async () => {
    mockPrisma.user.findFirst.mockResolvedValue({
      ...baseUser,
      role: "RWA_ADMIN",
      adminPermission: "READ_ONLY",
    });
    const result = await getFullAccessAdmin();
    expect(result).toBeNull();
  });

  it("returns null when adminPermission is null", async () => {
    mockPrisma.user.findFirst.mockResolvedValue({ ...baseUser, role: "RWA_ADMIN" });
    const result = await getFullAccessAdmin();
    expect(result).toBeNull();
  });
});

describe("getAdminContext", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSupabaseClient.auth.getUser.mockResolvedValue({
      data: { user: { id: "auth-1" } },
      error: null,
    });
  });

  it("returns null when not authenticated", async () => {
    mockSupabaseClient.auth.getUser.mockResolvedValueOnce({
      data: { user: null },
      error: null,
    });
    const result = await getAdminContext("soc-1");
    expect(result).toBeNull();
  });

  it("returns RWA_ADMIN context for their own society", async () => {
    mockPrisma.user.findFirst.mockResolvedValue({
      ...baseUser,
      role: "RWA_ADMIN",
      adminPermission: "FULL_ACCESS",
    });
    const result = await getAdminContext("soc-1");
    expect(result).not.toBeNull();
    expect(result?.role).toBe("RWA_ADMIN");
    expect(result?.societyId).toBe("soc-1");
    expect(result?.isSuperAdmin).toBe(false);
    expect(result?.adminPermission).toBe("FULL_ACCESS");
  });

  it("returns null when RWA_ADMIN is asked for a different society", async () => {
    mockPrisma.user.findFirst.mockResolvedValue({
      ...baseUser,
      role: "RWA_ADMIN",
      adminPermission: "FULL_ACCESS",
    });
    const result = await getAdminContext("soc-other");
    expect(result).toBeNull();
  });

  it("returns RWA_ADMIN context when targetSocietyId is null", async () => {
    mockPrisma.user.findFirst.mockResolvedValue({
      ...baseUser,
      role: "RWA_ADMIN",
      adminPermission: "FULL_ACCESS",
    });
    const result = await getAdminContext(null);
    expect(result).not.toBeNull();
    expect(result?.societyId).toBe("soc-1");
    expect(result?.isSuperAdmin).toBe(false);
  });

  it("returns Super Admin context with synthesized FULL_ACCESS when target society supplied", async () => {
    mockPrisma.user.findFirst.mockResolvedValue(null);
    mockPrisma.superAdmin.findUnique.mockResolvedValue({
      id: "sa-1",
      email: "sa@example.com",
      name: "Super Admin",
      isActive: true,
    });
    const result = await getAdminContext("soc-other");
    expect(result).not.toBeNull();
    expect(result?.role).toBe("SUPER_ADMIN");
    expect(result?.isSuperAdmin).toBe(true);
    expect(result?.societyId).toBe("soc-other");
    expect(result?.adminPermission).toBe("FULL_ACCESS");
    expect(result?.userId).toBeNull();
  });

  it("returns null for Super Admin when no target society supplied", async () => {
    mockPrisma.user.findFirst.mockResolvedValue(null);
    mockPrisma.superAdmin.findUnique.mockResolvedValue({
      id: "sa-1",
      email: "sa@example.com",
      name: "Super Admin",
      isActive: true,
    });
    const result = await getAdminContext(null);
    expect(result).toBeNull();
  });

  it("returns null for inactive Super Admin", async () => {
    mockPrisma.user.findFirst.mockResolvedValue(null);
    mockPrisma.superAdmin.findUnique.mockResolvedValue({
      id: "sa-1",
      email: "sa@example.com",
      name: "Super Admin",
      isActive: false,
    });
    const result = await getAdminContext("soc-1");
    expect(result).toBeNull();
  });

  it("returns null when caller is neither admin nor super admin", async () => {
    mockPrisma.user.findFirst.mockResolvedValue(null);
    mockPrisma.superAdmin.findUnique.mockResolvedValue(null);
    const result = await getAdminContext("soc-1");
    expect(result).toBeNull();
  });
});
