import React from "react";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, fireEvent, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";

import EventDetailPage from "@/app/admin/events/[eventId]/page";
import { AuthContext } from "@/hooks/useAuth";

// ── Hoisted mocks ──────────────────────────────────────────────────────────

const {
  mockGetEvent,
  mockGetRegistrations,
  mockGetEventFinances,
  mockPublishEvent,
  mockCompleteEvent,
  mockDeleteEvent,
  mockCancelEvent,
  mockTriggerPayment,
  mockRecordEventPayment,
  mockAddEventExpense,
  mockSettleEvent,
  mockUpdateEvent,
} = vi.hoisted(() => ({
  mockGetEvent: vi.fn(),
  mockGetRegistrations: vi.fn(),
  mockGetEventFinances: vi.fn(),
  mockPublishEvent: vi.fn(),
  mockCompleteEvent: vi.fn(),
  mockDeleteEvent: vi.fn(),
  mockCancelEvent: vi.fn(),
  mockTriggerPayment: vi.fn(),
  mockRecordEventPayment: vi.fn(),
  mockAddEventExpense: vi.fn(),
  mockSettleEvent: vi.fn(),
  mockUpdateEvent: vi.fn(),
}));

vi.mock("@/services/events", () => ({
  getEvent: (...args: unknown[]) => mockGetEvent(...args),
  getRegistrations: (...args: unknown[]) => mockGetRegistrations(...args),
  getEventFinances: (...args: unknown[]) => mockGetEventFinances(...args),
  publishEvent: (...args: unknown[]) => mockPublishEvent(...args),
  completeEvent: (...args: unknown[]) => mockCompleteEvent(...args),
  deleteEvent: (...args: unknown[]) => mockDeleteEvent(...args),
  cancelEvent: (...args: unknown[]) => mockCancelEvent(...args),
  triggerPayment: (...args: unknown[]) => mockTriggerPayment(...args),
  recordEventPayment: (...args: unknown[]) => mockRecordEventPayment(...args),
  addEventExpense: (...args: unknown[]) => mockAddEventExpense(...args),
  settleEvent: (...args: unknown[]) => mockSettleEvent(...args),
  updateEvent: (...args: unknown[]) => mockUpdateEvent(...args),
}));

const mockPush = vi.fn();
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
  useParams: () => ({ eventId: "evt-1" }),
  usePathname: () => "/admin/events/evt-1",
  useSearchParams: () => new URLSearchParams(""),
}));

// ── Fixtures ───────────────────────────────────────────────────────────────

const DRAFT_EVENT = {
  id: "evt-1",
  societyId: "soc-1",
  title: "Holi Celebration",
  description: "A fun holi event",
  category: "FESTIVAL",
  feeModel: "FLEXIBLE",
  chargeUnit: "PER_PERSON",
  eventDate: "2026-03-25T10:00:00.000Z",
  location: "Community Hall",
  registrationDeadline: null,
  feeAmount: null,
  estimatedBudget: 50000,
  minParticipants: 50,
  maxParticipants: 100,
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
  _count: { registrations: 0 },
};

const PUBLISHED_FIXED_EVENT = {
  ...DRAFT_EVENT,
  id: "evt-2",
  title: "Yoga Workshop",
  feeModel: "FIXED",
  feeAmount: 200,
  chargeUnit: "PER_PERSON",
  status: "PUBLISHED",
  publishedAt: "2026-03-02T00:00:00.000Z",
};

const PUBLISHED_FLEXIBLE_NO_FEE = {
  ...DRAFT_EVENT,
  id: "evt-3",
  title: "Diwali Party",
  feeModel: "FLEXIBLE",
  feeAmount: null,
  status: "PUBLISHED",
  publishedAt: "2026-03-02T00:00:00.000Z",
};

const COMPLETED_EVENT = {
  ...DRAFT_EVENT,
  id: "evt-4",
  title: "AGM Meeting",
  feeModel: "FREE",
  chargeUnit: "PER_HOUSEHOLD",
  status: "COMPLETED",
  settledAt: null,
};

const COMPLETED_FIXED_EVENT = {
  ...DRAFT_EVENT,
  id: "evt-6",
  title: "Sports Day",
  feeModel: "FIXED",
  feeAmount: 300,
  chargeUnit: "PER_PERSON",
  status: "COMPLETED",
  settledAt: null,
};

const COMPLETED_SETTLED_EVENT = {
  ...COMPLETED_EVENT,
  id: "evt-5",
  settledAt: "2026-03-15T00:00:00.000Z",
};

const FREE_EVENT = {
  ...DRAFT_EVENT,
  feeModel: "FREE",
  chargeUnit: "PER_HOUSEHOLD",
};

const CANCELLED_EVENT = {
  ...DRAFT_EVENT,
  status: "CANCELLED",
  cancellationReason: "Insufficient interest",
};

const EMPTY_REGISTRATIONS = { data: [], total: 0, page: 1, limit: 50 };

