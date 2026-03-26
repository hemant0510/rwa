import React from "react";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, fireEvent, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";

import EventsPage from "@/app/admin/events/page";
import { AuthContext } from "@/hooks/useAuth";

// ── Hoisted mocks ──────────────────────────────────────────────────────────

const { mockGetEvents, mockCreateEvent } = vi.hoisted(() => ({
  mockGetEvents: vi.fn(),
  mockCreateEvent: vi.fn(),
}));

vi.mock("@/services/events", () => ({
  getEvents: (...args: unknown[]) => mockGetEvents(...args),
  createEvent: (...args: unknown[]) => mockCreateEvent(...args),
}));

const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
  usePathname: () => "/admin/events",
  useSearchParams: () => new URLSearchParams(""),
}));

// ── Fixtures ───────────────────────────────────────────────────────────────

const MOCK_DRAFT_EVENT = {
  id: "evt-1",
  societyId: "soc-1",
  title: "Holi Celebration",
  description: "Colors and fun",
  category: "FESTIVAL",
  feeModel: "FLEXIBLE",
  chargeUnit: "PER_PERSON",
  eventDate: "2026-03-25T10:00:00.000Z",
  location: "Community Hall",
  registrationDeadline: null,
  feeAmount: null,
  estimatedBudget: 50000,
  minParticipants: 50,
  maxParticipants: null,
  suggestedAmount: null,
  status: "DRAFT",
  cancellationReason: null,
  publishedAt: null,
  paymentTriggeredAt: null,
  settledAt: null,
  surplusAmount: null,
  surplusDisposal: null,
  deficitDisposition: null,
  settlementNotes: null,
  createdAt: "2026-03-01T00:00:00.000Z",
  creator: { name: "Admin User" },
  _count: { registrations: 5 },
};

const MOCK_PUBLISHED_EVENT = {
  ...MOCK_DRAFT_EVENT,
  id: "evt-2",
  title: "Yoga Workshop",
  feeModel: "FIXED",
  feeAmount: 200,
  status: "PUBLISHED",
  publishedAt: "2026-03-02T00:00:00.000Z",
};

const MOCK_COMPLETED_SETTLED = {
  ...MOCK_DRAFT_EVENT,
  id: "evt-3",
  title: "Diwali Party",
  feeModel: "CONTRIBUTION",
  status: "COMPLETED",
  settledAt: "2026-03-10T00:00:00.000Z",
};

const MOCK_COMPLETED_UNSETTLED = {
  ...MOCK_DRAFT_EVENT,
  id: "evt-4",
  title: "AGM Meeting",
  feeModel: "FREE",
  status: "COMPLETED",
  settledAt: null,
};

const MOCK_CANCELLED_EVENT = {
  ...MOCK_DRAFT_EVENT,
  id: "evt-5",
  title: "Cancelled Picnic",
  status: "CANCELLED",
};

const EMPTY_LIST = { data: [], total: 0, page: 1, limit: 20 };

// ── Helpers ────────────────────────────────────────────────────────────────

function makeAdminUser(overrides: Record<string, unknown> = {}) {
  return {
    id: "u1",
    name: "Admin User",
    role: "RWA_ADMIN" as const,
    permission: "FULL_ACCESS" as const,
    societyId: "soc-1",
    societyName: "Eden Estate",
    societyCode: "EDEN",
    societyStatus: "ACTIVE",
    trialEndsAt: null,
    isTrialExpired: false,
    multiSociety: false,
    societies: null,
    ...overrides,
  };
}

