import React from "react";

import { renderHook } from "@testing-library/react";
import { describe, it, expect } from "vitest";

import { AuthContext, useAuth } from "@/hooks/useAuth";

describe("useAuth", () => {
  it("returns context value when inside provider", () => {
    const mockValue = {
      user: {
        id: "u1",
        name: "Test User",
        role: "RWA_ADMIN" as const,
        permission: "FULL_ACCESS" as const,
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
    };

    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <AuthContext.Provider value={mockValue}>{children}</AuthContext.Provider>
    );

    const { result } = renderHook(() => useAuth(), { wrapper });
    expect(result.current.user?.name).toBe("Test User");
    expect(result.current.isAuthenticated).toBe(true);
  });

  it("returns default context values", () => {
    const { result } = renderHook(() => useAuth());
    expect(result.current.user).toBeNull();
    expect(result.current.isLoading).toBe(true);
    expect(result.current.isAuthenticated).toBe(false);
  });
});
