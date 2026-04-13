import React from "react";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";

import ResidentDirectoryPage from "@/app/r/directory/page";
import { AuthContext } from "@/hooks/useAuth";

// ── Hoisted mocks ──

const { mockFetchResidentDirectory, mockSearchVehicles } = vi.hoisted(() => ({
  mockFetchResidentDirectory: vi.fn(),
  mockSearchVehicles: vi.fn(),
}));

vi.mock("@/services/resident-directory", () => ({
  fetchResidentDirectory: (...args: unknown[]) => mockFetchResidentDirectory(...args),
}));

vi.mock("@/services/vehicles", () => ({
  searchVehicles: mockSearchVehicles,
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => "/r/directory",
}));

// ── Helpers ──

function renderPage(userOverrides: Record<string, unknown> = {}) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const user = {
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
    ...userOverrides,
  };
  return render(
    <QueryClientProvider client={queryClient}>
      <AuthContext.Provider
        value={{
          user,
          isLoading: false,
          isAuthenticated: true,
          signOut: vi.fn(),
          switchSociety: vi.fn(),
        }}
      >
        <ResidentDirectoryPage />
      </AuthContext.Provider>
    </QueryClientProvider>,
  );
}

const EMPTY_RESPONSE = { residents: [], total: 0, page: 1, limit: 20 };

// ── Tests ──

