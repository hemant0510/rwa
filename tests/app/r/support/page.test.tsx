import React from "react";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, fireEvent, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Hoisted mocks ────────────────────────────────────────────────────────────

const { mockGetResidentTickets, mockCreateResidentTicket, mockToastSuccess, mockToastError } =
  vi.hoisted(() => ({
    mockGetResidentTickets: vi.fn(),
    mockCreateResidentTicket: vi.fn(),
    mockToastSuccess: vi.fn(),
    mockToastError: vi.fn(),
  }));

vi.mock("@/services/resident-support", () => ({
  getResidentTickets: (...args: unknown[]) => mockGetResidentTickets(...args),
  createResidentTicket: (...args: unknown[]) => mockCreateResidentTicket(...args),
}));

vi.mock("sonner", () => ({
  toast: {
    success: (...args: unknown[]) => mockToastSuccess(...args),
    error: (...args: unknown[]) => mockToastError(...args),
  },
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => "/r/support",
  useSearchParams: () => new URLSearchParams(""),
}));

import ResidentSupportPage from "@/app/r/support/page";
import { AuthContext } from "@/hooks/useAuth";

// ── Fixtures ─────────────────────────────────────────────────────────────────

const MOCK_USER = {
  id: "user-1",
  name: "Jane Resident",
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
};

const MOCK_TICKET = {
  id: "ticket-1",
  ticketNumber: 42,
  type: "MAINTENANCE_ISSUE" as const,
  priority: "MEDIUM" as const,
  status: "OPEN" as const,
  subject: "Broken elevator",
  createdBy: "user-1",
  createdAt: new Date("2026-04-01").toISOString(),
  updatedAt: new Date("2026-04-05").toISOString(),
  createdByUser: { name: "Jane Resident" },
  _count: { messages: 2, attachments: 0 },
};

const MOCK_TICKET_OTHER = {
  ...MOCK_TICKET,
  id: "ticket-2",
  ticketNumber: 43,
  subject: "Water leak in corridor",
  createdBy: "user-2",
  createdByUser: { name: "Bob Neighbor" },
  _count: { messages: 0, attachments: 3 },
};

const EMPTY_RESPONSE = { tickets: [], total: 0, page: 1, pageSize: 20 };
const ONE_TICKET_RESPONSE = { tickets: [MOCK_TICKET], total: 1, page: 1, pageSize: 20 };
const TWO_TICKETS_RESPONSE = {
  tickets: [MOCK_TICKET, MOCK_TICKET_OTHER],
  total: 2,
  page: 1,
  pageSize: 20,
};

// ── Helper ───────────────────────────────────────────────────────────────────

