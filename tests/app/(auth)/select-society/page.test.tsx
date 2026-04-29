import React from "react";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockPush, mockRefresh, mockSetActiveSocietyId } = vi.hoisted(() => ({
  mockPush: vi.fn(),
  mockRefresh: vi.fn(),
  mockSetActiveSocietyId: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, refresh: mockRefresh }),
}));

vi.mock("@/lib/active-society", () => ({
  setActiveSocietyId: mockSetActiveSocietyId,
}));

import SelectSocietyPage from "@/app/(auth)/select-society/page";
import { AuthContext } from "@/hooks/useAuth";
import type { SocietySummary } from "@/hooks/useAuth";

function renderWithAuth(societies: SocietySummary[], isLoading = false) {
  const value = {
    user: isLoading
      ? null
      : {
          id: "u1",
          name: "Test User",
          role: "RESIDENT" as const,
          permission: null,
          societyId: "soc-1",
          societyName: "Greenwood Residency",
          societyCode: "GRNW",
          societyStatus: "ACTIVE",
          trialEndsAt: null,
          isTrialExpired: false,
          multiSociety: true,
          societies,
        },
    isLoading,
    isAuthenticated: !isLoading,
    signOut: vi.fn(),
    switchSociety: vi.fn(),
  };

  return render(
    <AuthContext.Provider value={value}>
      <SelectSocietyPage />
    </AuthContext.Provider>,
  );
}

describe("SelectSocietyPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const societies: SocietySummary[] = [
    {
      societyId: "soc-1",
      name: "Greenwood Residency",
      code: "EDEN",
      role: "RWA_ADMIN",
      status: "ACTIVE_PAID",
      designation: null,
    },
    {
      societyId: "soc-2",
      name: "Green Valley",
      code: "GV",
      role: "RESIDENT",
      status: "ACTIVE_PAID",
      designation: "President",
    },
  ];

  it("renders select society heading", () => {
    renderWithAuth(societies);
    expect(screen.getByText("Select Society")).toBeInTheDocument();
  });

  it("renders description text", () => {
    renderWithAuth(societies);
    expect(
      screen.getByText("You belong to multiple societies. Choose one to continue."),
    ).toBeInTheDocument();
  });

  it("renders all society cards", () => {
    renderWithAuth(societies);
    expect(screen.getByText("Greenwood Residency")).toBeInTheDocument();
    expect(screen.getByText("Green Valley")).toBeInTheDocument();
  });

  it("shows society codes", () => {
    renderWithAuth(societies);
    expect(screen.getByText("EDEN")).toBeInTheDocument();
    expect(screen.getByText("GV")).toBeInTheDocument();
  });

  it("shows Admin role label", () => {
    renderWithAuth(societies);
    expect(screen.getByText("Admin")).toBeInTheDocument();
  });

  it("shows designation instead of role when available", () => {
    renderWithAuth(societies);
    expect(screen.getByText("President")).toBeInTheDocument();
  });

  it("sets active society and redirects to admin dashboard on admin society click", async () => {
    const user = userEvent.setup();
    renderWithAuth(societies);

    await user.click(screen.getByText("Greenwood Residency"));

    expect(mockSetActiveSocietyId).toHaveBeenCalledWith("soc-1");
    expect(mockPush).toHaveBeenCalledWith("/admin/dashboard");
    expect(mockRefresh).toHaveBeenCalled();
  });

  it("redirects to resident home on resident society click", async () => {
    const user = userEvent.setup();
    renderWithAuth(societies);

    await user.click(screen.getByText("Green Valley"));

    expect(mockSetActiveSocietyId).toHaveBeenCalledWith("soc-2");
    expect(mockPush).toHaveBeenCalledWith("/r/home");
  });

  it("renders loading skeleton when isLoading", () => {
    const { container } = renderWithAuth([], true);
    // PageSkeleton renders skeleton elements
    expect(container.querySelector("[data-slot='skeleton']")).toBeTruthy();
  });

  it("handles empty societies gracefully", () => {
    renderWithAuth([]);
    expect(screen.getByText("Select Society")).toBeInTheDocument();
  });
});
