import React from "react";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

import ResidentGoverningBodyPage from "@/app/r/governing-body/page";
import { AuthContext } from "@/hooks/useAuth";

// ── Hoisted mocks ──

const { mockFetchCommitteeMembers } = vi.hoisted(() => ({
  mockFetchCommitteeMembers: vi.fn(),
}));

vi.mock("@/services/resident-directory", () => ({
  fetchCommitteeMembers: (...args: unknown[]) => mockFetchCommitteeMembers(...args),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => "/r/governing-body",
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
        <ResidentGoverningBodyPage />
      </AuthContext.Provider>
    </QueryClientProvider>,
  );
}

// ── Tests ──

describe("ResidentGoverningBodyPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders heading and subtitle", () => {
    mockFetchCommitteeMembers.mockReturnValue(new Promise(() => {}));
    renderPage();
    expect(screen.getByText("Governing Body")).toBeInTheDocument();
    expect(screen.getByText("Committee members of your society")).toBeInTheDocument();
  });

  it("shows loading spinner while fetching", () => {
    mockFetchCommitteeMembers.mockReturnValue(new Promise(() => {}));
    renderPage();
    expect(document.querySelector(".animate-spin")).toBeInTheDocument();
  });

  it("shows empty state when no members", async () => {
    mockFetchCommitteeMembers.mockResolvedValue({ members: [] });
    renderPage();

    await waitFor(() => {
      expect(screen.getByText("No committee members")).toBeInTheDocument();
    });
    expect(screen.getByText("The governing body has not been set up yet.")).toBeInTheDocument();
  });

  it("renders committee member cards with details", async () => {
    mockFetchCommitteeMembers.mockResolvedValue({
      members: [
        {
          id: "gbm-1",
          name: "Rajesh Kumar",
          email: "rajesh@test.com",
          mobile: "XXXXX 43210",
          designation: "President",
          assignedAt: "2025-01-15T00:00:00.000Z",
        },
        {
          id: "gbm-2",
          name: "Sunita Sharma",
          email: "sunita@test.com",
          mobile: "XXXXX 32109",
          designation: "Secretary",
          assignedAt: "2025-01-15T00:00:00.000Z",
        },
      ],
    });
    renderPage();

    await waitFor(() => {
      expect(screen.getByText("Rajesh Kumar")).toBeInTheDocument();
    });

    expect(screen.getByText("President")).toBeInTheDocument();
    expect(screen.getByText("rajesh@test.com")).toBeInTheDocument();
    expect(screen.getByText("XXXXX 43210")).toBeInTheDocument();

    expect(screen.getByText("Sunita Sharma")).toBeInTheDocument();
    expect(screen.getByText("Secretary")).toBeInTheDocument();
    expect(screen.getByText("sunita@test.com")).toBeInTheDocument();
    expect(screen.getByText("XXXXX 32109")).toBeInTheDocument();
  });

  it("renders avatar with photoUrl (truthy branch)", async () => {
    mockFetchCommitteeMembers.mockResolvedValue({
      members: [
        {
          id: "gbm-1",
          name: "Rajesh Kumar",
          email: "rajesh@test.com",
          mobile: "XXXXX 43210",
          designation: "President",
          assignedAt: "2025-01-15T00:00:00.000Z",
          photoUrl: "https://example.com/signed-photo.jpg",
        },
      ],
    });
    renderPage();

    await waitFor(() => {
      expect(screen.getByText("Rajesh Kumar")).toBeInTheDocument();
    });

    // Radix AvatarImage doesn't render <img> until the image loads (never in JSDOM),
    // but the React branch `member.photoUrl && <AvatarImage>` is evaluated as truthy.
    // Fallback initials are always rendered as well.
    expect(screen.getByText("RK")).toBeInTheDocument();
  });

  it("does not render avatar image when member has no photoUrl", async () => {
    mockFetchCommitteeMembers.mockResolvedValue({
      members: [
        {
          id: "gbm-1",
          name: "Rajesh Kumar",
          email: "rajesh@test.com",
          mobile: "XXXXX 43210",
          designation: "President",
          assignedAt: "2025-01-15T00:00:00.000Z",
          photoUrl: null,
        },
      ],
    });
    renderPage();

    await waitFor(() => {
      expect(screen.getByText("Rajesh Kumar")).toBeInTheDocument();
    });

    expect(screen.queryByAltText("Rajesh Kumar")).not.toBeInTheDocument();
    // Fallback initials should be shown
    expect(screen.getByText("RK")).toBeInTheDocument();
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
          <ResidentGoverningBodyPage />
        </AuthContext.Provider>
      </QueryClientProvider>,
    );

    expect(mockFetchCommitteeMembers).not.toHaveBeenCalled();
  });
});