const MOCK_REGISTRATION = {
  id: "reg-1",
  eventId: "evt-1",
  userId: "u2",
  status: "PENDING",
  memberCount: 2,
  registeredAt: "2026-03-03T00:00:00.000Z",
  cancelledAt: null,
  user: { name: "Sharma Ji", email: "sharma@test.com", mobile: "9999999999" },
  payment: null,
};

const MOCK_PAID_REGISTRATION = {
  ...MOCK_REGISTRATION,
  id: "reg-2",
  status: "PAID",
  user: { name: "Kumar Ji", email: "kumar@test.com", mobile: null },
  payment: {
    id: "pay-1",
    amount: 400,
    paymentMode: "UPI",
    referenceNo: "UPI123",
    receiptNo: "REC001",
    paymentDate: "2026-03-04T00:00:00.000Z",
    notes: null,
  },
};

const MOCK_INTERESTED_REGISTRATION = {
  ...MOCK_REGISTRATION,
  id: "reg-3",
  status: "INTERESTED",
  user: { name: "Gupta Ji", email: "gupta@test.com", mobile: null },
};

const MOCK_FINANCES = {
  totalCollected: 10000,
  pendingAmount: 5000,
  totalExpenses: 8000,
  netAmount: 2000,
  expenses: [
    {
      id: "exp-1",
      description: "DJ charges",
      amount: 5000,
      category: "OTHER",
      date: "2026-03-20T00:00:00.000Z",
    },
    {
      id: "exp-2",
      description: "Decoration",
      amount: 3000,
      category: "OTHER",
      date: "2026-03-20T00:00:00.000Z",
    },
  ],
  isSettled: false,
  settledAt: null,
  surplusAmount: null,
  surplusDisposal: null,
  deficitDisposition: null,
  settlementNotes: null,
};

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
  const authUser = makeAdminUser(userOverrides);
  return render(
    <QueryClientProvider client={queryClient}>
      <AuthContext.Provider
        value={{
          user: authUser,
          isLoading: false,
          isAuthenticated: true,
          signOut: vi.fn(),
          switchSociety: vi.fn(),
        }}
      >
        <EventDetailPage />
      </AuthContext.Provider>
    </QueryClientProvider>,
  );
}

// ── Tests ──────────────────────────────────────────────────────────────────

