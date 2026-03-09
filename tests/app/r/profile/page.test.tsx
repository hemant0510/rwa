import React from "react";

import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockFetch } = vi.hoisted(() => ({
  mockFetch: vi.fn(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/r/profile",
}));

global.fetch = mockFetch;

import ResidentProfilePage from "@/app/r/profile/page";
import { AuthContext } from "@/hooks/useAuth";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

function renderWithProviders(fetchResponse: Record<string, unknown> | null = null) {
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
      societyName: "Eden Estate",
      societyCode: "EDEN",
      societyStatus: "ACTIVE",
      trialEndsAt: null,
      isTrialExpired: false,
      multiSociety: false,
      societies: null,
    },
    isLoading: false,
    isAuthenticated: true,
    signOut: vi.fn(),
    switchSociety: vi.fn(),
  };

  return render(
    <QueryClientProvider client={queryClient}>
      <AuthContext.Provider value={value}>
        <ResidentProfilePage />
      </AuthContext.Provider>
    </QueryClientProvider>,
  );
}

const profileData = {
  id: "u1",
  name: "Hemant Bhagat",
  email: "hemant@example.com",
  mobile: "9876543210",
  rwaid: "EDEN-001",
  status: "ACTIVE_PAID",
  ownershipType: "OWNER",
  societyName: "Eden Estate",
  unit: "A-101",
  designation: null as string | null,
};

describe("ResidentProfilePage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders profile heading", async () => {
    renderWithProviders(profileData);
    await waitFor(() => {
      expect(screen.getByText("My Profile")).toBeInTheDocument();
    });
  });

  it("renders user name", async () => {
    renderWithProviders(profileData);
    await waitFor(() => {
      expect(screen.getByText("Hemant Bhagat")).toBeInTheDocument();
    });
  });

  it("renders RWAID", async () => {
    renderWithProviders(profileData);
    await waitFor(() => {
      expect(screen.getByText("EDEN-001")).toBeInTheDocument();
    });
  });

  it("renders phone number", async () => {
    renderWithProviders(profileData);
    await waitFor(() => {
      expect(screen.getByText("+91 9876543210")).toBeInTheDocument();
    });
  });

  it("renders email", async () => {
    renderWithProviders(profileData);
    await waitFor(() => {
      expect(screen.getByText("hemant@example.com")).toBeInTheDocument();
    });
  });

  it("renders unit and society name", async () => {
    renderWithProviders(profileData);
    await waitFor(() => {
      expect(screen.getByText("A-101 — Eden Estate")).toBeInTheDocument();
    });
  });

  it("renders ownership type", async () => {
    renderWithProviders(profileData);
    await waitFor(() => {
      expect(screen.getByText("OWNER")).toBeInTheDocument();
    });
  });

  it("renders account status badge", async () => {
    renderWithProviders(profileData);
    await waitFor(() => {
      expect(screen.getByText("Account Status")).toBeInTheDocument();
    });
  });

  it("shows designation when user has one", async () => {
    renderWithProviders({ ...profileData, designation: "President" });
    await waitFor(() => {
      expect(screen.getByText("President")).toBeInTheDocument();
    });
  });

  it("does not show designation when null", async () => {
    renderWithProviders(profileData);
    await waitFor(() => {
      expect(screen.getByText("Hemant Bhagat")).toBeInTheDocument();
    });
    expect(screen.queryByText("President")).not.toBeInTheDocument();
  });

  it("shows unable to load message on null profile", async () => {
    mockFetch.mockResolvedValue({ ok: false });
    renderWithProviders(null);
    // The query will fail, profile will be undefined
    await waitFor(() => {
      expect(screen.getByText("Unable to load profile.")).toBeInTheDocument();
    });
  });

  it("does not have sign out button", async () => {
    renderWithProviders(profileData);
    await waitFor(() => {
      expect(screen.getByText("Hemant Bhagat")).toBeInTheDocument();
    });
    expect(screen.queryByRole("button", { name: /sign out/i })).not.toBeInTheDocument();
  });
});
