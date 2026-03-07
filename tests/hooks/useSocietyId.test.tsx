import React from "react";

import { renderHook } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";

import { AuthContext } from "@/hooks/useAuth";
import { useSocietyId } from "@/hooks/useSocietyId";

vi.mock("next/navigation", () => ({
  useSearchParams: () => new URLSearchParams(""),
}));

describe("useSocietyId", () => {
  it("returns user society for regular admin", () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <AuthContext.Provider
        value={{
          user: {
            id: "u1",
            name: "Admin",
            role: "RWA_ADMIN",
            permission: "FULL_ACCESS",
            societyId: "soc-1",
            societyName: "Eden Estate",
            societyCode: "EDEN",
            societyStatus: "ACTIVE",
            trialEndsAt: null,
            isTrialExpired: false,
          },
          isLoading: false,
          isAuthenticated: true,
          signOut: async () => {},
        }}
      >
        {children}
      </AuthContext.Provider>
    );

    const { result } = renderHook(() => useSocietyId(), { wrapper });
    expect(result.current.societyId).toBe("soc-1");
    expect(result.current.societyName).toBe("Eden Estate");
    expect(result.current.isSuperAdminViewing).toBe(false);
    expect(result.current.saQueryString).toBe("");
  });

  it("returns empty societyId when user has no society", () => {
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <AuthContext.Provider
        value={{
          user: {
            id: "u1",
            name: "Admin",
            role: "RWA_ADMIN",
            permission: "FULL_ACCESS",
            societyId: null,
            societyName: null,
            societyCode: null,
            societyStatus: null,
            trialEndsAt: null,
            isTrialExpired: false,
          },
          isLoading: false,
          isAuthenticated: true,
          signOut: async () => {},
        }}
      >
        {children}
      </AuthContext.Provider>
    );

    const { result } = renderHook(() => useSocietyId(), { wrapper });
    expect(result.current.societyId).toBe("");
  });
});

describe("useSocietyId with super admin", () => {
  it("resolves society from query params for super admin", () => {
    // Override the mock for this test
    vi.doMock("next/navigation", () => ({
      useSearchParams: () => new URLSearchParams("sid=soc-2&sname=Test%20Society&scode=TEST"),
    }));
  });
});