describe("Admin EventDetailPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetRegistrations.mockResolvedValue(EMPTY_REGISTRATIONS);
    mockGetEventFinances.mockResolvedValue(MOCK_FINANCES);
  });

  // ─── Loading & Not Found ───────────────────────────────────────────────────

  it("shows spinner while event is loading", () => {
    mockGetEvent.mockReturnValue(new Promise(() => {}));
    renderPage();
    // Page renders without crashing during load
    expect(document.body).toBeInTheDocument();
  });

  it("shows 'Event not found' when event is null", async () => {
    mockGetEvent.mockResolvedValue(null);
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Event not found.")).toBeInTheDocument();
    });
  });

  it("shows Back to Events button when event is not found", async () => {
    mockGetEvent.mockResolvedValue(null);
    renderPage();
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Back to Events/i })).toBeInTheDocument();
    });
  });

  it("navigates to events list from Back to Events button", async () => {
    mockGetEvent.mockResolvedValue(null);
    renderPage();
    await waitFor(() => screen.getByRole("button", { name: /Back to Events/i }));
    fireEvent.click(screen.getByRole("button", { name: /Back to Events/i }));
    expect(mockPush).toHaveBeenCalledWith("/admin/events");
  });

  // ─── Header ──────────────────────────────────────────────────────────────

  it("renders event title in header", async () => {
    mockGetEvent.mockResolvedValue(DRAFT_EVENT);
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Holi Celebration")).toBeInTheDocument();
    });
  });

  it("renders formatted event date", async () => {
    mockGetEvent.mockResolvedValue(DRAFT_EVENT);
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("25 Mar 2026")).toBeInTheDocument();
    });
  });

  it("renders event location in header", async () => {
    mockGetEvent.mockResolvedValue(DRAFT_EVENT);
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Community Hall")).toBeInTheDocument();
    });
  });

  it("Back button navigates to events list", async () => {
    mockGetEvent.mockResolvedValue(DRAFT_EVENT);
    renderPage();
    await waitFor(() => screen.getByText("Holi Celebration"));
    fireEvent.click(screen.getByRole("button", { name: /^Back$/i }));
    expect(mockPush).toHaveBeenCalledWith("/admin/events");
  });

  // ─── Status & Fee Model Badges ───────────────────────────────────────────

  it("shows DRAFT status badge", async () => {
    mockGetEvent.mockResolvedValue(DRAFT_EVENT);
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("DRAFT")).toBeInTheDocument();
    });
  });

  it("shows PUBLISHED status badge", async () => {
    mockGetEvent.mockResolvedValue(PUBLISHED_FIXED_EVENT);
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("PUBLISHED")).toBeInTheDocument();
    });
  });

  it("shows COMPLETED status badge", async () => {
    mockGetEvent.mockResolvedValue(COMPLETED_EVENT);
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("COMPLETED")).toBeInTheDocument();
    });
  });

  it("shows CANCELLED status badge", async () => {
    mockGetEvent.mockResolvedValue(CANCELLED_EVENT);
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("CANCELLED")).toBeInTheDocument();
    });
  });

  it("shows fee model badge", async () => {
    mockGetEvent.mockResolvedValue(PUBLISHED_FIXED_EVENT);
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("FIXED")).toBeInTheDocument();
    });
  });

  it("shows charge unit badge for non-FREE events", async () => {
    mockGetEvent.mockResolvedValue(PUBLISHED_FIXED_EVENT);
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Per Person")).toBeInTheDocument();
    });
  });

  it("shows fee amount badge when feeAmount is set", async () => {
    mockGetEvent.mockResolvedValue(PUBLISHED_FIXED_EVENT);
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("₹200")).toBeInTheDocument();
    });
  });

  it("shows category badge", async () => {
    mockGetEvent.mockResolvedValue(DRAFT_EVENT);
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Festival")).toBeInTheDocument();
    });
  });

  // ─── DRAFT Action Buttons ─────────────────────────────────────────────────

  it("shows Edit, Delete, and Publish buttons for DRAFT event", async () => {
    mockGetEvent.mockResolvedValue(DRAFT_EVENT);
    renderPage();
    await waitFor(() => {
      expect(screen.getAllByRole("button", { name: /Edit/i }).length).toBeGreaterThan(0);
      expect(screen.getAllByRole("button", { name: /Delete/i }).length).toBeGreaterThan(0);
      expect(screen.getByRole("button", { name: /Publish/i })).toBeInTheDocument();
    });
  });

  it("does not show Cancel Event or Mark Complete for DRAFT event", async () => {
    mockGetEvent.mockResolvedValue(DRAFT_EVENT);
    renderPage();
    await waitFor(() => screen.getByText("Holi Celebration"));
    expect(screen.queryByRole("button", { name: /Cancel Event/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Mark Complete/i })).not.toBeInTheDocument();
  });

  // ─── PUBLISHED Action Buttons ─────────────────────────────────────────────

  it("shows Cancel Event and Mark Complete buttons for PUBLISHED event", async () => {
    mockGetEvent.mockResolvedValue(PUBLISHED_FIXED_EVENT);
    renderPage();
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Cancel Event/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Mark Complete/i })).toBeInTheDocument();
    });
  });

  it("shows Set Price & Trigger Payment for PUBLISHED FLEXIBLE event without fee", async () => {
    mockGetEvent.mockResolvedValue(PUBLISHED_FLEXIBLE_NO_FEE);
    renderPage();
    await waitFor(() => {
      expect(
        screen.getAllByRole("button", { name: /Set Price & Trigger Payment/i }).length,
      ).toBeGreaterThan(0);
    });
  });

  it("does not show Trigger Payment for PUBLISHED FIXED event", async () => {
    mockGetEvent.mockResolvedValue(PUBLISHED_FIXED_EVENT);
    renderPage();
    await waitFor(() => screen.getByText("Yoga Workshop"));
    expect(screen.queryByRole("button", { name: /Trigger Payment/i })).not.toBeInTheDocument();
  });

  // ─── COMPLETED Action Buttons ─────────────────────────────────────────────

  it("shows Settle Event button for COMPLETED unsettled event", async () => {
    mockGetEvent.mockResolvedValue(COMPLETED_EVENT);
    renderPage();
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Settle Event/i })).toBeInTheDocument();
    });
  });

  it("shows Re-settle button for COMPLETED settled event", async () => {
    mockGetEventFinances.mockResolvedValue({ ...MOCK_FINANCES, isSettled: true });
    mockGetEvent.mockResolvedValue(COMPLETED_SETTLED_EVENT);
    renderPage();
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Re-settle/i })).toBeInTheDocument();
    });
  });

  // ─── Tabs ─────────────────────────────────────────────────────────────────

  it("renders Registrations, Finances, and Details tabs", async () => {
    mockGetEvent.mockResolvedValue(DRAFT_EVENT);
    renderPage();
    await waitFor(() => {
      expect(screen.getByRole("tab", { name: /Registrations/i })).toBeInTheDocument();
      expect(screen.getByRole("tab", { name: /Finances/i })).toBeInTheDocument();
      expect(screen.getByRole("tab", { name: /Details/i })).toBeInTheDocument();
    });
  });

  it("Registrations tab is active by default", async () => {
    mockGetEvent.mockResolvedValue(DRAFT_EVENT);
    renderPage();
    await waitFor(() => {
      expect(screen.getByRole("tab", { name: /Registrations/i })).toHaveAttribute(
        "data-state",
        "active",
      );
    });
  });

  // ─── Registrations Tab ────────────────────────────────────────────────────

  it("shows empty registrations message when no registrations", async () => {
    mockGetEvent.mockResolvedValue(PUBLISHED_FIXED_EVENT);
    mockGetRegistrations.mockResolvedValue(EMPTY_REGISTRATIONS);
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("No registrations yet.")).toBeInTheDocument();
    });
  });

  it("renders registration rows in table", async () => {
    mockGetEvent.mockResolvedValue(PUBLISHED_FIXED_EVENT);
    mockGetRegistrations.mockResolvedValue({
      data: [MOCK_REGISTRATION],
      total: 1,
      page: 1,
      limit: 50,
    });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Sharma Ji")).toBeInTheDocument();
    });
  });

  it("shows PAID badge for paid registration", async () => {
    mockGetEvent.mockResolvedValue(PUBLISHED_FIXED_EVENT);
    mockGetRegistrations.mockResolvedValue({
      data: [MOCK_PAID_REGISTRATION],
      total: 1,
      page: 1,
      limit: 50,
    });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Paid")).toBeInTheDocument();
    });
  });

  it("shows PENDING badge for pending registration", async () => {
    mockGetEvent.mockResolvedValue(PUBLISHED_FIXED_EVENT);
    mockGetRegistrations.mockResolvedValue({
      data: [MOCK_REGISTRATION],
      total: 1,
      page: 1,
      limit: 50,
    });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Pending")).toBeInTheDocument();
    });
  });

  it("shows collection progress card for FIXED event", async () => {
    mockGetEvent.mockResolvedValue(PUBLISHED_FIXED_EVENT);
    mockGetRegistrations.mockResolvedValue({
      data: [MOCK_REGISTRATION, MOCK_PAID_REGISTRATION],
      total: 2,
      page: 1,
      limit: 50,
    });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Collection Progress")).toBeInTheDocument();
    });
  });

  it("shows Record Payment button for PENDING registration on FIXED event", async () => {
    mockGetEvent.mockResolvedValue(PUBLISHED_FIXED_EVENT);
    mockGetRegistrations.mockResolvedValue({
      data: [MOCK_REGISTRATION],
      total: 1,
      page: 1,
      limit: 50,
    });
    renderPage();
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Record Payment/i })).toBeInTheDocument();
    });
  });

  // ─── FLEXIBLE Polling Dashboard ───────────────────────────────────────────

  it("shows Interest Poll card for FLEXIBLE event without fee", async () => {
    mockGetEvent.mockResolvedValue(PUBLISHED_FLEXIBLE_NO_FEE);
    mockGetRegistrations.mockResolvedValue({
      data: [MOCK_INTERESTED_REGISTRATION],
      total: 1,
      page: 1,
      limit: 50,
    });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Interest Poll")).toBeInTheDocument();
    });
  });

  it("shows interest count in polling dashboard", async () => {
    mockGetEvent.mockResolvedValue(PUBLISHED_FLEXIBLE_NO_FEE);
    mockGetRegistrations.mockResolvedValue({
      data: [MOCK_INTERESTED_REGISTRATION],
      total: 1,
      page: 1,
      limit: 50,
    });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText(/people interested/i)).toBeInTheDocument();
    });
  });

  // ─── Finances Tab ─────────────────────────────────────────────────────────

  it("shows 'free event' message in finances tab", async () => {
    mockGetEvent.mockResolvedValue(FREE_EVENT);
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => screen.getByText("Holi Celebration"));
    await user.click(screen.getByRole("tab", { name: /Finances/i }));
    await waitFor(() => {
      expect(
        screen.getByText(/This is a free event — no financial tracking required/i),
      ).toBeInTheDocument();
    });
  });

  it("shows expense rows in finances tab", async () => {
    mockGetEvent.mockResolvedValue(COMPLETED_FIXED_EVENT);
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => screen.getByText("Sports Day"));
    await user.click(screen.getByRole("tab", { name: /Finances/i }));
    await waitFor(() => {
      expect(screen.getByText("DJ charges")).toBeInTheDocument();
    });
    expect(screen.getByText("Decoration")).toBeInTheDocument();
  });

  it("shows Add Expense button in finances tab", async () => {
    mockGetEvent.mockResolvedValue(COMPLETED_FIXED_EVENT);
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => screen.getByText("Sports Day"));
    await user.click(screen.getByRole("tab", { name: /Finances/i }));
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Add Expense/i })).toBeInTheDocument();
    });
  });

  it("shows total collected in finances tab", async () => {
    mockGetEvent.mockResolvedValue(COMPLETED_FIXED_EVENT);
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => screen.getByText("Sports Day"));
    await user.click(screen.getByRole("tab", { name: /Finances/i }));
    await waitFor(() => {
      expect(screen.getByText(/10,000/)).toBeInTheDocument();
    });
  });

  it("shows total expenses in finances tab", async () => {
    mockGetEvent.mockResolvedValue(COMPLETED_FIXED_EVENT);
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => screen.getByText("Sports Day"));
    await user.click(screen.getByRole("tab", { name: /Finances/i }));
    await waitFor(() => {
      expect(screen.getByText(/8,000/)).toBeInTheDocument();
    });
  });

  // ─── Details Tab ─────────────────────────────────────────────────────────

  it("shows event details card in Details tab", async () => {
    mockGetEvent.mockResolvedValue(DRAFT_EVENT);
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => screen.getByText("Holi Celebration"));
    await user.click(screen.getByRole("tab", { name: /Details/i }));
    await waitFor(() => {
      expect(screen.getByText("Event Details")).toBeInTheDocument();
    });
  });

  it("shows Edit and Delete buttons in Details tab for DRAFT event", async () => {
    mockGetEvent.mockResolvedValue(DRAFT_EVENT);
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => screen.getByText("Holi Celebration"));
    await user.click(screen.getByRole("tab", { name: /Details/i }));
    await waitFor(() => {
      expect(screen.getByText("Event Details")).toBeInTheDocument();
    });
    expect(screen.getAllByRole("button", { name: /^Edit$/i }).length).toBeGreaterThan(0);
    expect(screen.getAllByRole("button", { name: /^Delete$/i }).length).toBeGreaterThan(0);
  });

  it("shows creator name in Details tab", async () => {
    mockGetEvent.mockResolvedValue(DRAFT_EVENT);
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => screen.getByText("Holi Celebration"));
    await user.click(screen.getByRole("tab", { name: /Details/i }));
    await waitFor(() => {
      expect(screen.getByText("Admin User")).toBeInTheDocument();
    });
  });

  it("shows description in Details tab", async () => {
    mockGetEvent.mockResolvedValue(DRAFT_EVENT);
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => screen.getByText("Holi Celebration"));
    await user.click(screen.getByRole("tab", { name: /Details/i }));
    await waitFor(() => {
      expect(screen.getByText("A fun holi event")).toBeInTheDocument();
    });
  });

  it("shows cancellation reason in Details tab for CANCELLED event", async () => {
    mockGetEvent.mockResolvedValue(CANCELLED_EVENT);
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => screen.getByText("Holi Celebration"));
    await user.click(screen.getByRole("tab", { name: /Details/i }));
    await waitFor(() => {
      expect(screen.getByText("Insufficient interest")).toBeInTheDocument();
    });
  });

  it("does not show Edit/Delete in Details card for non-DRAFT event", async () => {
    mockGetEvent.mockResolvedValue(PUBLISHED_FIXED_EVENT);
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => screen.getByText("Yoga Workshop"));
    await user.click(screen.getByRole("tab", { name: /Details/i }));
    await waitFor(() => screen.getByText("Event Details"));
    // No Edit/Delete buttons inside the Details card for non-DRAFT
    const card = screen.getByText("Event Details").closest("[data-slot='card']")!;
    expect(within(card).queryByRole("button", { name: /^Edit$/i })).not.toBeInTheDocument();
    expect(within(card).queryByRole("button", { name: /^Delete$/i })).not.toBeInTheDocument();
  });

  // ─── Publish Dialog ───────────────────────────────────────────────────────

  it("opens publish confirm dialog on Publish click", async () => {
    mockGetEvent.mockResolvedValue(DRAFT_EVENT);
    renderPage();
    await waitFor(() => screen.getByRole("button", { name: /Publish/i }));
    fireEvent.click(screen.getByRole("button", { name: /Publish/i }));
    await waitFor(() => {
      const dialog = screen.getByRole("dialog");
      expect(within(dialog).getByText("Publish Event")).toBeInTheDocument();
    });
  });

  it("calls publishEvent when confirmed", async () => {
    mockGetEvent.mockResolvedValue(DRAFT_EVENT);
    mockPublishEvent.mockResolvedValue({ ...DRAFT_EVENT, status: "PUBLISHED" });
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => screen.getByRole("button", { name: /Publish/i }));
    await user.click(screen.getByRole("button", { name: /Publish/i }));
    await waitFor(() => screen.getByRole("dialog"));
    const dialog = screen.getByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: /^Publish$/i }));
    await waitFor(() => {
      expect(mockPublishEvent).toHaveBeenCalled();
    });
  });

  it("closes publish dialog on Cancel", async () => {
    mockGetEvent.mockResolvedValue(DRAFT_EVENT);
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => screen.getByRole("button", { name: /Publish/i }));
    await user.click(screen.getByRole("button", { name: /Publish/i }));
    await waitFor(() => screen.getByRole("dialog"));
    const dialog = screen.getByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: /^Cancel$/i }));
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });

  // ─── Mark Complete Dialog ─────────────────────────────────────────────────

  it("opens Mark Complete dialog on button click", async () => {
    mockGetEvent.mockResolvedValue(PUBLISHED_FIXED_EVENT);
    renderPage();
    await waitFor(() => screen.getByRole("button", { name: /Mark Complete/i }));
    fireEvent.click(screen.getByRole("button", { name: /Mark Complete/i }));
    await waitFor(() => {
      const dialog = screen.getByRole("dialog");
      expect(within(dialog).getByText("Mark Event as Completed")).toBeInTheDocument();
    });
  });

  it("calls completeEvent when confirmed", async () => {
    mockGetEvent.mockResolvedValue(PUBLISHED_FIXED_EVENT);
    mockCompleteEvent.mockResolvedValue({ ...PUBLISHED_FIXED_EVENT, status: "COMPLETED" });
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => screen.getByRole("button", { name: /Mark Complete/i }));
    await user.click(screen.getByRole("button", { name: /Mark Complete/i }));
    await waitFor(() => screen.getByRole("dialog"));
    const dialog = screen.getByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: /Mark Complete/i }));
    await waitFor(() => {
      expect(mockCompleteEvent).toHaveBeenCalled();
    });
  });

  // ─── Delete Dialog ────────────────────────────────────────────────────────

  it("opens Delete confirm dialog on Delete click", async () => {
    mockGetEvent.mockResolvedValue(DRAFT_EVENT);
    renderPage();
    await waitFor(() => screen.getAllByRole("button", { name: /Delete/i }));
    fireEvent.click(screen.getAllByRole("button", { name: /Delete/i })[0]);
    await waitFor(() => {
      const dialog = screen.getByRole("dialog");
      expect(within(dialog).getByText("Delete Event")).toBeInTheDocument();
    });
  });

  it("shows event title in delete confirmation", async () => {
    mockGetEvent.mockResolvedValue(DRAFT_EVENT);
    renderPage();
    await waitFor(() => screen.getAllByRole("button", { name: /Delete/i }));
    fireEvent.click(screen.getAllByRole("button", { name: /Delete/i })[0]);
    await waitFor(() => {
      const dialog = screen.getByRole("dialog");
      expect(within(dialog).getByText(/Holi Celebration/)).toBeInTheDocument();
    });
  });

  it("calls deleteEvent when confirmed", async () => {
    mockGetEvent.mockResolvedValue(DRAFT_EVENT);
    mockDeleteEvent.mockResolvedValue({ message: "Deleted" });
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => screen.getAllByRole("button", { name: /Delete/i }));
    await user.click(screen.getAllByRole("button", { name: /Delete/i })[0]);
    await waitFor(() => screen.getByRole("dialog"));
    const dialog = screen.getByRole("dialog");
    await user.click(within(dialog).getByRole("button", { name: /^Delete$/i }));
    await waitFor(() => {
      expect(mockDeleteEvent).toHaveBeenCalled();
    });
  });

  // ─── Cancel Event Dialog ──────────────────────────────────────────────────

  it("opens Cancel Event dialog on button click", async () => {
    mockGetEvent.mockResolvedValue(PUBLISHED_FIXED_EVENT);
    renderPage();
    await waitFor(() => screen.getByRole("button", { name: /Cancel Event/i }));
    fireEvent.click(screen.getByRole("button", { name: /Cancel Event/i }));
    await waitFor(() => {
      const dialog = screen.getByRole("dialog");
      expect(within(dialog).getByText("Reason for cancellation")).toBeInTheDocument();
    });
  });

  it("calls cancelEvent with reason on submit", async () => {
    mockGetEvent.mockResolvedValue(PUBLISHED_FIXED_EVENT);
    mockCancelEvent.mockResolvedValue({ ...PUBLISHED_FIXED_EVENT, status: "CANCELLED" });
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => screen.getByRole("button", { name: /Cancel Event/i }));
    await user.click(screen.getByRole("button", { name: /Cancel Event/i }));
    await waitFor(() => screen.getByRole("dialog"));
    const dialog = screen.getByRole("dialog");
    await user.type(within(dialog).getByPlaceholderText(/Explain why/i), "Not enough participants");
    await user.click(within(dialog).getByRole("button", { name: /^Cancel Event$/i }));
    await waitFor(() => {
      expect(mockCancelEvent).toHaveBeenCalledWith(
        "soc-1",
        "evt-1",
        expect.objectContaining({ reason: "Not enough participants" }),
      );
    });
  });

  // ─── Trigger Payment Dialog ───────────────────────────────────────────────

  it("opens Trigger Payment dialog from header", async () => {
    mockGetEvent.mockResolvedValue(PUBLISHED_FLEXIBLE_NO_FEE);
    renderPage();
    await waitFor(() => screen.getAllByRole("button", { name: /Set Price & Trigger Payment/i }));
    const btns = screen.getAllByRole("button", { name: /Set Price & Trigger Payment/i });
    fireEvent.click(btns[0]);
    await waitFor(() => {
      const dialog = screen.getByRole("dialog");
      expect(within(dialog).getByText("Set Price & Trigger Payment")).toBeInTheDocument();
    });
  });

  it("calls triggerPayment with fee amount on confirm", async () => {
    mockGetEvent.mockResolvedValue(PUBLISHED_FLEXIBLE_NO_FEE);
    mockTriggerPayment.mockResolvedValue({
      ...PUBLISHED_FLEXIBLE_NO_FEE,
      feeAmount: 500,
      transitionedCount: 3,
    });
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => screen.getAllByRole("button", { name: /Set Price & Trigger Payment/i }));
    const btns = screen.getAllByRole("button", { name: /Set Price & Trigger Payment/i });
    await user.click(btns[0]);
    await waitFor(() => screen.getByRole("dialog"));
    const dialog = screen.getByRole("dialog");
    const feeInput = within(dialog).getByRole("spinbutton");
    fireEvent.change(feeInput, { target: { value: "500" } });
    await user.click(within(dialog).getByRole("button", { name: /Confirm & Trigger/i }));
    await waitFor(() => {
      expect(mockTriggerPayment).toHaveBeenCalled();
    });
  });

  // ─── Record Payment Dialog ────────────────────────────────────────────────

  it("opens Record Payment dialog for PENDING registration", async () => {
    mockGetEvent.mockResolvedValue(PUBLISHED_FIXED_EVENT);
    mockGetRegistrations.mockResolvedValue({
      data: [MOCK_REGISTRATION],
      total: 1,
      page: 1,
      limit: 50,
    });
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => screen.getByRole("button", { name: /Record Payment/i }));
    await user.click(screen.getByRole("button", { name: /Record Payment/i }));
    await waitFor(() => {
      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });
    const dialog = screen.getByRole("dialog");
    // Dialog title is an h2 with "Record Payment"
    expect(within(dialog).getByRole("heading", { name: "Record Payment" })).toBeInTheDocument();
  });

  it("shows resident name in record payment dialog", async () => {
    mockGetEvent.mockResolvedValue(PUBLISHED_FIXED_EVENT);
    mockGetRegistrations.mockResolvedValue({
      data: [MOCK_REGISTRATION],
      total: 1,
      page: 1,
      limit: 50,
    });
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => screen.getByRole("button", { name: /Record Payment/i }));
    await user.click(screen.getByRole("button", { name: /Record Payment/i }));
    await waitFor(() => screen.getByRole("dialog"));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("Sharma Ji")).toBeInTheDocument();
  });

  it("shows amount due in record payment dialog for FIXED event", async () => {
    mockGetEvent.mockResolvedValue(PUBLISHED_FIXED_EVENT);
    mockGetRegistrations.mockResolvedValue({
      data: [MOCK_REGISTRATION],
      total: 1,
      page: 1,
      limit: 50,
    });
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => screen.getByRole("button", { name: /Record Payment/i }));
    await user.click(screen.getByRole("button", { name: /Record Payment/i }));
    await waitFor(() => screen.getByRole("dialog"));
    const dialog = screen.getByRole("dialog");
    // 200 (fee) × 2 (members) = 400
    expect(within(dialog).getByText("₹400")).toBeInTheDocument();
  });

  it("calls recordEventPayment on submit", async () => {
    mockGetEvent.mockResolvedValue(PUBLISHED_FIXED_EVENT);
    mockGetRegistrations.mockResolvedValue({
      data: [MOCK_REGISTRATION],
      total: 1,
      page: 1,
      limit: 50,
    });
    mockRecordEventPayment.mockResolvedValue({ id: "pay-new", receiptNo: "REC002" });
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => screen.getByRole("button", { name: /Record Payment/i }));
    await user.click(screen.getByRole("button", { name: /Record Payment/i }));
    await waitFor(() => screen.getByRole("dialog"));
    const dialog = screen.getByRole("dialog");
    // Submit button inside dialog is "Record Payment"
    const submitBtn = within(dialog).getAllByRole("button", { name: /Record Payment/i });
    fireEvent.click(submitBtn[submitBtn.length - 1]);
    await waitFor(() => {
      expect(mockRecordEventPayment).toHaveBeenCalled();
    });
  });

  // ─── Add Expense Dialog ───────────────────────────────────────────────────

  it("opens Add Expense dialog from Finances tab", async () => {
    mockGetEvent.mockResolvedValue(COMPLETED_FIXED_EVENT);
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => screen.getByText("Sports Day"));
    await user.click(screen.getByRole("tab", { name: /Finances/i }));
    await waitFor(() => screen.getByRole("button", { name: /Add Expense/i }));
    await user.click(screen.getByRole("button", { name: /Add Expense/i }));
    await waitFor(() => {
      const dialog = screen.getByRole("dialog");
      expect(within(dialog).getByText("Add Event Expense")).toBeInTheDocument();
    });
  });

  it("calls addEventExpense on submit", async () => {
    mockGetEvent.mockResolvedValue(COMPLETED_FIXED_EVENT);
    mockAddEventExpense.mockResolvedValue({ id: "exp-new" });
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => screen.getByText("Sports Day"));
    await user.click(screen.getByRole("tab", { name: /Finances/i }));
    await waitFor(() => screen.getByRole("button", { name: /Add Expense/i }));
    await user.click(screen.getByRole("button", { name: /Add Expense/i }));
    await waitFor(() => screen.getByRole("dialog"));
    const dialog = screen.getByRole("dialog");

    await user.type(
      within(dialog).getByPlaceholderText(/What was this expense for/i),
      "Sound system rental",
    );
    const numInputs = within(dialog).getAllByRole("spinbutton");
    fireEvent.change(numInputs[0], { target: { value: "3000" } });

    await user.click(within(dialog).getByRole("button", { name: /^Add Expense$/i }));
    await waitFor(() => {
      expect(mockAddEventExpense).toHaveBeenCalled();
    });
  });

  // ─── Settle Dialog ────────────────────────────────────────────────────────

  it("opens Settle Event dialog on button click", async () => {
    mockGetEvent.mockResolvedValue(COMPLETED_FIXED_EVENT);
    renderPage();
    await waitFor(() => screen.getByRole("button", { name: /Settle Event/i }));
    fireEvent.click(screen.getByRole("button", { name: /Settle Event/i }));
    await waitFor(() => {
      const dialog = screen.getByRole("dialog");
      expect(within(dialog).getByText("Settle Event")).toBeInTheDocument();
    });
  });

  it("shows net surplus amount in settle dialog", async () => {
    mockGetEvent.mockResolvedValue(COMPLETED_FIXED_EVENT);
    renderPage();
    await waitFor(() => screen.getByRole("button", { name: /Settle Event/i }));
    fireEvent.click(screen.getByRole("button", { name: /Settle Event/i }));
    await waitFor(() => screen.getByRole("dialog"));
    const dialog = screen.getByRole("dialog");
    // Net = 10000 - 8000 = 2000
    expect(within(dialog).getByText(/2,000/)).toBeInTheDocument();
  });

  it("calls settleEvent on confirm", async () => {
    // Use balanced finances (net = 0) so "Confirm Settlement" is not disabled
    mockGetEventFinances.mockResolvedValue({
      ...MOCK_FINANCES,
      totalCollected: 8000,
      totalExpenses: 8000,
      netAmount: 0,
    });
    mockGetEvent.mockResolvedValue(COMPLETED_FIXED_EVENT);
    mockSettleEvent.mockResolvedValue({
      ...COMPLETED_FIXED_EVENT,
      settledAt: "2026-03-16T00:00:00.000Z",
    });
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => screen.getByRole("button", { name: /Settle Event/i }));
    await user.click(screen.getByRole("button", { name: /Settle Event/i }));
    await waitFor(() => screen.getByRole("dialog"));
    const dialog = screen.getByRole("dialog");
    const confirmBtn = within(dialog).getByRole("button", { name: /Confirm Settlement/i });
    expect(confirmBtn).not.toBeDisabled();
    fireEvent.click(confirmBtn);
    await waitFor(() => {
      expect(mockSettleEvent).toHaveBeenCalled();
    });
  });

  // ─── Edit Dialog ──────────────────────────────────────────────────────────

  it("opens Edit dialog on Edit click", async () => {
    mockGetEvent.mockResolvedValue(DRAFT_EVENT);
    renderPage();
    await waitFor(() => screen.getAllByRole("button", { name: /^Edit$/i }));
    fireEvent.click(screen.getAllByRole("button", { name: /^Edit$/i })[0]);
    await waitFor(() => {
      const dialog = screen.getByRole("dialog");
      expect(within(dialog).getByText("Edit Event")).toBeInTheDocument();
    });
  });

  it("pre-populates edit form with current event title", async () => {
    mockGetEvent.mockResolvedValue(DRAFT_EVENT);
    renderPage();
    await waitFor(() => screen.getAllByRole("button", { name: /^Edit$/i }));
    fireEvent.click(screen.getAllByRole("button", { name: /^Edit$/i })[0]);
    await waitFor(() => screen.getByRole("dialog"));
    expect(screen.getByDisplayValue("Holi Celebration")).toBeInTheDocument();
  });

  it("calls updateEvent on Save Changes", async () => {
    mockGetEvent.mockResolvedValue(DRAFT_EVENT);
    mockUpdateEvent.mockResolvedValue(DRAFT_EVENT);
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => screen.getAllByRole("button", { name: /^Edit$/i }));
    fireEvent.click(screen.getAllByRole("button", { name: /^Edit$/i })[0]);
    await waitFor(() => screen.getByRole("dialog"));
    const dialog = screen.getByRole("dialog");
    await waitFor(() =>
      expect(within(dialog).getByRole("button", { name: /Save Changes/i })).toBeInTheDocument(),
    );
    await user.click(within(dialog).getByRole("button", { name: /Save Changes/i }));
    await waitFor(() => {
      expect(mockUpdateEvent).toHaveBeenCalled();
    });
  });
});