function renderPage(userOverride = MOCK_USER) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <AuthContext.Provider
        value={{
          user: userOverride,
          isLoading: false,
          isAuthenticated: true,
          signOut: vi.fn(),
          switchSociety: vi.fn(),
        }}
      >
        <ResidentSupportPage />
      </AuthContext.Provider>
    </QueryClientProvider>,
  );
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("ResidentSupportPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetResidentTickets.mockResolvedValue(EMPTY_RESPONSE);
  });

  describe("loading and empty states", () => {
    it("shows spinner while loading", () => {
      mockGetResidentTickets.mockReturnValue(new Promise(() => {}));
      renderPage();
      expect(document.querySelector(".animate-spin")).toBeInTheDocument();
    });

    it("renders page header", async () => {
      renderPage();
      await waitFor(() => {
        expect(screen.getByRole("heading", { name: "Support" })).toBeInTheDocument();
      });
    });

    it("shows New Ticket button", async () => {
      renderPage();
      await waitFor(() => {
        expect(screen.getByRole("button", { name: /new ticket/i })).toBeInTheDocument();
      });
    });

    it("shows empty state when no tickets", async () => {
      renderPage();
      await waitFor(() => {
        expect(screen.getByText(/no tickets found/i)).toBeInTheDocument();
      });
    });
  });

  describe("ticket list rendering", () => {
    it("renders ticket subject", async () => {
      mockGetResidentTickets.mockResolvedValue(ONE_TICKET_RESPONSE);
      renderPage();
      await waitFor(() => {
        expect(screen.getByText("Broken elevator")).toBeInTheDocument();
      });
    });

    it("renders ticket number", async () => {
      mockGetResidentTickets.mockResolvedValue(ONE_TICKET_RESPONSE);
      renderPage();
      await waitFor(() => {
        expect(screen.getByText("#42")).toBeInTheDocument();
      });
    });

    it("renders 'Raised by' attribution", async () => {
      mockGetResidentTickets.mockResolvedValue(ONE_TICKET_RESPONSE);
      renderPage();
      await waitFor(() => {
        expect(screen.getByText(/raised by jane resident/i)).toBeInTheDocument();
      });
    });

    it("highlights own tickets with blue background class", async () => {
      mockGetResidentTickets.mockResolvedValue(ONE_TICKET_RESPONSE);
      renderPage();
      await waitFor(() => {
        const row = screen.getByText("Broken elevator").closest("a");
        expect(row?.className).toContain("border-blue-200");
      });
    });

    it("does not highlight other residents' tickets", async () => {
      mockGetResidentTickets.mockResolvedValue({
        tickets: [MOCK_TICKET_OTHER],
        total: 1,
        page: 1,
        pageSize: 20,
      });
      renderPage();
      await waitFor(() => {
        const row = screen.getByText("Water leak in corridor").closest("a");
        expect(row?.className).not.toContain("border-blue-200");
      });
    });

    it("shows paperclip icon when ticket has attachments", async () => {
      mockGetResidentTickets.mockResolvedValue({
        tickets: [MOCK_TICKET_OTHER],
        total: 1,
        page: 1,
        pageSize: 20,
      });
      renderPage();
      await waitFor(() => {
        expect(screen.getByText("3")).toBeInTheDocument();
      });
    });

    it("does not show paperclip when no attachments", async () => {
      mockGetResidentTickets.mockResolvedValue(ONE_TICKET_RESPONSE);
      renderPage();
      await waitFor(() => {
        expect(screen.queryByText("0")).not.toBeInTheDocument();
      });
    });

    it("renders ticket links pointing to detail page", async () => {
      mockGetResidentTickets.mockResolvedValue(ONE_TICKET_RESPONSE);
      renderPage();
      await waitFor(() => {
        const link = screen.getByText("Broken elevator").closest("a");
        expect(link).toHaveAttribute("href", "/r/support/ticket-1");
      });
    });
  });

  describe("filters", () => {
    it("renders status filter", async () => {
      renderPage();
      await waitFor(() => {
        expect(screen.getByText("All Statuses")).toBeInTheDocument();
      });
    });

    it("renders type filter", async () => {
      renderPage();
      await waitFor(() => {
        expect(screen.getByText("All Types")).toBeInTheDocument();
      });
    });

    it("renders My Tickets Only checkbox", async () => {
      renderPage();
      await waitFor(() => {
        expect(screen.getByRole("checkbox", { name: /my tickets only/i })).toBeInTheDocument();
      });
    });

    it("shows clear filters button when mine-only is toggled", async () => {
      renderPage();
      await waitFor(() =>
        expect(screen.getByRole("checkbox", { name: /my tickets only/i })).toBeInTheDocument(),
      );
      const checkbox = screen.getByRole("checkbox", { name: /my tickets only/i });
      fireEvent.click(checkbox);
      await waitFor(() => {
        expect(screen.getByRole("button", { name: /clear filters/i })).toBeInTheDocument();
      });
    });

    it("resets filters when clear filters is clicked", async () => {
      renderPage();
      await waitFor(() =>
        expect(screen.getByRole("checkbox", { name: /my tickets only/i })).toBeInTheDocument(),
      );
      const checkbox = screen.getByRole("checkbox", { name: /my tickets only/i });
      fireEvent.click(checkbox);
      await waitFor(() =>
        expect(screen.getByRole("button", { name: /clear filters/i })).toBeInTheDocument(),
      );
      fireEvent.click(screen.getByRole("button", { name: /clear filters/i }));
      await waitFor(() => {
        expect(screen.queryByRole("button", { name: /clear filters/i })).not.toBeInTheDocument();
      });
    });

    it("does not show clear filters when no filters active", async () => {
      renderPage();
      await waitFor(() => {
        expect(screen.queryByRole("button", { name: /clear filters/i })).not.toBeInTheDocument();
      });
    });
  });

  describe("pagination", () => {
    it("does not render pagination for a single page", async () => {
      mockGetResidentTickets.mockResolvedValue(ONE_TICKET_RESPONSE);
      renderPage();
      await waitFor(() => screen.getByText("Broken elevator"));
      expect(screen.queryByRole("button", { name: /previous/i })).not.toBeInTheDocument();
    });

    it("renders pagination when there are multiple pages", async () => {
      mockGetResidentTickets.mockResolvedValue({
        tickets: [MOCK_TICKET],
        total: 45,
        page: 1,
        pageSize: 20,
      });
      renderPage();
      await waitFor(() => {
        expect(screen.getByRole("button", { name: /previous/i })).toBeInTheDocument();
        expect(screen.getByRole("button", { name: /next/i })).toBeInTheDocument();
      });
    });

    it("disables previous on first page", async () => {
      mockGetResidentTickets.mockResolvedValue({
        tickets: [MOCK_TICKET],
        total: 45,
        page: 1,
        pageSize: 20,
      });
      renderPage();
      await waitFor(() =>
        expect(screen.getByRole("button", { name: /previous/i })).toBeInTheDocument(),
      );
      expect(screen.getByRole("button", { name: /previous/i })).toBeDisabled();
    });

    it("shows page count text", async () => {
      mockGetResidentTickets.mockResolvedValue({
        tickets: [MOCK_TICKET],
        total: 45,
        page: 1,
        pageSize: 20,
      });
      renderPage();
      await waitFor(() => {
        expect(screen.getByText(/page 1 of 3/i)).toBeInTheDocument();
      });
    });

    it("navigates to next page", async () => {
      mockGetResidentTickets.mockResolvedValue({
        tickets: [MOCK_TICKET],
        total: 45,
        page: 1,
        pageSize: 20,
      });
      renderPage();
      await waitFor(() =>
        expect(screen.getByRole("button", { name: /next/i })).toBeInTheDocument(),
      );
      fireEvent.click(screen.getByRole("button", { name: /next/i }));
      await waitFor(() => {
        expect(screen.getByText(/page 2 of 3/i)).toBeInTheDocument();
      });
    });

    it("navigates back to previous page", async () => {
      mockGetResidentTickets.mockResolvedValue({
        tickets: [MOCK_TICKET],
        total: 45,
        page: 1,
        pageSize: 20,
      });
      renderPage();
      await waitFor(() =>
        expect(screen.getByRole("button", { name: /next/i })).toBeInTheDocument(),
      );
      // Go to page 2
      fireEvent.click(screen.getByRole("button", { name: /next/i }));
      await waitFor(() => screen.getByText(/page 2 of 3/i));
      // Go back to page 1
      fireEvent.click(screen.getByRole("button", { name: /previous/i }));
      await waitFor(() => {
        expect(screen.getByText(/page 1 of 3/i)).toBeInTheDocument();
      });
    });
  });

  describe("create ticket dialog", () => {
    it("opens dialog on New Ticket click", async () => {
      renderPage();
      await waitFor(() =>
        expect(screen.getByRole("button", { name: /new ticket/i })).toBeInTheDocument(),
      );
      fireEvent.click(screen.getByRole("button", { name: /new ticket/i }));
      await waitFor(() => {
        expect(screen.getByRole("dialog")).toBeInTheDocument();
        expect(screen.getByText("New Support Ticket")).toBeInTheDocument();
      });
    });

    it("closes dialog on Cancel click", async () => {
      renderPage();
      await waitFor(() =>
        expect(screen.getByRole("button", { name: /new ticket/i })).toBeInTheDocument(),
      );
      fireEvent.click(screen.getByRole("button", { name: /new ticket/i }));
      await waitFor(() => screen.getByRole("dialog"));
      fireEvent.click(screen.getByRole("button", { name: /cancel/i }));
      await waitFor(() => {
        expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
      });
    });

    it("shows validation errors on empty submit", async () => {
      const user = userEvent.setup();
      renderPage();
      await waitFor(() =>
        expect(screen.getByRole("button", { name: /new ticket/i })).toBeInTheDocument(),
      );
      await user.click(screen.getByRole("button", { name: /new ticket/i }));
      await waitFor(() => screen.getByRole("dialog"));
      const dialog = screen.getByRole("dialog");
      await user.click(within(dialog).getByRole("button", { name: /^submit$/i }));
      await waitFor(() => {
        expect(within(dialog).getAllByText(/must be|invalid/i).length).toBeGreaterThan(0);
      });
    });

    it("calls createResidentTicket on valid submit", async () => {
      const user = userEvent.setup();
      mockCreateResidentTicket.mockResolvedValue({ id: "new-ticket" });
      renderPage();
      await waitFor(() =>
        expect(screen.getByRole("button", { name: /new ticket/i })).toBeInTheDocument(),
      );
      await user.click(screen.getByRole("button", { name: /new ticket/i }));
      await waitFor(() => screen.getByRole("dialog"));
      const dialog = screen.getByRole("dialog");

      // Select type (first combobox)
      await user.click(within(dialog).getAllByRole("combobox")[0]);
      await waitFor(() => screen.getByRole("option", { name: /maintenance/i }));
      await user.click(screen.getByRole("option", { name: /maintenance/i }));

      // Fill subject (short to stay well within limits)
      await user.type(within(dialog).getByRole("textbox", { name: /subject/i }), "Test subject");

      // Fill description
      await user.type(
        within(dialog).getByRole("textbox", { name: /description/i }),
        "Detailed description for the test.",
      );

      await user.click(within(dialog).getByRole("button", { name: /^submit$/i }));
      await waitFor(() => {
        // React Query passes a second context argument; only check the first (the payload)
        expect(mockCreateResidentTicket).toHaveBeenCalledWith(
          expect.objectContaining({ type: "MAINTENANCE_ISSUE" }),
          expect.anything(),
        );
      });
    });

    it("shows success toast and closes dialog on success", async () => {
      const user = userEvent.setup();
      mockCreateResidentTicket.mockResolvedValue({ id: "new-ticket" });
      renderPage();
      await waitFor(() =>
        expect(screen.getByRole("button", { name: /new ticket/i })).toBeInTheDocument(),
      );
      await user.click(screen.getByRole("button", { name: /new ticket/i }));
      await waitFor(() => screen.getByRole("dialog"));
      const dialog = screen.getByRole("dialog");

      await user.click(within(dialog).getAllByRole("combobox")[0]);
      await waitFor(() => screen.getByRole("option", { name: /maintenance/i }));
      await user.click(screen.getByRole("option", { name: /maintenance/i }));
      fireEvent.change(within(dialog).getByRole("textbox", { name: /subject/i }), {
        target: { value: "Test subject here" },
      });
      fireEvent.change(within(dialog).getByRole("textbox", { name: /description/i }), {
        target: { value: "This is a detailed description of the issue that is long enough." },
      });
      await user.click(within(dialog).getByRole("button", { name: /^submit$/i }));

      await waitFor(() => {
        expect(mockToastSuccess).toHaveBeenCalledWith("Ticket submitted successfully.");
      });
    });

    it("shows error toast on create failure", async () => {
      const user = userEvent.setup();
      mockCreateResidentTicket.mockRejectedValue(new Error("Server error"));
      renderPage();
      await waitFor(() =>
        expect(screen.getByRole("button", { name: /new ticket/i })).toBeInTheDocument(),
      );
      await user.click(screen.getByRole("button", { name: /new ticket/i }));
      await waitFor(() => screen.getByRole("dialog"));
      const dialog = screen.getByRole("dialog");

      await user.click(within(dialog).getAllByRole("combobox")[0]);
      await waitFor(() => screen.getByRole("option", { name: /^security$/i }));
      await user.click(screen.getByRole("option", { name: /^security$/i }));
      fireEvent.change(within(dialog).getByRole("textbox", { name: /subject/i }), {
        target: { value: "Security issue here" },
      });
      fireEvent.change(within(dialog).getByRole("textbox", { name: /description/i }), {
        target: { value: "Long enough description for the security issue that needs attention." },
      });
      await user.click(within(dialog).getByRole("button", { name: /^submit$/i }));

      await waitFor(() => {
        expect(mockToastError).toHaveBeenCalledWith("Server error");
      });
    });
  });

  describe("activity indicator", () => {
    it("shows attention dot on AWAITING_RESIDENT ticket", async () => {
      const awaitingTicket = { ...MOCK_TICKET, status: "AWAITING_RESIDENT" };
      mockGetResidentTickets.mockResolvedValue({
        tickets: [awaitingTicket],
        total: 1,
        page: 1,
        pageSize: 20,
      });
      renderPage();
      await waitFor(() => {
        expect(screen.getByText("Broken elevator")).toBeInTheDocument();
      });
      const dots = document.querySelectorAll(".animate-pulse");
      expect(dots.length).toBeGreaterThan(0);
    });
  });

  describe("two tickets rendering", () => {
    it("renders both tickets in list", async () => {
      mockGetResidentTickets.mockResolvedValue(TWO_TICKETS_RESPONSE);
      renderPage();
      await waitFor(() => {
        expect(screen.getByText("Broken elevator")).toBeInTheDocument();
        expect(screen.getByText("Water leak in corridor")).toBeInTheDocument();
      });
    });
  });

  describe("timeAgo formatting", () => {
    it("shows 'just now' for recent tickets (< 1 hour)", async () => {
      const recentTicket = {
        ...MOCK_TICKET,
        updatedAt: new Date(Date.now() - 5 * 60 * 1000).toISOString(), // 5 min ago
      };
      mockGetResidentTickets.mockResolvedValue({
        tickets: [recentTicket],
        total: 1,
        page: 1,
        pageSize: 20,
      });
      renderPage();
      await waitFor(() => {
        expect(screen.getByText(/raised by jane resident · just now/i)).toBeInTheDocument();
      });
    });

    it("shows hours ago for tickets updated a few hours ago", async () => {
      const hoursAgoTicket = {
        ...MOCK_TICKET,
        updatedAt: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(), // 3h ago
      };
      mockGetResidentTickets.mockResolvedValue({
        tickets: [hoursAgoTicket],
        total: 1,
        page: 1,
        pageSize: 20,
      });
      renderPage();
      await waitFor(() => {
        expect(screen.getByText(/3h ago/i)).toBeInTheDocument();
      });
    });
  });
});
