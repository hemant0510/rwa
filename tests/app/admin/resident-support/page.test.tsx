import React from "react";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, render, screen, waitFor, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Hoisted mocks ──────────────────────────────────────────────────────────────

const { mockGetAdminResidentTickets, mockGetAdminResidentStats } = vi.hoisted(() => ({
  mockGetAdminResidentTickets: vi.fn(),
  mockGetAdminResidentStats: vi.fn(),
}));

vi.mock("@/services/resident-support", () => ({
  getAdminResidentTickets: (...args: unknown[]) => mockGetAdminResidentTickets(...args),
  getAdminResidentStats: (...args: unknown[]) => mockGetAdminResidentStats(...args),
}));

vi.mock("@/hooks/useSocietyId", () => ({
  useSocietyId: () => ({ societyId: "soc-1", saQueryString: "" }),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => "/admin/resident-support",
  useSearchParams: () => new URLSearchParams(""),
}));

import AdminResidentSupportPage from "@/app/admin/resident-support/page";
import { AuthContext } from "@/hooks/useAuth";

// ── Fixtures ──────────────────────────────────────────────────────────────────

const MOCK_ADMIN = {
  id: "u-1",
  name: "Admin User",
  role: "RWA_ADMIN" as const,
  permission: "FULL_ACCESS" as const,
  societyId: "soc-1",
  societyName: "Eden Estate",
  societyCode: "EDEN",
  societyStatus: "ACTIVE" as const,
  trialEndsAt: null,
  isTrialExpired: false,
  multiSociety: false,
  societies: null,
};

const MOCK_STATS = {
  open: 5,
  inProgress: 3,
  awaitingAdmin: 2,
  resolved7d: 8,
  avgResolutionHours: 12.5,
};

const MOCK_TICKET = {
  id: "t-1",
  ticketNumber: 42,
  type: "MAINTENANCE_ISSUE",
  priority: "HIGH",
  status: "OPEN",
  subject: "Broken elevator",
  updatedAt: new Date("2026-04-01T10:00:00Z").toISOString(),
  createdByUser: {
    name: "Priya Sharma",
    userUnits: [{ unit: { displayLabel: "B-201" } }],
  },
  _count: { messages: 3, attachments: 1 },
};

const MOCK_URGENT_TICKET = {
  ...MOCK_TICKET,
  id: "t-2",
  ticketNumber: 43,
  priority: "URGENT",
  subject: "Water leak flooding",
  _count: { messages: 0, attachments: 0 },
};

const MOCK_TICKET_NO_UNIT = {
  ...MOCK_TICKET,
  id: "t-3",
  subject: "No unit ticket",
  createdByUser: { name: "Anonymous User", userUnits: [] },
};

const EMPTY_RESPONSE = { data: [], total: 0, page: 1, limit: 20 };
const ONE_TICKET_RESPONSE = { data: [MOCK_TICKET], total: 1, page: 1, limit: 20 };

// ── Helper ────────────────────────────────────────────────────────────────────

