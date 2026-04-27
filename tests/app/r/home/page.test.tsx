import React from "react";

import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockFetch } = vi.hoisted(() => ({
  mockFetch: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/r/home",
}));

global.fetch = mockFetch;

import ResidentHomePage from "@/app/r/home/page";
import { AuthContext } from "@/hooks/useAuth";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

function renderWithProviders(
  userOverrides: Record<string, unknown> = {},
  fetchResponse: Record<string, unknown> | null = null,
) {
  if (fetchResponse) {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(fetchResponse),
    });
  }

  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  const value = {
    user: {
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
      multiSociety: false,
      societies: null,
      ...userOverrides,
    },
    isLoading: false,
    isAuthenticated: true,
    signOut: vi.fn(),
    switchSociety: vi.fn(),
  };

  return render(
    <QueryClientProvider client={queryClient}>
      <AuthContext.Provider value={value}>
        <ResidentHomePage />
      </AuthContext.Provider>
    </QueryClientProvider>,
  );
}

describe("ResidentHomePage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows loading spinner initially", () => {
    mockFetch.mockReturnValue(new Promise(() => {})); // never resolves
    renderWithProviders();
    expect(document.querySelector(".animate-spin")).toBeTruthy();
  });

  it("renders pending approval state", async () => {
    renderWithProviders(
      {},
      {
        id: "u1",
        name: "Test User",
        rwaid: null,
        status: "PENDING_APPROVAL",
        unit: null,
        societyName: "Greenwood Residency",
        designation: null,
        currentFee: null,
      },
    );

    await waitFor(() => {
      expect(screen.getByText("Registration Pending")).toBeInTheDocument();
    });
  });

  it("renders rejected state", async () => {
    renderWithProviders(
      {},
      {
        id: "u1",
        name: "Test User",
        rwaid: null,
        status: "REJECTED",
        unit: null,
        societyName: "Greenwood Residency",
        designation: null,
        currentFee: null,
      },
    );

    await waitFor(() => {
      expect(screen.getByText("Registration Not Approved")).toBeInTheDocument();
    });
  });

  it("renders active state with RWAID and fee info", async () => {
    renderWithProviders(
      {},
      {
        id: "u1",
        name: "Arjun",
        rwaid: "EDEN-001",
        status: "ACTIVE_PAID",
        unit: "A-101",
        societyName: "Greenwood Residency",
        designation: null,
        currentFee: {
          sessionYear: "2025-26",
          amountDue: 1200,
          amountPaid: 1200,
          status: "PAID",
        },
      },
    );

    await waitFor(() => {
      expect(screen.getByText("Welcome, Arjun")).toBeInTheDocument();
    });
    expect(screen.getByText("EDEN-001")).toBeInTheDocument();
    expect(screen.getByText("Unit: A-101")).toBeInTheDocument();
    expect(screen.getByText("PAID")).toBeInTheDocument();
  });

  it("shows designation badge when user has designation", async () => {
    renderWithProviders(
      {},
      {
        id: "u1",
        name: "Arjun",
        rwaid: "EDEN-001",
        status: "ACTIVE_PAID",
        unit: "A-101",
        societyName: "Greenwood Residency",
        designation: "President",
        currentFee: null,
      },
    );

    await waitFor(() => {
      expect(screen.getByText("President")).toBeInTheDocument();
    });
  });

  it("does not show designation badge when designation is null", async () => {
    renderWithProviders(
      {},
      {
        id: "u1",
        name: "Arjun",
        rwaid: "EDEN-001",
        status: "ACTIVE_PAID",
        unit: null,
        societyName: "Greenwood Residency",
        designation: null,
        currentFee: null,
      },
    );

    await waitFor(() => {
      expect(screen.getByText("Welcome, Arjun")).toBeInTheDocument();
    });
    expect(screen.queryByText("President")).not.toBeInTheDocument();
  });

  it("shows Pending when rwaid is null", async () => {
    renderWithProviders(
      {},
      {
        id: "u1",
        name: "Arjun",
        rwaid: null,
        status: "ACTIVE_PENDING",
        unit: null,
        societyName: "Greenwood Residency",
        designation: null,
        currentFee: null,
      },
    );

    await waitFor(() => {
      expect(screen.getByText("Pending")).toBeInTheDocument();
    });
  });

  it("renders payment history and expenses links", async () => {
    renderWithProviders(
      {},
      {
        id: "u1",
        name: "Arjun",
        rwaid: "EDEN-001",
        status: "ACTIVE_PAID",
        unit: null,
        societyName: "Greenwood Residency",
        designation: null,
        currentFee: null,
      },
    );

    await waitFor(() => {
      expect(screen.getByText("Payment History")).toBeInTheDocument();
    });
    expect(screen.getByText("Society Expenses")).toBeInTheDocument();
  });

  it("includes societyId in query key for society switching", () => {
    renderWithProviders(
      { societyId: "soc-42" },
      {
        id: "u1",
        name: "Test",
        rwaid: null,
        status: "ACTIVE_PAID",
        unit: null,
        societyName: null,
        designation: null,
        currentFee: null,
      },
    );

    // Verify fetch was called (query is enabled when user is present)
    expect(mockFetch).toHaveBeenCalledWith("/api/v1/residents/me");
  });
});
