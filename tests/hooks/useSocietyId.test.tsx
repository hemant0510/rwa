import React from "react";

import { renderHook } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { AuthContext } from "@/hooks/useAuth";
import { useSAHref, useSocietyId } from "@/hooks/useSocietyId";

const { mockGetSearchParams } = vi.hoisted(() => ({
  mockGetSearchParams: vi.fn().mockReturnValue(new URLSearchParams("")),
}));

vi.mock("next/navigation", () => ({
  useSearchParams: () => mockGetSearchParams(),
}));

function makeAdminUser(overrides: Record<string, unknown> = {}) {
  return {
    id: "u1",
    name: "Admin",
    role: "RWA_ADMIN" as const,
    permission: "FULL_ACCESS" as const,
    societyId: "soc-1",
    societyName: "Eden Estate",
    societyCode: "EDEN",
    societyStatus: "ACTIVE",
    trialEndsAt: null,
    isTrialExpired: false,
    multiSociety: false,
    societies: null,
    ...overrides,
  };
}

function makeWrapper(user: ReturnType<typeof makeAdminUser> | null) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return (
      <AuthContext.Provider
        value={{
          user,
          isLoading: false,
          isAuthenticated: true,
          signOut: async () => {},
          switchSociety: async () => {},
        }}
      >
        {children}
      </AuthContext.Provider>
    );
  };
}

describe("useSocietyId — regular admin", () => {
  beforeEach(() => {
    mockGetSearchParams.mockReturnValue(new URLSearchParams(""));
  });

  it("returns user society for regular admin", () => {
    const { result } = renderHook(() => useSocietyId(), { wrapper: makeWrapper(makeAdminUser()) });
    expect(result.current.societyId).toBe("soc-1");
    expect(result.current.societyName).toBe("Eden Estate");
    expect(result.current.societyCode).toBe("EDEN");
    expect(result.current.isSuperAdminViewing).toBe(false);
    expect(result.current.saQueryString).toBe("");
  });

  it("returns empty societyId when user has no society", () => {
    const { result } = renderHook(() => useSocietyId(), {
      wrapper: makeWrapper(makeAdminUser({ societyId: null })),
    });
    expect(result.current.societyId).toBe("");
  });

  it("returns null societyName when user societyName is null", () => {
    const { result } = renderHook(() => useSocietyId(), {
      wrapper: makeWrapper(makeAdminUser({ societyName: null })),
    });
    expect(result.current.societyName).toBeNull();
  });

  it("returns null societyCode when user societyCode is null", () => {
    const { result } = renderHook(() => useSocietyId(), {
      wrapper: makeWrapper(makeAdminUser({ societyCode: null })),
    });
    expect(result.current.societyCode).toBeNull();
  });

  it("returns empty string saQueryString for regular admin (no sid param)", () => {
    const { result } = renderHook(() => useSocietyId(), { wrapper: makeWrapper(makeAdminUser()) });
    expect(result.current.saQueryString).toBe("");
  });
});

describe("useSocietyId — super admin viewing a society", () => {
  beforeEach(() => {
    mockGetSearchParams.mockReturnValue(
      new URLSearchParams("sid=soc-2&sname=Test%20Society&scode=TEST"),
    );
  });

  it("resolves society from query params for super admin", () => {
    const superAdmin = makeAdminUser({ role: "SUPER_ADMIN" as const });
    const { result } = renderHook(() => useSocietyId(), { wrapper: makeWrapper(superAdmin) });
    expect(result.current.societyId).toBe("soc-2");
    expect(result.current.societyName).toBe("Test Society");
    expect(result.current.societyCode).toBe("TEST");
    expect(result.current.isSuperAdminViewing).toBe(true);
  });

  it("builds saQueryString for super admin", () => {
    const superAdmin = makeAdminUser({ role: "SUPER_ADMIN" as const });
    const { result } = renderHook(() => useSocietyId(), { wrapper: makeWrapper(superAdmin) });
    expect(result.current.saQueryString).toContain("sid=soc-2");
    expect(result.current.saQueryString).toContain("sname=");
    expect(result.current.saQueryString).toContain("scode=");
  });

  it("falls back sname to Society when not in query params", () => {
    mockGetSearchParams.mockReturnValue(new URLSearchParams("sid=soc-2"));
    const superAdmin = makeAdminUser({ role: "SUPER_ADMIN" as const });
    const { result } = renderHook(() => useSocietyId(), { wrapper: makeWrapper(superAdmin) });
    expect(result.current.societyName).toBe("Society");
  });

  it("falls back scode to null when not in query params", () => {
    mockGetSearchParams.mockReturnValue(new URLSearchParams("sid=soc-2"));
    const superAdmin = makeAdminUser({ role: "SUPER_ADMIN" as const });
    const { result } = renderHook(() => useSocietyId(), { wrapper: makeWrapper(superAdmin) });
    expect(result.current.societyCode).toBeNull();
  });

  it("non-super-admin with sid param does not use SA mode", () => {
    // Regular admin should not use SA mode even if sid param is present
    const regularAdmin = makeAdminUser({ role: "RWA_ADMIN" as const });
    const { result } = renderHook(() => useSocietyId(), { wrapper: makeWrapper(regularAdmin) });
    expect(result.current.isSuperAdminViewing).toBe(false);
    expect(result.current.societyId).toBe("soc-1"); // uses own society
  });
});

describe("useSAHref", () => {
  it("returns basePath only for regular admin", () => {
    mockGetSearchParams.mockReturnValue(new URLSearchParams(""));
    const { result } = renderHook(() => useSAHref("/admin/events/123"), {
      wrapper: makeWrapper(makeAdminUser()),
    });
    expect(result.current).toBe("/admin/events/123");
  });

  it("appends SA query string for super admin", () => {
    mockGetSearchParams.mockReturnValue(
      new URLSearchParams("sid=soc-2&sname=Test%20Society&scode=TEST"),
    );
    const superAdmin = makeAdminUser({ role: "SUPER_ADMIN" as const });
    const { result } = renderHook(() => useSAHref("/admin/events/123"), {
      wrapper: makeWrapper(superAdmin),
    });
    expect(result.current).toContain("/admin/events/123?sid=soc-2");
    expect(result.current).toContain("sname=");
  });
});

describe("useSocietyId — null user", () => {
  beforeEach(() => {
    mockGetSearchParams.mockReturnValue(new URLSearchParams(""));
  });

  it("returns empty societyId when user is null", () => {
    const { result } = renderHook(() => useSocietyId(), { wrapper: makeWrapper(null) });
    expect(result.current.societyId).toBe("");
    expect(result.current.societyName).toBeNull();
    expect(result.current.societyCode).toBeNull();
    expect(result.current.isSuperAdminViewing).toBe(false);
    expect(result.current.saQueryString).toBe("");
  });
});
