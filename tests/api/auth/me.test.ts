import { describe, it, expect, vi, beforeEach } from "vitest";

import { mockPrisma } from "../../__mocks__/prisma";
import { mockSupabaseClient } from "../../__mocks__/supabase";

const { mockGetActiveSocietyId } = vi.hoisted(() => ({
  mockGetActiveSocietyId: vi.fn(),
}));

vi.mock("@/lib/active-society-server", () => ({
  getActiveSocietyId: mockGetActiveSocietyId,
}));

import { GET } from "@/app/api/v1/auth/me/route";

describe("GET /api/v1/auth/me", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetActiveSocietyId.mockResolvedValue(null);
  });

  it("returns 401 when not authenticated", async () => {
    mockSupabaseClient.auth.getUser.mockResolvedValueOnce({
      data: { user: null },
      error: null,
    });

    const res = await GET();
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error).toBe("Not authenticated");
  });

  it("returns super admin data when user is super admin", async () => {
    mockSupabaseClient.auth.getUser.mockResolvedValueOnce({
      data: { user: { id: "auth-1" } },
      error: null,
    });
    mockPrisma.superAdmin.findUnique.mockResolvedValue({
      id: "sa-1",
      name: "Super Admin",
      email: "sa@test.com",
      authUserId: "auth-1",
    });

    const res = await GET();
    const body = await res.json();
    expect(body.role).toBe("SUPER_ADMIN");
    expect(body.redirectTo).toBe("/sa/dashboard");
    expect(body.multiSociety).toBe(false);
  });

  it("returns 404 when no user records found", async () => {
    mockSupabaseClient.auth.getUser.mockResolvedValueOnce({
      data: { user: { id: "auth-1" } },
      error: null,
    });
    mockPrisma.superAdmin.findUnique.mockResolvedValue(null);
    mockPrisma.user.findMany.mockResolvedValue([]);

    const res = await GET();
    expect(res.status).toBe(404);
  });

  it("returns single society user with correct redirectTo", async () => {
    mockSupabaseClient.auth.getUser.mockResolvedValueOnce({
      data: { user: { id: "auth-1" } },
      error: null,
    });
    mockPrisma.superAdmin.findUnique.mockResolvedValue(null);
    mockPrisma.user.findMany.mockResolvedValue([
      {
        id: "u1",
        name: "Hemant",
        email: "h@test.com",
        role: "RESIDENT",
        societyId: "soc-1",
        adminPermission: null,
        isEmailVerified: true,
        authUserId: "auth-1",
        governingBodyMembership: null,
        society: {
          name: "Eden Estate",
          societyCode: "EDEN",
          status: "ACTIVE",
          trialEndsAt: null,
          emailVerificationRequired: false,
        },
      },
    ]);

    const res = await GET();
    const body = await res.json();
    expect(body.redirectTo).toBe("/r/home");
    expect(body.multiSociety).toBe(false);
    expect(body.societies).toBeNull();
    expect(body.societyName).toBe("Eden Estate");
  });

  it("returns multi-society user with societies array and designation", async () => {
    mockSupabaseClient.auth.getUser.mockResolvedValueOnce({
      data: { user: { id: "auth-1" } },
      error: null,
    });
    mockPrisma.superAdmin.findUnique.mockResolvedValue(null);
    mockPrisma.user.findMany.mockResolvedValue([
      {
        id: "u1",
        name: "Hemant",
        email: "h@test.com",
        role: "RESIDENT",
        societyId: "soc-1",
        adminPermission: null,
        isEmailVerified: true,
        authUserId: "auth-1",
        governingBodyMembership: { designation: { name: "President" } },
        society: {
          name: "Eden Estate",
          societyCode: "EDEN",
          status: "ACTIVE",
          trialEndsAt: null,
          emailVerificationRequired: false,
        },
      },
      {
        id: "u2",
        name: "Hemant",
        email: "h@test.com",
        role: "RESIDENT",
        societyId: "soc-2",
        adminPermission: null,
        isEmailVerified: true,
        authUserId: "auth-1",
        governingBodyMembership: null,
        society: {
          name: "Green Valley",
          societyCode: "GV",
          status: "ACTIVE",
          trialEndsAt: null,
          emailVerificationRequired: false,
        },
      },
    ]);

    const res = await GET();
    const body = await res.json();
    expect(body.multiSociety).toBe(true);
    expect(body.redirectTo).toBe("/select-society");
    expect(body.societies).toHaveLength(2);
    expect(body.societies[0].designation).toBe("President");
    expect(body.societies[1].designation).toBeNull();
  });

  it("uses active-society cookie to resolve correct user", async () => {
    mockGetActiveSocietyId.mockResolvedValue("soc-2");
    mockSupabaseClient.auth.getUser.mockResolvedValueOnce({
      data: { user: { id: "auth-1" } },
      error: null,
    });
    mockPrisma.superAdmin.findUnique.mockResolvedValue(null);
    mockPrisma.user.findMany.mockResolvedValue([
      {
        id: "u1",
        name: "Hemant",
        email: "h@test.com",
        role: "RESIDENT",
        societyId: "soc-1",
        adminPermission: null,
        isEmailVerified: true,
        authUserId: "auth-1",
        governingBodyMembership: null,
        society: {
          name: "Eden Estate",
          societyCode: "EDEN",
          status: "ACTIVE",
          trialEndsAt: null,
          emailVerificationRequired: false,
        },
      },
      {
        id: "u2",
        name: "Hemant",
        email: "h@test.com",
        role: "RWA_ADMIN",
        societyId: "soc-2",
        adminPermission: "FULL_ACCESS",
        isEmailVerified: true,
        authUserId: "auth-1",
        governingBodyMembership: null,
        society: {
          name: "Green Valley",
          societyCode: "GV",
          status: "ACTIVE",
          trialEndsAt: null,
          emailVerificationRequired: false,
        },
      },
    ]);

    const res = await GET();
    const body = await res.json();
    // Should resolve to soc-2 based on cookie
    expect(body.societyName).toBe("Green Valley");
    expect(body.role).toBe("RWA_ADMIN");
  });

  it("returns emailVerified false when verification required but not done", async () => {
    mockSupabaseClient.auth.getUser.mockResolvedValueOnce({
      data: { user: { id: "auth-1" } },
      error: null,
    });
    mockPrisma.superAdmin.findUnique.mockResolvedValue(null);
    mockPrisma.user.findMany.mockResolvedValue([
      {
        id: "u1",
        name: "Test",
        email: "test@test.com",
        role: "RESIDENT",
        societyId: "soc-1",
        adminPermission: null,
        isEmailVerified: false,
        authUserId: "auth-1",
        governingBodyMembership: null,
        society: {
          name: "Test Society",
          societyCode: "TEST",
          status: "ACTIVE",
          trialEndsAt: null,
          emailVerificationRequired: true,
        },
      },
    ]);

    const res = await GET();
    const body = await res.json();
    expect(body.emailVerified).toBe(false);
    expect(body.redirectTo).toBeNull();
  });

  it("computes isTrialExpired correctly", async () => {
    mockSupabaseClient.auth.getUser.mockResolvedValueOnce({
      data: { user: { id: "auth-1" } },
      error: null,
    });
    mockPrisma.superAdmin.findUnique.mockResolvedValue(null);
    mockPrisma.user.findMany.mockResolvedValue([
      {
        id: "u1",
        name: "Test",
        email: "test@test.com",
        role: "RWA_ADMIN",
        societyId: "soc-1",
        adminPermission: "FULL_ACCESS",
        isEmailVerified: true,
        authUserId: "auth-1",
        governingBodyMembership: null,
        society: {
          name: "Test",
          societyCode: "TEST",
          status: "TRIAL",
          trialEndsAt: new Date("2020-01-01"),
          emailVerificationRequired: false,
        },
      },
    ]);

    const res = await GET();
    const body = await res.json();
    expect(body.isTrialExpired).toBe(true);
  });

  it("returns admin redirectTo for RWA_ADMIN role", async () => {
    mockSupabaseClient.auth.getUser.mockResolvedValueOnce({
      data: { user: { id: "auth-1" } },
      error: null,
    });
    mockPrisma.superAdmin.findUnique.mockResolvedValue(null);
    mockPrisma.user.findMany.mockResolvedValue([
      {
        id: "u1",
        name: "Admin",
        email: "admin@test.com",
        role: "RWA_ADMIN",
        societyId: "soc-1",
        adminPermission: "FULL_ACCESS",
        isEmailVerified: true,
        authUserId: "auth-1",
        governingBodyMembership: null,
        society: {
          name: "Test",
          societyCode: "TEST",
          status: "ACTIVE",
          trialEndsAt: null,
          emailVerificationRequired: false,
        },
      },
    ]);

    const res = await GET();
    const body = await res.json();
    expect(body.redirectTo).toBe("/admin/dashboard");
  });

  it("falls back to allUsers[0] when cookie points to non-existent society", async () => {
    mockGetActiveSocietyId.mockResolvedValue("soc-nonexistent");
    mockSupabaseClient.auth.getUser.mockResolvedValueOnce({
      data: { user: { id: "auth-1" } },
      error: null,
    });
    mockPrisma.superAdmin.findUnique.mockResolvedValue(null);
    mockPrisma.user.findMany.mockResolvedValue([
      {
        id: "u1",
        name: "First User",
        email: "first@test.com",
        role: "RESIDENT",
        societyId: "soc-1",
        adminPermission: null,
        isEmailVerified: true,
        authUserId: "auth-1",
        governingBodyMembership: null,
        society: {
          name: "Eden Estate",
          societyCode: "EDEN",
          status: "ACTIVE",
          trialEndsAt: null,
          emailVerificationRequired: false,
        },
      },
    ]);

    const res = await GET();
    const body = await res.json();
    // Falls back to allUsers[0] since no user matches the cookie societyId
    expect(body.societyName).toBe("Eden Estate");
  });

  it("returns isTrialExpired false when status is TRIAL but trialEndsAt is null", async () => {
    mockSupabaseClient.auth.getUser.mockResolvedValueOnce({
      data: { user: { id: "auth-1" } },
      error: null,
    });
    mockPrisma.superAdmin.findUnique.mockResolvedValue(null);
    mockPrisma.user.findMany.mockResolvedValue([
      {
        id: "u1",
        name: "Test",
        email: "test@test.com",
        role: "RWA_ADMIN",
        societyId: "soc-1",
        adminPermission: "FULL_ACCESS",
        isEmailVerified: true,
        authUserId: "auth-1",
        governingBodyMembership: null,
        society: {
          name: "Test",
          societyCode: "TEST",
          status: "TRIAL",
          trialEndsAt: null,
          emailVerificationRequired: false,
        },
      },
    ]);

    const res = await GET();
    const body = await res.json();
    expect(body.isTrialExpired).toBe(false);
  });

  it("builds societies array with null name/code fallbacks", async () => {
    mockSupabaseClient.auth.getUser.mockResolvedValueOnce({
      data: { user: { id: "auth-1" } },
      error: null,
    });
    mockPrisma.superAdmin.findUnique.mockResolvedValue(null);
    mockPrisma.user.findMany.mockResolvedValue([
      {
        id: "u1",
        name: "User 1",
        email: "u1@test.com",
        role: "RESIDENT",
        societyId: "soc-1",
        adminPermission: null,
        isEmailVerified: true,
        authUserId: "auth-1",
        governingBodyMembership: null,
        society: null, // no society
      },
      {
        id: "u2",
        name: "User 2",
        email: "u2@test.com",
        role: "RESIDENT",
        societyId: "soc-2",
        adminPermission: null,
        isEmailVerified: true,
        authUserId: "auth-1",
        governingBodyMembership: null,
        society: {
          name: null,
          societyCode: null,
          status: "ACTIVE",
          trialEndsAt: null,
          emailVerificationRequired: false,
        },
      },
    ]);

    const res = await GET();
    const body = await res.json();
    expect(body.multiSociety).toBe(true);
    expect(body.societies[0].name).toBeNull();
    expect(body.societies[1].code).toBeNull();
  });
});
