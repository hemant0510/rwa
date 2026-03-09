import React from "react";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { SocietySwitcher } from "@/components/features/SocietySwitcher";
import { AuthContext } from "@/hooks/useAuth";
import type { SocietySummary } from "@/hooks/useAuth";

const mockSwitchSociety = vi.fn();

function renderSwitcher(societies: SocietySummary[], currentSocietyId: string) {
  const currentSociety = societies.find((s) => s.societyId === currentSocietyId);
  const value = {
    user: {
      id: "u1",
      name: "Test User",
      role: "RESIDENT" as const,
      permission: null,
      societyId: currentSocietyId,
      societyName: currentSociety?.name ?? null,
      societyCode: currentSociety?.code ?? null,
      societyStatus: "ACTIVE",
      trialEndsAt: null,
      isTrialExpired: false,
      multiSociety: societies.length > 1,
      societies,
    },
    isLoading: false,
    isAuthenticated: true,
    signOut: vi.fn(),
    switchSociety: mockSwitchSociety,
  };

  return render(
    <AuthContext.Provider value={value}>
      <SocietySwitcher />
    </AuthContext.Provider>,
  );
}

describe("SocietySwitcher", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const twoSocieties: SocietySummary[] = [
    {
      societyId: "soc-1",
      name: "Eden Estate",
      code: "EDEN",
      role: "RESIDENT",
      status: "ACTIVE_PAID",
      designation: "President",
    },
    {
      societyId: "soc-2",
      name: "Green Valley",
      code: "GV",
      role: "RESIDENT",
      status: "ACTIVE_PAID",
      designation: null,
    },
  ];

  it("renders null when user has fewer than 2 societies", () => {
    const singleSociety: SocietySummary[] = [
      {
        societyId: "soc-1",
        name: "Eden Estate",
        code: "EDEN",
        role: "RESIDENT",
        status: "ACTIVE_PAID",
        designation: null,
      },
    ];
    const { container } = renderSwitcher(singleSociety, "soc-1");
    expect(container.innerHTML).toBe("");
  });

  it("renders current society name in trigger", () => {
    renderSwitcher(twoSocieties, "soc-1");
    expect(screen.getByText("Eden Estate")).toBeInTheDocument();
  });

  it("shows designation in trigger when user has one", () => {
    renderSwitcher(twoSocieties, "soc-1");
    expect(screen.getByText("President")).toBeInTheDocument();
  });

  it("shows role label in trigger when no designation", () => {
    renderSwitcher(twoSocieties, "soc-2");
    expect(screen.getByText("Resident")).toBeInTheDocument();
  });

  it("shows other societies in dropdown on click", async () => {
    const user = userEvent.setup();
    renderSwitcher(twoSocieties, "soc-1");

    await user.click(screen.getByText("Eden Estate"));
    expect(screen.getByText("Green Valley")).toBeInTheDocument();
  });

  it("does not show current society in dropdown items", async () => {
    const user = userEvent.setup();
    renderSwitcher(twoSocieties, "soc-1");

    await user.click(screen.getByText("Eden Estate"));
    // "Eden Estate" should only appear once (in trigger), not in dropdown list
    const edenElements = screen.getAllByText("Eden Estate");
    expect(edenElements).toHaveLength(1);
  });

  it("calls switchSociety when another society is clicked", async () => {
    const user = userEvent.setup();
    renderSwitcher(twoSocieties, "soc-1");

    await user.click(screen.getByText("Eden Estate"));
    await user.click(screen.getByText("Green Valley"));

    expect(mockSwitchSociety).toHaveBeenCalledWith("soc-2");
  });

  it("shows designation badge for societies with designation in dropdown", async () => {
    const societies: SocietySummary[] = [
      {
        societyId: "soc-1",
        name: "Eden Estate",
        code: "EDEN",
        role: "RESIDENT",
        status: "ACTIVE_PAID",
        designation: null,
      },
      {
        societyId: "soc-2",
        name: "Green Valley",
        code: "GV",
        role: "RESIDENT",
        status: "ACTIVE_PAID",
        designation: "Secretary",
      },
    ];
    const user = userEvent.setup();
    renderSwitcher(societies, "soc-1");

    await user.click(screen.getByText("Eden Estate"));
    expect(screen.getByText("Secretary")).toBeInTheDocument();
  });

  it("shows Admin label for RWA_ADMIN role", async () => {
    const societies: SocietySummary[] = [
      {
        societyId: "soc-1",
        name: "Eden Estate",
        code: "EDEN",
        role: "RESIDENT",
        status: "ACTIVE_PAID",
        designation: null,
      },
      {
        societyId: "soc-2",
        name: "Admin Society",
        code: "ADM",
        role: "RWA_ADMIN",
        status: "ACTIVE_PAID",
        designation: null,
      },
    ];
    const user = userEvent.setup();
    renderSwitcher(societies, "soc-1");

    await user.click(screen.getByText("Eden Estate"));
    expect(screen.getByText("Admin")).toBeInTheDocument();
  });

  it("shows society code in dropdown", async () => {
    const user = userEvent.setup();
    renderSwitcher(twoSocieties, "soc-1");

    await user.click(screen.getByText("Eden Estate"));
    expect(screen.getByText("GV")).toBeInTheDocument();
  });
});