describe("ResidentDirectoryPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders heading and search input", () => {
    mockFetchResidentDirectory.mockReturnValue(new Promise(() => {}));
    renderPage();
    expect(screen.getByText("Resident Directory")).toBeInTheDocument();
    expect(screen.getByText("Members of your society")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Search by name or email...")).toBeInTheDocument();
  });

  it("shows loading spinner while fetching", () => {
    mockFetchResidentDirectory.mockReturnValue(new Promise(() => {}));
    renderPage();
    expect(document.querySelector(".animate-spin")).toBeInTheDocument();
  });

  it("shows empty state when no residents", async () => {
    mockFetchResidentDirectory.mockResolvedValue(EMPTY_RESPONSE);
    renderPage();

    await waitFor(() => {
      expect(screen.getByText("No residents found")).toBeInTheDocument();
    });
    expect(screen.getByText("No other residents in your society yet.")).toBeInTheDocument();
  });

  it("shows search-specific empty message when search active", async () => {
    mockFetchResidentDirectory.mockResolvedValue(EMPTY_RESPONSE);
    renderPage();

    await waitFor(() => {
      expect(screen.getByText("No residents found")).toBeInTheDocument();
    });

    // Type a search term
    const input = screen.getByPlaceholderText("Search by name or email...");
    await userEvent.type(input, "xyz");

    await waitFor(() => {
      expect(screen.getByText("Try a different search term.")).toBeInTheDocument();
    });
  });

  it("renders resident cards with details", async () => {
    mockFetchResidentDirectory.mockResolvedValue({
      residents: [
        {
          id: "u2",
          name: "Anita Patel",
          email: "anita@test.com",
          mobile: "XXXXX 43210",
          ownershipType: "OWNER",
          unit: "A-101",
        },
        {
          id: "u3",
          name: "Vikram Singh",
          email: "vikram@test.com",
          mobile: "XXXXX 32109",
          ownershipType: "TENANT",
          unit: null,
        },
      ],
      total: 2,
      page: 1,
      limit: 20,
    });
    renderPage();

    await waitFor(() => {
      expect(screen.getByText("Anita Patel")).toBeInTheDocument();
    });

    expect(screen.getByText("anita@test.com")).toBeInTheDocument();
    expect(screen.getByText("XXXXX 43210")).toBeInTheDocument();
    expect(screen.getByText("Owner")).toBeInTheDocument();
    expect(screen.getByText("A-101")).toBeInTheDocument();

    expect(screen.getByText("Vikram Singh")).toBeInTheDocument();
    expect(screen.getByText("Tenant")).toBeInTheDocument();
    expect(screen.getByText("2 residents")).toBeInTheDocument();

    // Avatar initials
    expect(screen.getByText("AP")).toBeInTheDocument();
    expect(screen.getByText("VS")).toBeInTheDocument();
  });

  it("renders resident without ownershipType or unit", async () => {
    mockFetchResidentDirectory.mockResolvedValue({
      residents: [
        {
          id: "u2",
          name: "No Details",
          email: "nodetails@test.com",
          mobile: "—",
          ownershipType: null,
          unit: null,
        },
      ],
      total: 1,
      page: 1,
      limit: 20,
    });
    renderPage();

    await waitFor(() => {
      expect(screen.getByText("No Details")).toBeInTheDocument();
    });
    // Avatar initials for two-word name
    expect(screen.getByText("ND")).toBeInTheDocument();
    // No ownership badge should render
    expect(screen.queryByText("Owner")).not.toBeInTheDocument();
    expect(screen.queryByText("Tenant")).not.toBeInTheDocument();
    // Single resident shows singular label
    expect(screen.getByText("1 resident")).toBeInTheDocument();
  });

  it("shows pagination when multiple pages", async () => {
    mockFetchResidentDirectory.mockResolvedValue({
      residents: [
        {
          id: "u2",
          name: "User 1",
          email: "u1@test.com",
          mobile: "—",
          ownershipType: "OWNER",
          unit: "A-1",
        },
      ],
      total: 50,
      page: 1,
      limit: 20,
    });
    renderPage();

    await waitFor(() => {
      expect(screen.getByText("Page 1 of 3")).toBeInTheDocument();
    });
    expect(screen.getByText("Previous")).toBeDisabled();
    expect(screen.getByText("Next")).not.toBeDisabled();
  });

  it("navigates to next page", async () => {
    mockFetchResidentDirectory.mockResolvedValue({
      residents: [
        {
          id: "u2",
          name: "User 1",
          email: "u@t.com",
          mobile: "—",
          ownershipType: null,
          unit: null,
        },
      ],
      total: 50,
      page: 1,
      limit: 20,
    });
    renderPage();

    await waitFor(() => {
      expect(screen.getByText("Page 1 of 3")).toBeInTheDocument();
    });

    await userEvent.click(screen.getByText("Next"));

    await waitFor(() => {
      expect(mockFetchResidentDirectory).toHaveBeenCalledWith(expect.objectContaining({ page: 2 }));
    });
  });

  it("navigates to previous page", async () => {
    // Start on page 2
    mockFetchResidentDirectory.mockResolvedValue({
      residents: [
        {
          id: "u2",
          name: "User 1",
          email: "u@t.com",
          mobile: "—",
          ownershipType: null,
          unit: null,
        },
      ],
      total: 50,
      page: 1,
      limit: 20,
    });
    renderPage();

    await waitFor(() => {
      expect(screen.getByText("Page 1 of 3")).toBeInTheDocument();
    });

    // Go to page 2 first
    await userEvent.click(screen.getByText("Next"));

    await waitFor(() => {
      expect(mockFetchResidentDirectory).toHaveBeenCalledWith(expect.objectContaining({ page: 2 }));
    });

    // Now click Previous
    await userEvent.click(screen.getByText("Previous"));

    await waitFor(() => {
      expect(mockFetchResidentDirectory).toHaveBeenCalledWith(expect.objectContaining({ page: 1 }));
    });
  });

  it("does not fetch when user is null", () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={queryClient}>
        <AuthContext.Provider
          value={{
            user: null,
            isLoading: true,
            isAuthenticated: false,
            signOut: vi.fn(),
            switchSociety: vi.fn(),
          }}
        >
          <ResidentDirectoryPage />
        </AuthContext.Provider>
      </QueryClientProvider>,
    );

    expect(mockFetchResidentDirectory).not.toHaveBeenCalled();
  });

  it("does not show pagination when single page", async () => {
    mockFetchResidentDirectory.mockResolvedValue({
      residents: [
        {
          id: "u2",
          name: "Solo",
          email: "s@t.com",
          mobile: "—",
          ownershipType: null,
          unit: null,
        },
      ],
      total: 1,
      page: 1,
      limit: 20,
    });
    renderPage();

    await waitFor(() => {
      expect(screen.getByText("Solo")).toBeInTheDocument();
    });
    expect(screen.queryByText("Previous")).not.toBeInTheDocument();
    expect(screen.queryByText("Next")).not.toBeInTheDocument();
  });

  it("renders unknown ownership type with fallback styling", async () => {
    mockFetchResidentDirectory.mockResolvedValue({
      residents: [
        {
          id: "u2",
          name: "Unknown Type",
          email: "u@t.com",
          mobile: "—",
          ownershipType: "SPECIAL",
          unit: null,
        },
      ],
      total: 1,
      page: 1,
      limit: 20,
    });
    renderPage();

    await waitFor(() => {
      expect(screen.getByText("SPECIAL")).toBeInTheDocument();
    });
  });

  it("renders OTHER ownership type label", async () => {
    mockFetchResidentDirectory.mockResolvedValue({
      residents: [
        {
          id: "u2",
          name: "Other Type",
          email: "o@t.com",
          mobile: "—",
          ownershipType: "OTHER",
          unit: null,
        },
      ],
      total: 1,
      page: 1,
      limit: 20,
    });
    renderPage();

    await waitFor(() => {
      expect(screen.getByText("Other")).toBeInTheDocument();
    });
  });

  it("renders opt-in banner explaining directory privacy", () => {
    mockFetchResidentDirectory.mockReturnValue(new Promise(() => {}));
    renderPage();
    expect(
      screen.getByText(/only residents who have opted in to the directory/i),
    ).toBeInTheDocument();
  });

  it("renders both People and Vehicles tabs", () => {
    mockFetchResidentDirectory.mockReturnValue(new Promise(() => {}));
    renderPage();
    expect(screen.getByRole("tab", { name: "People" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Vehicles" })).toBeInTheDocument();
  });

  it("switches to Vehicles tab and renders search input", async () => {
    mockFetchResidentDirectory.mockResolvedValue(EMPTY_RESPONSE);
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole("tab", { name: "Vehicles" }));
    await waitFor(() => {
      expect(screen.getByLabelText(/search vehicles/i)).toBeInTheDocument();
    });
  });

  it("people tab is active by default", () => {
    mockFetchResidentDirectory.mockReturnValue(new Promise(() => {}));
    renderPage();
    const peopleTab = screen.getByRole("tab", { name: "People" });
    expect(peopleTab).toHaveAttribute("data-state", "active");
  });
});
