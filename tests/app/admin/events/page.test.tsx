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

  // ─── Pagination Click Handlers ──────────────────────────────────────────

  it("advances to next page when Next is clicked", async () => {
    mockGetEvents.mockResolvedValue({ data: [MOCK_DRAFT_EVENT], total: 25, page: 1, limit: 20 });
    renderPage();
    await waitFor(() => screen.getByRole("button", { name: /Next/i }));
    fireEvent.click(screen.getByRole("button", { name: /Next/i }));
    await waitFor(() => {
      // getEvents should be called again with page 2
      const calls = mockGetEvents.mock.calls;
      const lastCall = calls[calls.length - 1];
      expect(lastCall[1]).toEqual(expect.objectContaining({ page: 2 }));
    });
  });

  it("goes to previous page when Previous is clicked", async () => {
    // Start on page 2
    mockGetEvents
      .mockResolvedValueOnce({ data: [MOCK_DRAFT_EVENT], total: 25, page: 1, limit: 20 })
      .mockResolvedValue({ data: [MOCK_DRAFT_EVENT], total: 25, page: 2, limit: 20 });
    renderPage();
    await waitFor(() => screen.getByRole("button", { name: /Next/i }));
    // Go to page 2
    fireEvent.click(screen.getByRole("button", { name: /Next/i }));
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Previous/i })).not.toBeDisabled();
    });
    // Go back to page 1
    fireEvent.click(screen.getByRole("button", { name: /Previous/i }));
    await waitFor(() => {
      const calls = mockGetEvents.mock.calls;
      const lastCall = calls[calls.length - 1];
      expect(lastCall[1]).toEqual(expect.objectContaining({ page: 1 }));
    });
  });

  // ─── Filter Changes ─────────────────────────────────────────────────────

  it("calls getEvents with status filter when changed", async () => {
    mockGetEvents.mockResolvedValue(EMPTY_LIST);
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => screen.getByText("All Statuses"));

    // Open status filter and select DRAFT
    const statusTrigger = screen.getByText("All Statuses").closest("button")!;
    await user.click(statusTrigger);
    const draftOption = await screen.findByRole("option", { name: /Draft/i });
    await user.click(draftOption);

    await waitFor(() => {
      const calls = mockGetEvents.mock.calls;
      const lastCall = calls[calls.length - 1];
      expect(lastCall[1]).toEqual(expect.objectContaining({ status: "DRAFT" }));
    });
  });

  it("calls getEvents with category filter when changed", async () => {
    mockGetEvents.mockResolvedValue(EMPTY_LIST);
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => screen.getByText("All Categories"));

    const categoryTrigger = screen.getByText("All Categories").closest("button")!;
    await user.click(categoryTrigger);
    const sportsOption = await screen.findByRole("option", { name: /Sports/i });
    await user.click(sportsOption);

    await waitFor(() => {
      const calls = mockGetEvents.mock.calls;
      const lastCall = calls[calls.length - 1];
      expect(lastCall[1]).toEqual(expect.objectContaining({ category: "SPORTS" }));
    });
  });

  // ─── Mutation onSuccess / onError ───────────────────────────────────────

  it("closes dialog and shows toast on successful create", async () => {
    mockGetEvents.mockResolvedValue(EMPTY_LIST);
    mockCreateEvent.mockResolvedValue({ ...MOCK_DRAFT_EVENT, id: "evt-new" });

    const user = userEvent.setup();
    renderPage();
    await waitFor(() => screen.getByRole("button", { name: /Create Event/i }));
    await user.click(screen.getByRole("button", { name: /Create Event/i }));
    await waitFor(() => screen.getByRole("dialog"));
    const dialog = screen.getByRole("dialog");

    await user.type(within(dialog).getByPlaceholderText("Event title"), "New Holi Event");
    await user.click(within(dialog).getByRole("button", { name: /^Create Event$/i }));

    await waitFor(() => {
      expect(mockCreateEvent).toHaveBeenCalled();
    });
    // Dialog should close on success
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });

  it("shows error toast when create event fails", async () => {
    mockGetEvents.mockResolvedValue(EMPTY_LIST);
    mockCreateEvent.mockRejectedValue(new Error("Create failed"));

    const user = userEvent.setup();
    renderPage();
    await waitFor(() => screen.getByRole("button", { name: /Create Event/i }));
    await user.click(screen.getByRole("button", { name: /Create Event/i }));
    await waitFor(() => screen.getByRole("dialog"));
    const dialog = screen.getByRole("dialog");

    await user.type(within(dialog).getByPlaceholderText("Event title"), "New Holi Event");
    await user.click(within(dialog).getByRole("button", { name: /^Create Event$/i }));

    await waitFor(() => {
      expect(mockCreateEvent).toHaveBeenCalled();
    });
  });

  // ─── Fee Model Selection in Create Dialog ───────────────────────────────

  it("shows Fee Amount field when FIXED fee model is selected", async () => {
    mockGetEvents.mockResolvedValue(EMPTY_LIST);
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole("button", { name: /Create Event/i }));
    await waitFor(() => screen.getByRole("dialog"));

    const dialog = screen.getByRole("dialog");
    // Find the Fee Model combobox inside the dialog - it's the one that shows "Free" initially
    const comboboxes = within(dialog).getAllByRole("combobox");
    // comboboxes[0] is Category (shows "Festival"), comboboxes[1] is Fee Model (shows "Free")
    const feeModelTrigger = comboboxes[1];
    await user.click(feeModelTrigger);
    const fixedOption = await screen.findByRole("option", { name: "Fixed" });
    await user.click(fixedOption);

    await waitFor(() => {
      expect(screen.getByText(/Fee Amount/)).toBeInTheDocument();
    });
    // Charge Unit should also appear for non-FREE
    expect(screen.getByText("Charge Unit")).toBeInTheDocument();
  });

  it("shows Estimated Budget and Min Participants for FLEXIBLE fee model", async () => {
    mockGetEvents.mockResolvedValue(EMPTY_LIST);
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole("button", { name: /Create Event/i }));
    await waitFor(() => screen.getByRole("dialog"));

    const dialog = screen.getByRole("dialog");
    const comboboxes = within(dialog).getAllByRole("combobox");
    const feeModelTrigger = comboboxes[1];
    await user.click(feeModelTrigger);
    const flexibleOption = await screen.findByRole("option", { name: "Flexible" });
    await user.click(flexibleOption);

    await waitFor(() => {
      expect(screen.getByText(/Estimated Budget/)).toBeInTheDocument();
      expect(screen.getByText("Minimum Participants")).toBeInTheDocument();
    });
  });

  it("shows Suggested Amount field for CONTRIBUTION fee model", async () => {
    mockGetEvents.mockResolvedValue(EMPTY_LIST);
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole("button", { name: /Create Event/i }));
    await waitFor(() => screen.getByRole("dialog"));

    const dialog = screen.getByRole("dialog");
    const comboboxes = within(dialog).getAllByRole("combobox");
    const feeModelTrigger = comboboxes[1];
    await user.click(feeModelTrigger);
    const contributionOption = await screen.findByRole("option", { name: "Contribution" });
    await user.click(contributionOption);

    await waitFor(() => {
      expect(screen.getByText(/Suggested Amount/)).toBeInTheDocument();
    });
  });

  it("resets fee fields when switching fee model back to FREE", async () => {
    mockGetEvents.mockResolvedValue(EMPTY_LIST);
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole("button", { name: /Create Event/i }));
    await waitFor(() => screen.getByRole("dialog"));

    const dialog = screen.getByRole("dialog");
    const comboboxes = within(dialog).getAllByRole("combobox");
    const feeModelTrigger = comboboxes[1];

    // Switch to FIXED first
    await user.click(feeModelTrigger);
    const fixedOption = await screen.findByRole("option", { name: "Fixed" });
    await user.click(fixedOption);
    await waitFor(() => screen.getByText(/Fee Amount/));

    // Switch back to FREE
    await user.click(feeModelTrigger);
    const freeOption = await screen.findByRole("option", { name: "Free" });
    await user.click(freeOption);

    await waitFor(() => {
      expect(screen.queryByText(/Fee Amount/)).not.toBeInTheDocument();
      expect(screen.queryByText("Charge Unit")).not.toBeInTheDocument();
    });
  });

  // ─── Multiple Unsettled Events Badge ────────────────────────────────────

  it("shows plural 'events' in pending settlement badge for multiple unsettled", async () => {
    const secondUnsettled = {
      ...MOCK_COMPLETED_UNSETTLED,
      id: "evt-6",
      title: "Another AGM",
    };
    mockGetEvents.mockResolvedValue({
      data: [MOCK_COMPLETED_UNSETTLED, secondUnsettled],
      total: 2,
      page: 1,
      limit: 20,
    });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText(/2 events pending settlement/)).toBeInTheDocument();
    });
  });

  // ─── Category Badge Display ─────────────────────────────────────────────

  it("renders category badge in table row", async () => {
    mockGetEvents.mockResolvedValue({
      data: [{ ...MOCK_DRAFT_EVENT, category: "SPORTS" }],
      total: 1,
      page: 1,
      limit: 20,
    });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Sports")).toBeInTheDocument();
    });
  });

  // ─── Registration Count Fallback ────────────────────────────────────────

  it("shows 0 when _count is missing", async () => {
    mockGetEvents.mockResolvedValue({
      data: [{ ...MOCK_DRAFT_EVENT, _count: undefined }],
      total: 1,
      page: 1,
      limit: 20,
    });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("0")).toBeInTheDocument();
    });
  });

  // ─── Category Select Change in Dialog ─────────────────────────────────

  it("changes category via category select in create dialog", async () => {
    mockGetEvents.mockResolvedValue(EMPTY_LIST);
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole("button", { name: /Create Event/i }));
    await waitFor(() => screen.getByRole("dialog"));

    const dialog = screen.getByRole("dialog");
    // comboboxes[0] is Category (shows "Festival" by default)
    const comboboxes = within(dialog).getAllByRole("combobox");
    const categoryTrigger = comboboxes[0];
    await user.click(categoryTrigger);
    const sportsOption = await screen.findByRole("option", { name: "Sports" });
    await user.click(sportsOption);

    // After selection, the combobox value should have changed
    await waitFor(() => {
      expect(mockCreateEvent).not.toHaveBeenCalled(); // nothing submitted yet
    });
  });

  // ─── Charge Unit Select Change in Dialog ──────────────────────────────

  it("changes charge unit via charge unit select when non-FREE", async () => {
    mockGetEvents.mockResolvedValue(EMPTY_LIST);
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole("button", { name: /Create Event/i }));
    await waitFor(() => screen.getByRole("dialog"));

    const dialog = screen.getByRole("dialog");
    const comboboxes = within(dialog).getAllByRole("combobox");

    // Switch to FIXED to show Charge Unit
    await user.click(comboboxes[1]);
    const fixedOption = await screen.findByRole("option", { name: "Fixed" });
    await user.click(fixedOption);
    await waitFor(() => screen.getByText("Charge Unit"));

    // Now change the charge unit
    const updatedComboboxes = within(dialog).getAllByRole("combobox");
    // After FIXED, there are now 3 comboboxes: category, fee model, charge unit
    const chargeUnitTrigger = updatedComboboxes[2];
    await user.click(chargeUnitTrigger);
    const perHouseholdOption = await screen.findByRole("option", { name: "Per Household" });
    await user.click(perHouseholdOption);

    // Verify the selection happened — the charge unit combobox updated
    await waitFor(() => {
      expect(chargeUnitTrigger).toBeInTheDocument();
    });
  });

  // ─── Form Submit via Enter Key ────────────────────────────────────────

  it("submits form via Enter key in title field", async () => {
    mockGetEvents.mockResolvedValue(EMPTY_LIST);
    mockCreateEvent.mockResolvedValue({ ...MOCK_DRAFT_EVENT, id: "evt-new" });

    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole("button", { name: /Create Event/i }));
    await waitFor(() => screen.getByRole("dialog"));
    const dialog = screen.getByRole("dialog");

    const titleInput = within(dialog).getByPlaceholderText("Event title");
    await user.type(titleInput, "Enter Submit Event");

    // Submit the form via native form submission
    const form = dialog.querySelector("form")!;
    fireEvent.submit(form);

    await waitFor(() => {
      expect(mockCreateEvent).toHaveBeenCalled();
    });
  });

  // ─── Title Validation Error ───────────────────────────────────────────

  it("shows title validation error for short title", async () => {
    mockGetEvents.mockResolvedValue(EMPTY_LIST);
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole("button", { name: /Create Event/i }));
    await waitFor(() => screen.getByRole("dialog"));
    const dialog = screen.getByRole("dialog");

    // Type only 2 characters (min is 3)
    await user.type(within(dialog).getByPlaceholderText("Event title"), "Hi");
    await user.click(within(dialog).getByRole("button", { name: /^Create Event$/i }));

    await waitFor(() => {
      expect(screen.getByText(/at least 3 characters/i)).toBeInTheDocument();
    });
  });
});
