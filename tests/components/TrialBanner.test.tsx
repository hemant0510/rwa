import React from "react";

import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";

import { TrialBanner } from "@/components/features/TrialBanner";
import { AuthContext } from "@/hooks/useAuth";

function renderWithAuth(user: Record<string, unknown> | null) {
  return render(
    <AuthContext.Provider
      value={{
        user: user as never,
        isLoading: false,
        isAuthenticated: !!user,
        signOut: async () => {},
      }}
    >
      <TrialBanner />
    </AuthContext.Provider>,
  );
}

describe("TrialBanner", () => {
  it("renders nothing when no user", () => {
    const { container } = renderWithAuth(null);
    expect(container.innerHTML).toBe("");
  });

  it("renders nothing when society is not TRIAL", () => {
    const { container } = renderWithAuth({
      id: "u1",
      name: "Admin",
      role: "RWA_ADMIN",
      societyStatus: "ACTIVE",
      isTrialExpired: false,
      trialEndsAt: null,
    });
    expect(container.innerHTML).toBe("");
  });

  it("renders expired banner when trial expired", () => {
    renderWithAuth({
      id: "u1",
      name: "Admin",
      role: "RWA_ADMIN",
      societyStatus: "TRIAL",
      isTrialExpired: true,
      trialEndsAt: null,
    });
    expect(screen.getByText("Trial Expired")).toBeInTheDocument();
  });

  it("renders warning when 3 or fewer days remain", () => {
    const soon = new Date();
    soon.setDate(soon.getDate() + 2);
    renderWithAuth({
      id: "u1",
      name: "Admin",
      role: "RWA_ADMIN",
      societyStatus: "TRIAL",
      isTrialExpired: false,
      trialEndsAt: soon.toISOString(),
    });
    expect(screen.getByText("Trial Ending Soon")).toBeInTheDocument();
  });

  it("renders nothing when more than 3 days remain", () => {
    const farOut = new Date();
    farOut.setDate(farOut.getDate() + 10);
    const { container } = renderWithAuth({
      id: "u1",
      name: "Admin",
      role: "RWA_ADMIN",
      societyStatus: "TRIAL",
      isTrialExpired: false,
      trialEndsAt: farOut.toISOString(),
    });
    expect(container.querySelector("[role='alert']")).toBeNull();
  });

  it("renders nothing when TRIAL but trialEndsAt is null and not expired", () => {
    const { container } = renderWithAuth({
      id: "u1",
      name: "Admin",
      role: "RWA_ADMIN",
      societyStatus: "TRIAL",
      isTrialExpired: false,
      trialEndsAt: null,
    });
    expect(container.innerHTML).toBe("");
  });

  it("shows singular 'day' when exactly 1 day remains", () => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    renderWithAuth({
      id: "u1",
      name: "Admin",
      role: "RWA_ADMIN",
      societyStatus: "TRIAL",
      isTrialExpired: false,
      trialEndsAt: tomorrow.toISOString(),
    });
    expect(screen.getByText(/1 day\./)).toBeInTheDocument();
  });
});