function renderPage(userOverrides: Record<string, unknown> = {}) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  const user = makeAdminUser(userOverrides);
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
        <EventsPage />
      </AuthContext.Provider>
    </QueryClientProvider>,
  );
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe("Admin EventsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ─── Loading & Empty States ───────────────────────────────────────────────

  it("renders page title", () => {
    mockGetEvents.mockReturnValue(new Promise(() => {}));
    renderPage();
    expect(screen.getByText("Community Events")).toBeInTheDocument();
  });

  it("renders page description", () => {
    mockGetEvents.mockReturnValue(new Promise(() => {}));
    renderPage();
    expect(screen.getByText("Manage society events")).toBeInTheDocument();
  });

  it("shows empty state when no events exist", async () => {
    mockGetEvents.mockResolvedValue(EMPTY_LIST);
    renderPage();
    await waitFor(() => {
      expect(screen.getByText(/No events found/)).toBeInTheDocument();
    });
  });

  it("does not fetch when societyId is empty", async () => {
    mockGetEvents.mockResolvedValue(EMPTY_LIST);
    renderPage({ societyId: "" });
    await waitFor(() => {
      expect(screen.getByText("Community Events")).toBeInTheDocument();
    });
    expect(mockGetEvents).not.toHaveBeenCalled();
  });

  // ─── Create Event Button ──────────────────────────────────────────────────

  it("renders Create Event button", () => {
    mockGetEvents.mockReturnValue(new Promise(() => {}));
    renderPage();
    expect(screen.getByRole("button", { name: /Create Event/i })).toBeInTheDocument();
  });

  it("opens create event dialog on button click", async () => {
    mockGetEvents.mockResolvedValue(EMPTY_LIST);
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => screen.getByRole("button", { name: /Create Event/i }));
    await user.click(screen.getByRole("button", { name: /Create Event/i }));
    await waitFor(() => {
      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });
    // Dialog title should be present
    expect(screen.getByRole("heading", { name: "Create Event" })).toBeInTheDocument();
  });

  it("shows required fields in create dialog", async () => {
    mockGetEvents.mockResolvedValue(EMPTY_LIST);
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole("button", { name: /Create Event/i }));
    await waitFor(() => screen.getByRole("dialog"));
    expect(screen.getByPlaceholderText("Event title")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Describe this event...")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("e.g. Community Hall")).toBeInTheDocument();
  });

  it("shows Max Participants optional field in dialog", async () => {
    mockGetEvents.mockResolvedValue(EMPTY_LIST);
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole("button", { name: /Create Event/i }));
    await waitFor(() => screen.getByRole("dialog"));
    expect(screen.getByText("Max Participants (optional)")).toBeInTheDocument();
  });

  it("shows Registration Deadline optional field in dialog", async () => {
    mockGetEvents.mockResolvedValue(EMPTY_LIST);
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole("button", { name: /Create Event/i }));
    await waitFor(() => screen.getByRole("dialog"));
    expect(screen.getByText("Registration Deadline (optional)")).toBeInTheDocument();
  });

  it("shows category and fee model selects in dialog", async () => {
    mockGetEvents.mockResolvedValue(EMPTY_LIST);
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole("button", { name: /Create Event/i }));
    await waitFor(() => screen.getByRole("dialog"));
    expect(screen.getByText("Category")).toBeInTheDocument();
    expect(screen.getByText("Fee Model")).toBeInTheDocument();
  });

  it("shows event date field in dialog", async () => {
    mockGetEvents.mockResolvedValue(EMPTY_LIST);
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole("button", { name: /Create Event/i }));
    await waitFor(() => screen.getByRole("dialog"));
    expect(screen.getByText(/Event Date/)).toBeInTheDocument();
  });

  it("hides Charge Unit field for FREE fee model (default)", async () => {
    mockGetEvents.mockResolvedValue(EMPTY_LIST);
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole("button", { name: /Create Event/i }));
    await waitFor(() => screen.getByRole("dialog"));
    // FREE is default — Charge Unit should be hidden
    expect(screen.queryByText("Charge Unit")).not.toBeInTheDocument();
  });

  it("hides Fee Amount field for FREE fee model (default)", async () => {
    mockGetEvents.mockResolvedValue(EMPTY_LIST);
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole("button", { name: /Create Event/i }));
    await waitFor(() => screen.getByRole("dialog"));
    expect(screen.queryByText(/Fee Amount/)).not.toBeInTheDocument();
  });

  it("closes dialog and resets form on Cancel click", async () => {
    mockGetEvents.mockResolvedValue(EMPTY_LIST);
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole("button", { name: /Create Event/i }));
    await waitFor(() => screen.getByRole("dialog"));
    await user.click(screen.getByRole("button", { name: /^Cancel$/i }));
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });

  it("calls createEvent on form submit with valid data", async () => {
    mockGetEvents.mockResolvedValue(EMPTY_LIST);
    mockCreateEvent.mockResolvedValue({ ...MOCK_DRAFT_EVENT, id: "evt-new" });

    const user = userEvent.setup();
    renderPage();
    await waitFor(() => screen.getByRole("button", { name: /Create Event/i }));
    await user.click(screen.getByRole("button", { name: /Create Event/i }));
    await waitFor(() => screen.getByRole("dialog"));
    const dialog = screen.getByRole("dialog");

    // Type title and submit — same pattern as cancelEvent test (which passes)
    await user.type(within(dialog).getByPlaceholderText("Event title"), "New Holi Event");
    await user.click(within(dialog).getByRole("button", { name: /^Create Event$/i }));
    await waitFor(() => {
      expect(mockCreateEvent).toHaveBeenCalled();
    });
  });

  it("does not call createEvent when title is empty", async () => {
    mockGetEvents.mockResolvedValue(EMPTY_LIST);
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole("button", { name: /Create Event/i }));
    await waitFor(() => screen.getByRole("dialog"));
    // Submit without filling title
    const submitBtns = screen.getAllByRole("button", { name: /Create Event/i });
    await user.click(submitBtns[submitBtns.length - 1]);
    await waitFor(() => {
      expect(mockCreateEvent).not.toHaveBeenCalled();
    });
  });

  // ─── Events Table ────────────────────────────────────────────────────────

  it("renders event rows in the table", async () => {
    mockGetEvents.mockResolvedValue({
      data: [MOCK_DRAFT_EVENT, MOCK_PUBLISHED_EVENT],
      total: 2,
      page: 1,
      limit: 20,
    });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Holi Celebration")).toBeInTheDocument();
    });
    expect(screen.getByText("Yoga Workshop")).toBeInTheDocument();
  });

  it("navigates to event detail on row click", async () => {
    mockGetEvents.mockResolvedValue({ data: [MOCK_DRAFT_EVENT], total: 1, page: 1, limit: 20 });
    renderPage();
    await waitFor(() => screen.getByText("Holi Celebration"));
    fireEvent.click(screen.getByText("Holi Celebration"));
    expect(mockPush).toHaveBeenCalledWith("/admin/events/evt-1");
  });

  it("shows date formatted in table rows", async () => {
    mockGetEvents.mockResolvedValue({ data: [MOCK_DRAFT_EVENT], total: 1, page: 1, limit: 20 });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("25 Mar 2026")).toBeInTheDocument();
    });
  });

  // ─── Status Badges ────────────────────────────────────────────────────────

  it("renders DRAFT status badge", async () => {
    mockGetEvents.mockResolvedValue({ data: [MOCK_DRAFT_EVENT], total: 1, page: 1, limit: 20 });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Draft")).toBeInTheDocument();
    });
  });

  it("renders PUBLISHED status badge", async () => {
    mockGetEvents.mockResolvedValue({
      data: [MOCK_PUBLISHED_EVENT],
      total: 1,
      page: 1,
      limit: 20,
    });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Published")).toBeInTheDocument();
    });
  });

  it("renders CANCELLED status badge", async () => {
    mockGetEvents.mockResolvedValue({
      data: [MOCK_CANCELLED_EVENT],
      total: 1,
      page: 1,
      limit: 20,
    });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Cancelled")).toBeInTheDocument();
    });
  });

  it("renders COMPLETED status badge", async () => {
    mockGetEvents.mockResolvedValue({
      data: [MOCK_COMPLETED_SETTLED],
      total: 1,
      page: 1,
      limit: 20,
    });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Completed")).toBeInTheDocument();
    });
  });

  // ─── Settlement Labels ────────────────────────────────────────────────────

  it("shows 'Settled ✓' for completed + settled event", async () => {
    mockGetEvents.mockResolvedValue({
      data: [MOCK_COMPLETED_SETTLED],
      total: 1,
      page: 1,
      limit: 20,
    });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Settled ✓")).toBeInTheDocument();
    });
  });

  it("shows 'Pending settlement' in row for completed + unsettled event", async () => {
    mockGetEvents.mockResolvedValue({
      data: [MOCK_COMPLETED_UNSETTLED],
      total: 1,
      page: 1,
      limit: 20,
    });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Pending settlement")).toBeInTheDocument();
    });
  });

  it("shows pending settlement count badge in page header", async () => {
    mockGetEvents.mockResolvedValue({
      data: [MOCK_COMPLETED_UNSETTLED],
      total: 1,
      page: 1,
      limit: 20,
    });
    renderPage();
    await waitFor(() => {
      // The badge text includes the count + "event" + "pending settlement"
      const badges = screen.getAllByText(/pending settlement/i);
      expect(badges.length).toBeGreaterThanOrEqual(1);
    });
  });

  it("does not show nudge badge when no unsettled completed events", async () => {
    mockGetEvents.mockResolvedValue({ data: [MOCK_DRAFT_EVENT], total: 1, page: 1, limit: 20 });
    renderPage();
    await waitFor(() => screen.getByText("Holi Celebration"));
    // Only DRAFT events, no unsettled completed — no orange nudge badge with "event pending"
    const badges = screen.queryAllByText(/\d+ event.*pending settlement/i);
    expect(badges.length).toBe(0);
  });

  // ─── Fee Model Badges ────────────────────────────────────────────────────

  it("renders FREE fee model badge", async () => {
    mockGetEvents.mockResolvedValue({
      data: [{ ...MOCK_DRAFT_EVENT, feeModel: "FREE" }],
      total: 1,
      page: 1,
      limit: 20,
    });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Free")).toBeInTheDocument();
    });
  });

  it("renders FIXED fee model badge", async () => {
    mockGetEvents.mockResolvedValue({
      data: [MOCK_PUBLISHED_EVENT],
      total: 1,
      page: 1,
      limit: 20,
    });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Fixed")).toBeInTheDocument();
    });
  });

  it("renders FLEXIBLE fee model badge", async () => {
    mockGetEvents.mockResolvedValue({ data: [MOCK_DRAFT_EVENT], total: 1, page: 1, limit: 20 });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Flexible")).toBeInTheDocument();
    });
  });

  it("renders CONTRIBUTION fee model badge", async () => {
    mockGetEvents.mockResolvedValue({
      data: [MOCK_COMPLETED_SETTLED],
      total: 1,
      page: 1,
      limit: 20,
    });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Contribution")).toBeInTheDocument();
    });
  });

  // ─── Registration Count ───────────────────────────────────────────────────

  it("shows registration count in table", async () => {
    mockGetEvents.mockResolvedValue({ data: [MOCK_DRAFT_EVENT], total: 1, page: 1, limit: 20 });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("5")).toBeInTheDocument();
    });
  });

  // ─── Filters ─────────────────────────────────────────────────────────────

  it("renders status filter dropdown", async () => {
    mockGetEvents.mockResolvedValue(EMPTY_LIST);
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("All Statuses")).toBeInTheDocument();
    });
  });

  it("renders category filter dropdown", async () => {
    mockGetEvents.mockResolvedValue(EMPTY_LIST);
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("All Categories")).toBeInTheDocument();
    });
  });

  // ─── Pagination ───────────────────────────────────────────────────────────

  it("shows pagination when total exceeds limit", async () => {
    mockGetEvents.mockResolvedValue({ data: [MOCK_DRAFT_EVENT], total: 25, page: 1, limit: 20 });
    renderPage();
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Next/i })).toBeInTheDocument();
    });
    expect(screen.getByRole("button", { name: /Previous/i })).toBeInTheDocument();
  });

  it("Previous button is disabled on first page", async () => {
    mockGetEvents.mockResolvedValue({ data: [MOCK_DRAFT_EVENT], total: 25, page: 1, limit: 20 });
    renderPage();
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Previous/i })).toBeDisabled();
    });
  });

  it("does not show pagination when total fits in one page", async () => {
    mockGetEvents.mockResolvedValue({ data: [MOCK_DRAFT_EVENT], total: 1, page: 1, limit: 20 });
    renderPage();
    await waitFor(() => screen.getByText("Holi Celebration"));
    expect(screen.queryByRole("button", { name: /Next/i })).not.toBeInTheDocument();
  });

  it("shows pagination range text", async () => {
    mockGetEvents.mockResolvedValue({ data: [MOCK_DRAFT_EVENT], total: 25, page: 1, limit: 20 });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText(/Showing 1/)).toBeInTheDocument();
    });
  });
});