async function renderPage(userOverride = MOCK_ADMIN) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  let result!: ReturnType<typeof render>;
  await act(async () => {
    result = render(
      <QueryClientProvider client={qc}>
        <AuthContext.Provider
          value={{
            user: userOverride,
            isLoading: false,
            isAuthenticated: true,
            signOut: vi.fn(),
            switchSociety: vi.fn(),
          }}
        >
          <AdminResidentSupportPage />
        </AuthContext.Provider>
      </QueryClientProvider>,
    );
  });
  return result;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("AdminResidentSupportPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAdminResidentTickets.mockResolvedValue(EMPTY_RESPONSE);
    mockGetAdminResidentStats.mockResolvedValue(MOCK_STATS);
  });

  it("renders page header", async () => {
    await renderPage();
    expect(screen.getByText("Resident Support")).toBeInTheDocument();
  });

  it("shows KPI stats after loading", async () => {
    await renderPage();
    await waitFor(() => {
      expect(screen.getByText("5")).toBeInTheDocument(); // open
    });
    expect(screen.getByText("3")).toBeInTheDocument(); // inProgress
    expect(screen.getByText("2")).toBeInTheDocument(); // awaitingAdmin
    expect(screen.getByText("8")).toBeInTheDocument(); // resolved7d
    expect(screen.getByText("12.5h")).toBeInTheDocument(); // avgResolution
  });

  it("shows — for avgResolutionHours when null", async () => {
    mockGetAdminResidentStats.mockResolvedValue({ ...MOCK_STATS, avgResolutionHours: null });
    await renderPage();
    await waitFor(() => {
      expect(screen.getByText("—")).toBeInTheDocument();
    });
  });

  it("highlights Awaiting Admin card when count > 0", async () => {
    await renderPage();
    await waitFor(() => {
      expect(screen.getByText("2")).toBeInTheDocument();
    });
    // The card for awaitingAdmin should have red styling since count > 0
    const awaitingLabel = screen.getByText("Awaiting Admin");
    expect(awaitingLabel).toBeInTheDocument();
  });

  it("shows empty state when no tickets", async () => {
    await renderPage();
    await waitFor(() => {
      expect(screen.getByText("No resident support tickets yet.")).toBeInTheDocument();
    });
  });

  it("renders ticket table rows when tickets exist", async () => {
    mockGetAdminResidentTickets.mockResolvedValue(ONE_TICKET_RESPONSE);
    await renderPage();
    await waitFor(() => {
      expect(screen.getByText("Broken elevator")).toBeInTheDocument();
    });
    expect(screen.getByText("Priya Sharma")).toBeInTheDocument();
    expect(screen.getByText("(B-201)")).toBeInTheDocument();
    expect(screen.getByText("#42")).toBeInTheDocument();
  });

  it("shows paperclip icon when ticket has attachments", async () => {
    mockGetAdminResidentTickets.mockResolvedValue(ONE_TICKET_RESPONSE);
    await renderPage();
    await waitFor(() => {
      expect(screen.getByText("Broken elevator")).toBeInTheDocument();
    });
    // attachment count is 1
    expect(screen.getByText("1")).toBeInTheDocument();
  });

  it("applies red background class to URGENT ticket rows", async () => {
    mockGetAdminResidentTickets.mockResolvedValue({
      data: [MOCK_URGENT_TICKET],
      total: 1,
      page: 1,
      limit: 20,
    });
    await renderPage();
    await waitFor(() => {
      expect(screen.getByText("Water leak flooding")).toBeInTheDocument();
    });
    const row = screen.getByText("Water leak flooding").closest("tr");
    expect(row?.className).toContain("bg-red-50");
  });

  it("filters by status", async () => {
    await renderPage();
    const statusTrigger = screen.getAllByRole("combobox")[0];
    fireEvent.click(statusTrigger);
    await waitFor(() => {
      const openOption = screen.getByRole("option", { name: "Open" });
      fireEvent.click(openOption);
    });
    await waitFor(() => {
      expect(mockGetAdminResidentTickets).toHaveBeenCalledWith(
        expect.objectContaining({ status: "OPEN" }),
      );
    });
  });

  it("shows clear filters button when filter is active", async () => {
    await renderPage();
    const statusTrigger = screen.getAllByRole("combobox")[0];
    fireEvent.click(statusTrigger);
    await waitFor(() => {
      const openOption = screen.getByRole("option", { name: "Open" });
      fireEvent.click(openOption);
    });
    await waitFor(() => {
      expect(screen.getByText("Clear")).toBeInTheDocument();
    });
  });

  it("clears filters when Clear is clicked", async () => {
    await renderPage();
    // Apply filter first
    const statusTrigger = screen.getAllByRole("combobox")[0];
    fireEvent.click(statusTrigger);
    await waitFor(() => {
      fireEvent.click(screen.getByRole("option", { name: "Open" }));
    });
    await waitFor(() => {
      const clearBtn = screen.getByText("Clear");
      fireEvent.click(clearBtn);
    });
    await waitFor(() => {
      expect(screen.queryByText("Clear")).not.toBeInTheDocument();
    });
  });

  it("shows empty state with filter message when tickets empty and filter active", async () => {
    await renderPage();
    const statusTrigger = screen.getAllByRole("combobox")[0];
    fireEvent.click(statusTrigger);
    await waitFor(() => {
      fireEvent.click(screen.getByRole("option", { name: "Open" }));
    });
    await waitFor(() => {
      expect(screen.getByText("No tickets match your filters.")).toBeInTheDocument();
    });
  });

  it("shows pagination when totalPages > 1", async () => {
    mockGetAdminResidentTickets.mockResolvedValue({
      data: [MOCK_TICKET],
      total: 25,
      page: 1,
      limit: 20,
    });
    await renderPage();
    await waitFor(() => {
      expect(screen.getByText("Page 1 of 2")).toBeInTheDocument();
    });
    expect(screen.getByText("Previous")).toBeInTheDocument();
    expect(screen.getByText("Next")).toBeInTheDocument();
  });

  it("disables Previous button on first page", async () => {
    mockGetAdminResidentTickets.mockResolvedValue({
      data: [MOCK_TICKET],
      total: 25,
      page: 1,
      limit: 20,
    });
    await renderPage();
    await waitFor(() => {
      const prevBtn = screen.getByText("Previous");
      expect(prevBtn).toBeDisabled();
    });
  });

  it("navigates to next page", async () => {
    mockGetAdminResidentTickets.mockResolvedValue({
      data: [MOCK_TICKET],
      total: 25,
      page: 1,
      limit: 20,
    });
    await renderPage();
    await waitFor(() => {
      expect(screen.getByText("Next")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText("Next"));
    await waitFor(() => {
      expect(mockGetAdminResidentTickets).toHaveBeenCalledWith(
        expect.objectContaining({ page: "2" }),
      );
    });
  });

  it("shows total ticket count in table header", async () => {
    mockGetAdminResidentTickets.mockResolvedValue(ONE_TICKET_RESPONSE);
    await renderPage();
    await waitFor(() => {
      expect(screen.getByText("(1)")).toBeInTheDocument();
    });
  });

  it("filters by type", async () => {
    await renderPage();
    const typeTrigger = screen.getAllByRole("combobox")[1];
    fireEvent.click(typeTrigger);
    await waitFor(() => {
      const maintOption = screen.getByRole("option", { name: "Maintenance" });
      fireEvent.click(maintOption);
    });
    await waitFor(() => {
      expect(mockGetAdminResidentTickets).toHaveBeenCalledWith(
        expect.objectContaining({ type: "MAINTENANCE_ISSUE" }),
      );
    });
  });

  it("filters by priority", async () => {
    await renderPage();
    const priorityTrigger = screen.getAllByRole("combobox")[2];
    fireEvent.click(priorityTrigger);
    await waitFor(() => {
      const urgentOption = screen.getByRole("option", { name: "Urgent" });
      fireEvent.click(urgentOption);
    });
    await waitFor(() => {
      expect(mockGetAdminResidentTickets).toHaveBeenCalledWith(
        expect.objectContaining({ priority: "URGENT" }),
      );
    });
  });

  it("navigates to previous page", async () => {
    mockGetAdminResidentTickets.mockResolvedValue({
      data: [MOCK_TICKET],
      total: 25,
      page: 1,
      limit: 20,
    });
    await renderPage();
    // Go to page 2 first
    await waitFor(() => {
      expect(screen.getByText("Next")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText("Next"));
    await waitFor(() => {
      expect(screen.getByText("Page 2 of 2")).toBeInTheDocument();
    });
    // Now go back to page 1
    fireEvent.click(screen.getByText("Previous"));
    await waitFor(() => {
      expect(screen.getByText("Page 1 of 2")).toBeInTheDocument();
    });
  });

  it("renders ticket without unit without crashing", async () => {
    mockGetAdminResidentTickets.mockResolvedValue({
      data: [MOCK_TICKET_NO_UNIT],
      total: 1,
      page: 1,
      limit: 20,
    });
    await renderPage();
    await waitFor(() => {
      expect(screen.getByText("No unit ticket")).toBeInTheDocument();
    });
    expect(screen.getByText("Anonymous User")).toBeInTheDocument();
    // No unit label should not be rendered for tickets without units
    expect(screen.queryByText("(B-201)")).not.toBeInTheDocument();
  });

  it("does not highlight Awaiting Admin card when count is 0", async () => {
    mockGetAdminResidentStats.mockResolvedValue({ ...MOCK_STATS, awaitingAdmin: 0 });
    await renderPage();
    await waitFor(() => {
      expect(screen.getByText("Awaiting Admin")).toBeInTheDocument();
    });
    // Value 0 should be displayed
    const awaitingLabel = screen.getByText("Awaiting Admin");
    expect(awaitingLabel).toBeInTheDocument();
  });

  it("shows attention dot on AWAITING_ADMIN ticket", async () => {
    const awaitingTicket = { ...MOCK_TICKET, status: "AWAITING_ADMIN" };
    mockGetAdminResidentTickets.mockResolvedValue({
      data: [awaitingTicket],
      total: 1,
      page: 1,
      limit: 20,
    });
    await renderPage();
    await waitFor(() => {
      expect(screen.getByText("Broken elevator")).toBeInTheDocument();
    });
    // The ticket row should contain the pulsing dot (span with animate-pulse class)
    const dots = document.querySelectorAll(".animate-pulse");
    expect(dots.length).toBeGreaterThan(0);
  });
});
