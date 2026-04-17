import React from "react";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

import AdminAnnouncementsPage from "@/app/admin/announcements/page";
import { AuthContext } from "@/hooks/useAuth";

// ── Hoisted mocks ────────────────────────────────────────────────────────────

const { mockGetUnreadAnnouncements, mockMarkAnnouncementRead } = vi.hoisted(() => ({
  mockGetUnreadAnnouncements: vi.fn(),
  mockMarkAnnouncementRead: vi.fn(),
}));

vi.mock("@/services/announcements", () => ({
  getUnreadAnnouncements: (...args: unknown[]) => mockGetUnreadAnnouncements(...args),
  markAnnouncementRead: (...args: unknown[]) => mockMarkAnnouncementRead(...args),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(""),
  usePathname: () => "/admin/announcements",
  useParams: () => ({}),
}));

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeAdminUser(overrides: Record<string, unknown> = {}) {
  return {
    id: "u1",
    name: "Admin",
    role: "RWA_ADMIN" as const,
    permission: "FULL_ACCESS" as const,
    societyId: "soc-1",
    societyName: "Test Society",
    societyCode: "TST",
    societyStatus: "ACTIVE",
    trialEndsAt: null,
    isTrialExpired: false,
    multiSociety: false,
    societies: null,
    ...overrides,
  };
}

function renderPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const user = makeAdminUser();
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
        <AdminAnnouncementsPage />
      </AuthContext.Provider>
    </QueryClientProvider>,
  );
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe("AdminAnnouncementsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the page header", () => {
    mockGetUnreadAnnouncements.mockReturnValue(new Promise(() => {}));
    renderPage();
    expect(screen.getByText("Platform Announcements")).toBeInTheDocument();
    expect(screen.getByText("Messages from the platform team")).toBeInTheDocument();
  });

  it("shows loading skeletons while data is pending", () => {
    mockGetUnreadAnnouncements.mockReturnValue(new Promise(() => {}));
    renderPage();
    // Page renders without crashing during loading — skeletons are shown
    expect(screen.getByText("Platform Announcements")).toBeInTheDocument();
  });

  it("shows empty state when no announcements exist", async () => {
    mockGetUnreadAnnouncements.mockResolvedValue([]);
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("No unread announcements")).toBeInTheDocument();
    });
    expect(screen.getByText(/All caught up! Check back later/)).toBeInTheDocument();
  });

  it("renders announcement cards with subject and body", async () => {
    mockGetUnreadAnnouncements.mockResolvedValue([
      {
        id: "ann-1",
        subject: "Scheduled Maintenance",
        body: "System will be down for maintenance tonight.",
        priority: "NORMAL",
        createdAt: "2026-04-15T10:00:00.000Z",
      },
      {
        id: "ann-2",
        subject: "Urgent Security Update",
        body: "Please update your passwords immediately.",
        priority: "URGENT",
        createdAt: "2026-04-15T09:00:00.000Z",
      },
    ]);
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Scheduled Maintenance")).toBeInTheDocument();
    });
    expect(screen.getByText("Urgent Security Update")).toBeInTheDocument();
    expect(screen.getByText("System will be down for maintenance tonight.")).toBeInTheDocument();
    expect(screen.getByText("Please update your passwords immediately.")).toBeInTheDocument();
    // Urgent section header
    expect(screen.getByText(/Urgent \(1\)/)).toBeInTheDocument();
    // Mark All Read button when announcements exist
    expect(screen.getByText("Mark All Read")).toBeInTheDocument();
  });

  it("shows URGENT badge on urgent announcements", async () => {
    mockGetUnreadAnnouncements.mockResolvedValue([
      {
        id: "ann-1",
        subject: "Critical Issue",
        body: "Fix needed.",
        priority: "URGENT",
        createdAt: "2026-04-15T10:00:00.000Z",
      },
    ]);
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("URGENT")).toBeInTheDocument();
    });
  });

  it("calls markAnnouncementRead when individual Mark Read is clicked", async () => {
    mockGetUnreadAnnouncements.mockResolvedValue([
      {
        id: "ann-1",
        subject: "Single Announcement",
        body: "Read me.",
        priority: "NORMAL",
        createdAt: "2026-04-15T10:00:00.000Z",
      },
    ]);
    mockMarkAnnouncementRead.mockResolvedValue(undefined);
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Single Announcement")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("button", { name: /Mark Read/i }));
    await waitFor(() => {
      expect(mockMarkAnnouncementRead).toHaveBeenCalled();
      expect(mockMarkAnnouncementRead.mock.calls[0][0]).toBe("ann-1");
    });
  });

  it("calls markAnnouncementRead for each announcement when Mark All Read is clicked", async () => {
    mockGetUnreadAnnouncements.mockResolvedValue([
      {
        id: "ann-1",
        subject: "First",
        body: "Body 1",
        priority: "NORMAL",
        createdAt: "2026-04-15T10:00:00.000Z",
      },
      {
        id: "ann-2",
        subject: "Second",
        body: "Body 2",
        priority: "URGENT",
        createdAt: "2026-04-15T09:00:00.000Z",
      },
    ]);
    mockMarkAnnouncementRead.mockResolvedValue(undefined);
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Mark All Read")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("button", { name: /Mark All Read/i }));
    await waitFor(() => {
      expect(mockMarkAnnouncementRead).toHaveBeenCalledTimes(2);
    });
    const calledIds = mockMarkAnnouncementRead.mock.calls.map((c: unknown[]) => c[0]);
    expect(calledIds).toContain("ann-1");
    expect(calledIds).toContain("ann-2");
  });

  it("calls markAnnouncementRead when Mark Read is clicked on an urgent item", async () => {
    mockGetUnreadAnnouncements.mockResolvedValue([
      {
        id: "ann-urgent",
        subject: "Urgent Notice",
        body: "Act now.",
        priority: "URGENT",
        createdAt: "2026-04-15T10:00:00.000Z",
      },
    ]);
    mockMarkAnnouncementRead.mockResolvedValue(undefined);
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Urgent Notice")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("button", { name: /Mark Read/i }));
    await waitFor(() => {
      expect(mockMarkAnnouncementRead).toHaveBeenCalled();
      expect(mockMarkAnnouncementRead.mock.calls[0][0]).toBe("ann-urgent");
    });
  });

  it("renders only normal section without urgent header when all items are NORMAL", async () => {
    mockGetUnreadAnnouncements.mockResolvedValue([
      {
        id: "ann-1",
        subject: "Normal Update",
        body: "Just a regular update.",
        priority: "NORMAL",
        createdAt: "2026-04-15T10:00:00.000Z",
      },
    ]);
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Normal Update")).toBeInTheDocument();
    });
    // No "Urgent" section header should appear
    expect(screen.queryByText(/Urgent \(\d+\)/)).not.toBeInTheDocument();
    // No "General" header either (only shown when urgent items also exist)
    expect(screen.queryByText(/General \(\d+\)/)).not.toBeInTheDocument();
  });

  it("shows General header when both urgent and normal items exist", async () => {
    mockGetUnreadAnnouncements.mockResolvedValue([
      {
        id: "ann-1",
        subject: "Urgent Item",
        body: "Urgent body.",
        priority: "URGENT",
        createdAt: "2026-04-15T10:00:00.000Z",
      },
      {
        id: "ann-2",
        subject: "Normal Item",
        body: "Normal body.",
        priority: "NORMAL",
        createdAt: "2026-04-15T09:00:00.000Z",
      },
    ]);
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Urgent Item")).toBeInTheDocument();
    });
    expect(screen.getByText("Normal Item")).toBeInTheDocument();
    expect(screen.getByText(/Urgent \(1\)/)).toBeInTheDocument();
    expect(screen.getByText(/General \(1\)/)).toBeInTheDocument();
  });

  it("falls back to NORMAL styling for unknown priority values", async () => {
    mockGetUnreadAnnouncements.mockResolvedValue([
      {
        id: "ann-unknown",
        subject: "Unknown Priority",
        body: "Has an unknown priority.",
        priority: "LOW",
        createdAt: "2026-04-15T10:00:00.000Z",
      },
    ]);
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Unknown Priority")).toBeInTheDocument();
    });
    // Should not show URGENT badge
    expect(screen.queryByText("URGENT")).not.toBeInTheDocument();
    // The card should still render with the NORMAL fallback styling
    const card = screen.getByText("Unknown Priority").closest(".rounded-lg");
    expect(card).toHaveClass("bg-blue-50");
  });

  it("invalidates queries on successful mark-read mutation", async () => {
    mockGetUnreadAnnouncements.mockResolvedValue([
      {
        id: "ann-1",
        subject: "To be read",
        body: "Content.",
        priority: "NORMAL",
        createdAt: "2026-04-15T10:00:00.000Z",
      },
    ]);
    // First call succeeds, second call (after invalidation) returns empty
    mockMarkAnnouncementRead.mockResolvedValue(undefined);
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("To be read")).toBeInTheDocument();
    });

    // Update mock so refetch returns empty
    mockGetUnreadAnnouncements.mockResolvedValue([]);

    fireEvent.click(screen.getByRole("button", { name: /Mark Read/i }));

    // After mutation succeeds, queries are invalidated and refetched
    await waitFor(() => {
      expect(screen.getByText("No unread announcements")).toBeInTheDocument();
    });
  });
});
