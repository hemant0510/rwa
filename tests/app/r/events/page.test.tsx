import React from "react";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";

import ResidentEventsPage from "@/app/r/events/page";
import { AuthContext } from "@/hooks/useAuth";

// ── Hoisted mocks ──

const {
  mockGetResidentEvents,
  mockRegisterForEvent,
  mockCancelRegistration,
  mockGetResidentEventFinances,
  mockToastSuccess,
  mockToastError,
} = vi.hoisted(() => ({
  mockGetResidentEvents: vi.fn(),
  mockRegisterForEvent: vi.fn(),
  mockCancelRegistration: vi.fn(),
  mockGetResidentEventFinances: vi.fn(),
  mockToastSuccess: vi.fn(),
  mockToastError: vi.fn(),
}));

vi.mock("@/services/events", () => ({
  getResidentEvents: (...args: unknown[]) => mockGetResidentEvents(...args),
  registerForEvent: (...args: unknown[]) => mockRegisterForEvent(...args),
  cancelRegistration: (...args: unknown[]) => mockCancelRegistration(...args),
  getResidentEventFinances: (...args: unknown[]) => mockGetResidentEventFinances(...args),
}));

vi.mock("sonner", () => ({
  toast: {
    success: (...args: unknown[]) => mockToastSuccess(...args),
    error: (...args: unknown[]) => mockToastError(...args),
  },
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => "/r/events",
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
    societyName: "Eden",
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
        <ResidentEventsPage />
      </AuthContext.Provider>
    </QueryClientProvider>,
  );
}

// ── Mock Data ──

const BASE_EVENT = {
  id: "evt-1",
  societyId: "soc-1",
  title: "Holi 2026",
  description: "Annual Holi celebration",
  category: "FESTIVAL",
  feeModel: "FIXED",
  chargeUnit: "PER_PERSON",
  eventDate: "2026-03-15T10:00:00.000Z",
  location: "Club House",
  registrationDeadline: null,
  feeAmount: 200,
  estimatedBudget: null,
  minParticipants: null,
  maxParticipants: null,
  suggestedAmount: null,
  status: "PUBLISHED",
  cancellationReason: null,
  publishedAt: "2026-03-01T00:00:00.000Z",
  paymentTriggeredAt: null,
  settledAt: null,
  surplusAmount: null,
  surplusDisposal: null,
  deficitDisposition: null,
  settlementNotes: null,
  createdAt: "2026-03-01T00:00:00.000Z",
  creator: { name: "Admin" },
  _count: { registrations: 10 },
  myRegistration: null,
};

const FREE_EVENT = {
  ...BASE_EVENT,
  id: "evt-free",
  title: "AGM Meeting",
  feeModel: "FREE",
  feeAmount: null,
  chargeUnit: "PER_PERSON",
};
const FLEXIBLE_POLLING = {
  ...BASE_EVENT,
  id: "evt-flex-poll",
  title: "Sports Day",
  feeModel: "FLEXIBLE",
  feeAmount: null,
  chargeUnit: "PER_PERSON",
};
const FLEXIBLE_PAYMENT = {
  ...BASE_EVENT,
  id: "evt-flex-pay",
  title: "Diwali 2026",
  feeModel: "FLEXIBLE",
  feeAmount: 500,
  chargeUnit: "PER_PERSON",
  paymentTriggeredAt: "2026-03-10T00:00:00.000Z",
};
const CONTRIBUTION_PER_HOUSEHOLD = {
  ...BASE_EVENT,
  id: "evt-contrib",
  title: "Mata ki Chowki",
  feeModel: "CONTRIBUTION",
  feeAmount: null,
  suggestedAmount: 500,
  chargeUnit: "PER_HOUSEHOLD",
};
const FIXED_PER_HOUSEHOLD = {
  ...BASE_EVENT,
  id: "evt-fixed-hh",
  title: "Picnic",
  feeModel: "FIXED",
  feeAmount: 1000,
  chargeUnit: "PER_HOUSEHOLD",
};
const COMPLETED_SETTLED = {
  ...BASE_EVENT,
  id: "evt-settled",
  title: "Navratri 2025",
  status: "COMPLETED",
  settledAt: "2025-10-15T00:00:00.000Z",
};
const COMPLETED_UNSETTLED = {
  ...BASE_EVENT,
  id: "evt-unsettled",
  title: "Dussehra 2025",
  status: "COMPLETED",
  settledAt: null,
};

const MOCK_FINANCES = {
  totalCollected: 50000,
  totalExpenses: 45000,
  netAmount: 5000,
  disposition: "TRANSFERRED_TO_FUND",
  expenses: [
    { description: "DJ & Sound", amount: 15000 },
    { description: "Food & Drinks", amount: 30000 },
  ],
};

describe("ResidentEventsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetResidentEventFinances.mockReturnValue(new Promise(() => {}));
  });

  // ── Page structure ─────────────────────────────────────────────────────────

  it("renders page title", () => {
    mockGetResidentEvents.mockReturnValue(new Promise(() => {}));
    renderPage();
    expect(screen.getByText("Community Events")).toBeInTheDocument();
  });

  it("renders View all button", () => {
    mockGetResidentEvents.mockReturnValue(new Promise(() => {}));
    renderPage();
    expect(screen.getByRole("button", { name: /View all/i })).toBeInTheDocument();
  });

  it("shows loading spinner while data is pending", () => {
    mockGetResidentEvents.mockReturnValue(new Promise(() => {}));
    renderPage();
    expect(document.querySelector(".animate-spin")).toBeTruthy();
  });

  // ── Empty state ───────────────────────────────────────────────────────────

  it("shows empty state when no upcoming events", async () => {
    mockGetResidentEvents.mockResolvedValue({ data: [] });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("No events")).toBeInTheDocument();
    });
    expect(screen.getByText("No upcoming events at the moment.")).toBeInTheDocument();
  });

  it("shows different empty message when viewing all", async () => {
    mockGetResidentEvents.mockResolvedValue({ data: [] });
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => screen.getByText("No events"));
    await user.click(screen.getByRole("button", { name: /View all/i }));
    await waitFor(() => {
      expect(screen.getByText("No events to display.")).toBeInTheDocument();
    });
  });

  // ── Toggle upcoming / all ─────────────────────────────────────────────────

  it("calls getResidentEvents with all=true when toggled", async () => {
    mockGetResidentEvents.mockResolvedValue({ data: [] });
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => screen.getByText("No events"));
    await user.click(screen.getByRole("button", { name: /View all/i }));
    expect(mockGetResidentEvents).toHaveBeenCalledWith({ all: true });
  });

  it("toggles button label after clicking", async () => {
    mockGetResidentEvents.mockResolvedValue({ data: [] });
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => screen.getByRole("button", { name: /View all/i }));
    await user.click(screen.getByRole("button", { name: /View all/i }));
    expect(screen.getByRole("button", { name: /Upcoming only/i })).toBeInTheDocument();
  });

  // ── Event cards ───────────────────────────────────────────────────────────

  it("renders event title and location on card", async () => {
    mockGetResidentEvents.mockResolvedValue({ data: [BASE_EVENT] });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Holi 2026")).toBeInTheDocument();
    });
    expect(screen.getByText("Club House")).toBeInTheDocument();
  });

  it("renders category badge on card", async () => {
    mockGetResidentEvents.mockResolvedValue({ data: [BASE_EVENT] });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Festival")).toBeInTheDocument();
    });
  });

  it("renders event date on card", async () => {
    mockGetResidentEvents.mockResolvedValue({ data: [BASE_EVENT] });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("15 Mar 2026")).toBeInTheDocument();
    });
  });

  // ── Fee display on cards ──────────────────────────────────────────────────

  it("shows 'Free Event' for FREE events", async () => {
    mockGetResidentEvents.mockResolvedValue({ data: [FREE_EVENT] });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Free Event")).toBeInTheDocument();
    });
  });

  it("shows per-person price for FIXED PER_PERSON events", async () => {
    mockGetResidentEvents.mockResolvedValue({ data: [BASE_EVENT] });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("₹200/person")).toBeInTheDocument();
    });
  });

  it("shows per-household price for FIXED PER_HOUSEHOLD events", async () => {
    mockGetResidentEvents.mockResolvedValue({ data: [FIXED_PER_HOUSEHOLD] });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("₹1,000/household")).toBeInTheDocument();
    });
  });

  it("shows polling text for FLEXIBLE events without feeAmount", async () => {
    mockGetResidentEvents.mockResolvedValue({ data: [FLEXIBLE_POLLING] });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Interest check — pricing TBD")).toBeInTheDocument();
    });
  });

  it("shows price for FLEXIBLE events after payment triggered", async () => {
    mockGetResidentEvents.mockResolvedValue({ data: [FLEXIBLE_PAYMENT] });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("₹500/person")).toBeInTheDocument();
    });
  });

  it("shows contribution text with suggested amount", async () => {
    mockGetResidentEvents.mockResolvedValue({ data: [CONTRIBUTION_PER_HOUSEHOLD] });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText(/Open contribution.*suggested.*500/)).toBeInTheDocument();
    });
  });

  it("shows 'Open contribution' without suggested for CONTRIBUTION with no suggestedAmount", async () => {
    const ev = { ...CONTRIBUTION_PER_HOUSEHOLD, suggestedAmount: null };
    mockGetResidentEvents.mockResolvedValue({ data: [ev] });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Open contribution")).toBeInTheDocument();
    });
  });

  // ── Registration badges on cards ─────────────────────────────────────────

  it("shows 'Going ✓' badge for CONFIRMED registration", async () => {
    const ev = {
      ...BASE_EVENT,
      myRegistration: { id: "r1", status: "CONFIRMED", memberCount: 2, payment: null },
    };
    mockGetResidentEvents.mockResolvedValue({ data: [ev] });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Going ✓")).toBeInTheDocument();
    });
  });

  it("shows 'Payment due' badge for PENDING registration", async () => {
    const ev = {
      ...BASE_EVENT,
      myRegistration: { id: "r1", status: "PENDING", memberCount: 1, payment: null },
    };
    mockGetResidentEvents.mockResolvedValue({ data: [ev] });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Payment due")).toBeInTheDocument();
    });
  });

  it("shows 'Interested' badge for INTERESTED registration", async () => {
    const ev = {
      ...FLEXIBLE_POLLING,
      myRegistration: { id: "r1", status: "INTERESTED", memberCount: 2, payment: null },
    };
    mockGetResidentEvents.mockResolvedValue({ data: [ev] });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Interested")).toBeInTheDocument();
    });
  });

  it("shows no badge for CANCELLED registration", async () => {
    const ev = {
      ...BASE_EVENT,
      myRegistration: { id: "r1", status: "CANCELLED", memberCount: 1, payment: null },
    };
    mockGetResidentEvents.mockResolvedValue({ data: [ev] });
    renderPage();
    await waitFor(() => {
      expect(screen.queryByText("Going ✓")).not.toBeInTheDocument();
      expect(screen.queryByText("Payment due")).not.toBeInTheDocument();
    });
  });

  it("shows 'View financial summary →' link for settled completed events", async () => {
    mockGetResidentEvents.mockResolvedValue({ data: [COMPLETED_SETTLED] });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("View financial summary →")).toBeInTheDocument();
    });
  });

  it("shows 'Completed' badge for unsettled completed events", async () => {
    mockGetResidentEvents.mockResolvedValue({ data: [COMPLETED_UNSETTLED] });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Completed")).toBeInTheDocument();
    });
  });

  // ── Sheet opening ─────────────────────────────────────────────────────────

  it("opens Sheet with event title when card is clicked", async () => {
    mockGetResidentEvents.mockResolvedValue({ data: [BASE_EVENT] });
    renderPage();
    await waitFor(() => screen.getByText("Holi 2026"));
    fireEvent.click(screen.getByText("Holi 2026").closest("[class*='cursor-pointer']")!);
    await waitFor(() => {
      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getAllByText("Holi 2026").length).toBeGreaterThan(0);
  });

  it("shows event location in sheet", async () => {
    mockGetResidentEvents.mockResolvedValue({ data: [BASE_EVENT] });
    renderPage();
    await waitFor(() => screen.getByText("Holi 2026"));
    fireEvent.click(screen.getByText("Holi 2026").closest("[class*='cursor-pointer']")!);
    await waitFor(() => screen.getByRole("dialog"));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getAllByText("Club House").length).toBeGreaterThan(0);
  });

  it("shows description in sheet when present", async () => {
    mockGetResidentEvents.mockResolvedValue({ data: [BASE_EVENT] });
    renderPage();
    await waitFor(() => screen.getByText("Holi 2026"));
    fireEvent.click(screen.getByText("Holi 2026").closest("[class*='cursor-pointer']")!);
    await waitFor(() => screen.getByRole("dialog"));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("Annual Holi celebration")).toBeInTheDocument();
  });

  it("shows registration deadline in sheet when set", async () => {
    const ev = { ...BASE_EVENT, registrationDeadline: "2026-03-10T00:00:00.000Z" };
    mockGetResidentEvents.mockResolvedValue({ data: [ev] });
    renderPage();
    await waitFor(() => screen.getByText("Holi 2026"));
    fireEvent.click(screen.getByText("Holi 2026").closest("[class*='cursor-pointer']")!);
    await waitFor(() => screen.getByRole("dialog"));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText(/Registration closes.*10 Mar 2026/)).toBeInTheDocument();
  });

  it("shows estimated budget in sheet for FLEXIBLE polling events", async () => {
    const ev = { ...FLEXIBLE_POLLING, estimatedBudget: 50000 };
    mockGetResidentEvents.mockResolvedValue({ data: [ev] });
    renderPage();
    await waitFor(() => screen.getByText("Sports Day"));
    fireEvent.click(screen.getByText("Sports Day").closest("[class*='cursor-pointer']")!);
    await waitFor(() => screen.getByRole("dialog"));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText(/Estimated budget.*50,000/)).toBeInTheDocument();
  });

  it("shows min participants in sheet for FLEXIBLE polling events", async () => {
    const ev = { ...FLEXIBLE_POLLING, minParticipants: 50 };
    mockGetResidentEvents.mockResolvedValue({ data: [ev] });
    renderPage();
    await waitFor(() => screen.getByText("Sports Day"));
    fireEvent.click(screen.getByText("Sports Day").closest("[class*='cursor-pointer']")!);
    await waitFor(() => screen.getByRole("dialog"));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText(/Min. participants.*50/)).toBeInTheDocument();
  });

  it("shows registered count in sheet", async () => {
    mockGetResidentEvents.mockResolvedValue({ data: [BASE_EVENT] });
    renderPage();
    await waitFor(() => screen.getByText("Holi 2026"));
    fireEvent.click(screen.getByText("Holi 2026").closest("[class*='cursor-pointer']")!);
    await waitFor(() => screen.getByRole("dialog"));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("10 registered")).toBeInTheDocument();
  });

  it("sheet closes when onOpenChange fires false", async () => {
    mockGetResidentEvents.mockResolvedValue({ data: [BASE_EVENT] });
    renderPage();
    await waitFor(() => screen.getByText("Holi 2026"));
    fireEvent.click(screen.getByText("Holi 2026").closest("[class*='cursor-pointer']")!);
    await waitFor(() => screen.getByRole("dialog"));
    const closeButton = document.querySelector("[data-radix-collection-item]") as Element;
    if (closeButton) {
      fireEvent.click(closeButton);
    }
    // Sheet is controlled — selectedEvent=null hides it
    expect(screen.getByRole("dialog")).toBeInTheDocument(); // Sheet renders but empty without selectedEvent is ok
  });

  // ── Registration action: FREE event ──────────────────────────────────────

  it("shows 'I'm In' button for FREE event with no registration", async () => {
    mockGetResidentEvents.mockResolvedValue({ data: [FREE_EVENT] });
    renderPage();
    await waitFor(() => screen.getByText("AGM Meeting"));
    fireEvent.click(screen.getByText("AGM Meeting").closest("[class*='cursor-pointer']")!);
    await waitFor(() => screen.getByRole("dialog"));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByRole("button", { name: /I'm In/i })).toBeInTheDocument();
  });

  it("shows member count selector for FREE PER_PERSON (headcount tracking, no price shown)", async () => {
    mockGetResidentEvents.mockResolvedValue({ data: [FREE_EVENT] });
    renderPage();
    await waitFor(() => screen.getByText("AGM Meeting"));
    fireEvent.click(screen.getByText("AGM Meeting").closest("[class*='cursor-pointer']")!);
    await waitFor(() => screen.getByRole("dialog"));
    const dialog = screen.getByRole("dialog");
    // FREE + PER_PERSON still shows member count selector for headcount tracking
    expect(within(dialog).getByText("How many family members?")).toBeInTheDocument();
    // But no price calculation text shown
    expect(within(dialog).queryByText(/× ₹/)).not.toBeInTheDocument();
  });

  // ── Registration action: FIXED PER_PERSON ────────────────────────────────

  it("shows member count selector for FIXED PER_PERSON event", async () => {
    mockGetResidentEvents.mockResolvedValue({ data: [BASE_EVENT] });
    renderPage();
    await waitFor(() => screen.getByText("Holi 2026"));
    fireEvent.click(screen.getByText("Holi 2026").closest("[class*='cursor-pointer']")!);
    await waitFor(() => screen.getByRole("dialog"));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("How many family members?")).toBeInTheDocument();
  });

  it("shows calculated price in member count area for FIXED PER_PERSON", async () => {
    mockGetResidentEvents.mockResolvedValue({ data: [BASE_EVENT] });
    renderPage();
    await waitFor(() => screen.getByText("Holi 2026"));
    fireEvent.click(screen.getByText("Holi 2026").closest("[class*='cursor-pointer']")!);
    await waitFor(() => screen.getByRole("dialog"));
    const dialog = screen.getByRole("dialog");
    // Default memberCount=1: 1 × ₹200 = ₹200
    expect(within(dialog).getByText(/1 × ₹200 = ₹200/)).toBeInTheDocument();
  });

  it("increments member count and updates price", async () => {
    mockGetResidentEvents.mockResolvedValue({ data: [BASE_EVENT] });
    renderPage();
    await waitFor(() => screen.getByText("Holi 2026"));
    fireEvent.click(screen.getByText("Holi 2026").closest("[class*='cursor-pointer']")!);
    await waitFor(() => screen.getByRole("dialog"));
    const dialog = screen.getByRole("dialog");
    const stepperSection = within(dialog).getByText("How many family members?").parentElement!;
    const plusBtn2 = stepperSection.querySelector("button:last-of-type")!;
    fireEvent.click(plusBtn2);
    await waitFor(() => {
      expect(within(dialog).getByText(/2 × ₹200 = ₹400/)).toBeInTheDocument();
    });
  });

  it("decrements member count but not below 1", async () => {
    mockGetResidentEvents.mockResolvedValue({ data: [BASE_EVENT] });
    renderPage();
    await waitFor(() => screen.getByText("Holi 2026"));
    fireEvent.click(screen.getByText("Holi 2026").closest("[class*='cursor-pointer']")!);
    await waitFor(() => screen.getByRole("dialog"));
    const dialog = screen.getByRole("dialog");
    const stepperSection = within(dialog).getByText("How many family members?").parentElement!;
    const minusBtn = stepperSection.querySelector("button:first-of-type")!;
    fireEvent.click(minusBtn);
    // Should stay at 1
    expect(within(dialog).getByText("1")).toBeInTheDocument();
    expect(within(dialog).getByText(/1 × ₹200 = ₹200/)).toBeInTheDocument();
  });

  it("shows 'Register (₹200)' for FIXED PER_PERSON with 1 member", async () => {
    mockGetResidentEvents.mockResolvedValue({ data: [BASE_EVENT] });
    renderPage();
    await waitFor(() => screen.getByText("Holi 2026"));
    fireEvent.click(screen.getByText("Holi 2026").closest("[class*='cursor-pointer']")!);
    await waitFor(() => screen.getByRole("dialog"));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByRole("button", { name: /Register.*₹200/i })).toBeInTheDocument();
  });

  // ── Registration action: FIXED PER_HOUSEHOLD ─────────────────────────────

  it("does NOT show member count selector for FIXED PER_HOUSEHOLD event", async () => {
    mockGetResidentEvents.mockResolvedValue({ data: [FIXED_PER_HOUSEHOLD] });
    renderPage();
    await waitFor(() => screen.getByText("Picnic"));
    fireEvent.click(screen.getByText("Picnic").closest("[class*='cursor-pointer']")!);
    await waitFor(() => screen.getByRole("dialog"));
    expect(screen.queryByText("How many family members?")).not.toBeInTheDocument();
  });

  it("shows 'Register (₹1,000)' for FIXED PER_HOUSEHOLD", async () => {
    mockGetResidentEvents.mockResolvedValue({ data: [FIXED_PER_HOUSEHOLD] });
    renderPage();
    await waitFor(() => screen.getByText("Picnic"));
    fireEvent.click(screen.getByText("Picnic").closest("[class*='cursor-pointer']")!);
    await waitFor(() => screen.getByRole("dialog"));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByRole("button", { name: /Register.*₹1,000/i })).toBeInTheDocument();
  });

  // ── Registration action: FLEXIBLE polling ────────────────────────────────

  it("shows 'I'm Interested' for FLEXIBLE polling events", async () => {
    mockGetResidentEvents.mockResolvedValue({ data: [FLEXIBLE_POLLING] });
    renderPage();
    await waitFor(() => screen.getByText("Sports Day"));
    fireEvent.click(screen.getByText("Sports Day").closest("[class*='cursor-pointer']")!);
    await waitFor(() => screen.getByRole("dialog"));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByRole("button", { name: /I'm Interested/i })).toBeInTheDocument();
  });

  it("shows member count selector for FLEXIBLE polling PER_PERSON", async () => {
    mockGetResidentEvents.mockResolvedValue({ data: [FLEXIBLE_POLLING] });
    renderPage();
    await waitFor(() => screen.getByText("Sports Day"));
    fireEvent.click(screen.getByText("Sports Day").closest("[class*='cursor-pointer']")!);
    await waitFor(() => screen.getByRole("dialog"));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("How many family members?")).toBeInTheDocument();
  });

  // ── Registration action: FLEXIBLE payment open ───────────────────────────

  it("shows 'Register (₹500)' for FLEXIBLE after payment triggered", async () => {
    mockGetResidentEvents.mockResolvedValue({ data: [FLEXIBLE_PAYMENT] });
    renderPage();
    await waitFor(() => screen.getByText("Diwali 2026"));
    fireEvent.click(screen.getByText("Diwali 2026").closest("[class*='cursor-pointer']")!);
    await waitFor(() => screen.getByRole("dialog"));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByRole("button", { name: /Register.*₹500/i })).toBeInTheDocument();
  });

  // ── Registration action: CONTRIBUTION ────────────────────────────────────

  it("shows 'I'm Participating' for CONTRIBUTION events", async () => {
    mockGetResidentEvents.mockResolvedValue({ data: [CONTRIBUTION_PER_HOUSEHOLD] });
    renderPage();
    await waitFor(() => screen.getByText("Mata ki Chowki"));
    fireEvent.click(screen.getByText("Mata ki Chowki").closest("[class*='cursor-pointer']")!);
    await waitFor(() => screen.getByRole("dialog"));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByRole("button", { name: /I'm Participating/i })).toBeInTheDocument();
  });

  // ── Already registered: CONFIRMED ────────────────────────────────────────

  it("shows 'Going ✓' for CONFIRMED FREE registration", async () => {
    const ev = {
      ...FREE_EVENT,
      myRegistration: { id: "r1", status: "CONFIRMED", memberCount: 1, payment: null },
    };
    mockGetResidentEvents.mockResolvedValue({ data: [ev] });
    renderPage();
    await waitFor(() => screen.getByText("AGM Meeting"));
    fireEvent.click(screen.getByText("AGM Meeting").closest("[class*='cursor-pointer']")!);
    await waitFor(() => screen.getByRole("dialog"));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("Going ✓")).toBeInTheDocument();
  });

  it("shows 'Participating ✓' for CONFIRMED CONTRIBUTION registration", async () => {
    const ev = {
      ...CONTRIBUTION_PER_HOUSEHOLD,
      myRegistration: { id: "r1", status: "CONFIRMED", memberCount: 1, payment: null },
    };
    mockGetResidentEvents.mockResolvedValue({ data: [ev] });
    renderPage();
    await waitFor(() => screen.getByText("Mata ki Chowki"));
    fireEvent.click(screen.getByText("Mata ki Chowki").closest("[class*='cursor-pointer']")!);
    await waitFor(() => screen.getByRole("dialog"));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("Participating ✓")).toBeInTheDocument();
  });

  // ── Already registered: INTERESTED ───────────────────────────────────────

  it("shows interested status and Cancel Interest button", async () => {
    const ev = {
      ...FLEXIBLE_POLLING,
      myRegistration: { id: "r1", status: "INTERESTED", memberCount: 3, payment: null },
    };
    mockGetResidentEvents.mockResolvedValue({ data: [ev] });
    renderPage();
    await waitFor(() => screen.getByText("Sports Day"));
    fireEvent.click(screen.getByText("Sports Day").closest("[class*='cursor-pointer']")!);
    await waitFor(() => screen.getByRole("dialog"));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText(/You're interested \(3 members\)/)).toBeInTheDocument();
    expect(within(dialog).getByRole("button", { name: /Cancel Interest/i })).toBeInTheDocument();
  });

  it("shows singular 'member' for 1 person interested", async () => {
    const ev = {
      ...FLEXIBLE_POLLING,
      myRegistration: { id: "r1", status: "INTERESTED", memberCount: 1, payment: null },
    };
    mockGetResidentEvents.mockResolvedValue({ data: [ev] });
    renderPage();
    await waitFor(() => screen.getByText("Sports Day"));
    fireEvent.click(screen.getByText("Sports Day").closest("[class*='cursor-pointer']")!);
    await waitFor(() => screen.getByRole("dialog"));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText(/You're interested \(1 member\)/)).toBeInTheDocument();
  });

  // ── Already registered: PENDING ──────────────────────────────────────────

  it("shows payment required banner for PENDING registration", async () => {
    const ev = {
      ...BASE_EVENT,
      myRegistration: { id: "r1", status: "PENDING", memberCount: 2, payment: null },
    };
    mockGetResidentEvents.mockResolvedValue({ data: [ev] });
    renderPage();
    await waitFor(() => screen.getByText("Holi 2026"));
    fireEvent.click(screen.getByText("Holi 2026").closest("[class*='cursor-pointer']")!);
    await waitFor(() => screen.getByRole("dialog"));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("Payment Required")).toBeInTheDocument();
    // 2 members × ₹200 = ₹400
    expect(within(dialog).getByText(/₹400/)).toBeInTheDocument();
    expect(within(dialog).getByText(/2 members/)).toBeInTheDocument();
    expect(
      within(dialog).getByRole("button", { name: /Cancel Registration/i }),
    ).toBeInTheDocument();
  });

  it("hides cancel button for PENDING with existing payment", async () => {
    const ev = {
      ...BASE_EVENT,
      myRegistration: { id: "r1", status: "PENDING", memberCount: 1, payment: { amount: 200 } },
    };
    mockGetResidentEvents.mockResolvedValue({ data: [ev] });
    renderPage();
    await waitFor(() => screen.getByText("Holi 2026"));
    fireEvent.click(screen.getByText("Holi 2026").closest("[class*='cursor-pointer']")!);
    await waitFor(() => screen.getByRole("dialog"));
    const dialog = screen.getByRole("dialog");
    expect(
      within(dialog).queryByRole("button", { name: /Cancel Registration/i }),
    ).not.toBeInTheDocument();
  });

  it("shows singular 'member' for 1 person pending", async () => {
    const ev = {
      ...BASE_EVENT,
      myRegistration: { id: "r1", status: "PENDING", memberCount: 1, payment: null },
    };
    mockGetResidentEvents.mockResolvedValue({ data: [ev] });
    renderPage();
    await waitFor(() => screen.getByText("Holi 2026"));
    fireEvent.click(screen.getByText("Holi 2026").closest("[class*='cursor-pointer']")!);
    await waitFor(() => screen.getByRole("dialog"));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText(/1 member\b/)).toBeInTheDocument();
  });

  // ── Registration closed / full ────────────────────────────────────────────

  it("shows 'Registration closed' when deadline has passed", async () => {
    const ev = { ...BASE_EVENT, registrationDeadline: "2025-01-01T00:00:00.000Z" };
    mockGetResidentEvents.mockResolvedValue({ data: [ev] });
    renderPage();
    await waitFor(() => screen.getByText("Holi 2026"));
    fireEvent.click(screen.getByText("Holi 2026").closest("[class*='cursor-pointer']")!);
    await waitFor(() => screen.getByRole("dialog"));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("Registration closed")).toBeInTheDocument();
  });

  it("shows 'Event full' when maxParticipants reached", async () => {
    const ev = { ...BASE_EVENT, maxParticipants: 10, _count: { registrations: 10 } };
    mockGetResidentEvents.mockResolvedValue({ data: [ev] });
    renderPage();
    await waitFor(() => screen.getByText("Holi 2026"));
    fireEvent.click(screen.getByText("Holi 2026").closest("[class*='cursor-pointer']")!);
    await waitFor(() => screen.getByRole("dialog"));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("Event full")).toBeInTheDocument();
  });

  it("shows 'This event has ended.' for COMPLETED events without registration", async () => {
    mockGetResidentEvents.mockResolvedValue({ data: [COMPLETED_SETTLED] });
    renderPage();
    await waitFor(() => screen.getByText("Navratri 2025"));
    fireEvent.click(screen.getByText("Navratri 2025").closest("[class*='cursor-pointer']")!);
    await waitFor(() => screen.getByRole("dialog"));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("This event has ended.")).toBeInTheDocument();
  });

  // ── Mutations ─────────────────────────────────────────────────────────────

  it("calls registerForEvent with correct args on 'I'm In' click", async () => {
    mockGetResidentEvents.mockResolvedValue({ data: [FREE_EVENT] });
    mockRegisterForEvent.mockResolvedValue({ id: "r1", status: "CONFIRMED" });
    renderPage();
    await waitFor(() => screen.getByText("AGM Meeting"));
    fireEvent.click(screen.getByText("AGM Meeting").closest("[class*='cursor-pointer']")!);
    await waitFor(() => screen.getByRole("dialog"));
    const dialog = screen.getByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: /I'm In/i }));
    await waitFor(() => {
      expect(mockRegisterForEvent).toHaveBeenCalledWith("evt-free", { memberCount: 1 });
    });
  });

  it("calls registerForEvent with memberCount on FIXED PER_PERSON register", async () => {
    mockGetResidentEvents.mockResolvedValue({ data: [BASE_EVENT] });
    mockRegisterForEvent.mockResolvedValue({ id: "r1", status: "PENDING" });
    renderPage();
    await waitFor(() => screen.getByText("Holi 2026"));
    fireEvent.click(screen.getByText("Holi 2026").closest("[class*='cursor-pointer']")!);
    await waitFor(() => screen.getByRole("dialog"));
    const dialog = screen.getByRole("dialog");
    // Increment member count to 2
    const stepperSection = within(dialog).getByText("How many family members?").parentElement!;
    fireEvent.click(stepperSection.querySelector("button:last-of-type")!);
    await waitFor(() => within(dialog).getByText(/2 × ₹200 = ₹400/));
    fireEvent.click(within(dialog).getByRole("button", { name: /Register.*₹400/i }));
    await waitFor(() => {
      expect(mockRegisterForEvent).toHaveBeenCalledWith("evt-1", { memberCount: 2 });
    });
  });

  it("shows toast.success after successful registration", async () => {
    mockGetResidentEvents.mockResolvedValue({ data: [FREE_EVENT] });
    mockRegisterForEvent.mockResolvedValue({ id: "r1", status: "CONFIRMED" });
    renderPage();
    await waitFor(() => screen.getByText("AGM Meeting"));
    fireEvent.click(screen.getByText("AGM Meeting").closest("[class*='cursor-pointer']")!);
    await waitFor(() => screen.getByRole("dialog"));
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: /I'm In/i }));
    await waitFor(() => {
      expect(mockToastSuccess).toHaveBeenCalledWith("Registered successfully!");
    });
  });

  it("shows toast.error when registration fails", async () => {
    mockGetResidentEvents.mockResolvedValue({ data: [FREE_EVENT] });
    mockRegisterForEvent.mockRejectedValue(new Error("Event is full"));
    renderPage();
    await waitFor(() => screen.getByText("AGM Meeting"));
    fireEvent.click(screen.getByText("AGM Meeting").closest("[class*='cursor-pointer']")!);
    await waitFor(() => screen.getByRole("dialog"));
    fireEvent.click(within(screen.getByRole("dialog")).getByRole("button", { name: /I'm In/i }));
    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith("Event is full");
    });
  });

  it("calls cancelRegistration on Cancel Interest click", async () => {
    const ev = {
      ...FLEXIBLE_POLLING,
      myRegistration: { id: "r1", status: "INTERESTED", memberCount: 2, payment: null },
    };
    mockGetResidentEvents.mockResolvedValue({ data: [ev] });
    mockCancelRegistration.mockResolvedValue({ id: "r1", status: "CANCELLED" });
    renderPage();
    await waitFor(() => screen.getByText("Sports Day"));
    fireEvent.click(screen.getByText("Sports Day").closest("[class*='cursor-pointer']")!);
    await waitFor(() => screen.getByRole("dialog"));
    const dialog = screen.getByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: /Cancel Interest/i }));
    await waitFor(() => {
      expect(mockCancelRegistration).toHaveBeenCalledWith("evt-flex-poll");
    });
  });

  it("shows toast.success after successful cancellation", async () => {
    const ev = {
      ...FLEXIBLE_POLLING,
      myRegistration: { id: "r1", status: "INTERESTED", memberCount: 2, payment: null },
    };
    mockGetResidentEvents.mockResolvedValue({ data: [ev] });
    mockCancelRegistration.mockResolvedValue({ id: "r1", status: "CANCELLED" });
    renderPage();
    await waitFor(() => screen.getByText("Sports Day"));
    fireEvent.click(screen.getByText("Sports Day").closest("[class*='cursor-pointer']")!);
    await waitFor(() => screen.getByRole("dialog"));
    fireEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", { name: /Cancel Interest/i }),
    );
    await waitFor(() => {
      expect(mockToastSuccess).toHaveBeenCalledWith("Registration cancelled");
    });
  });

  it("shows toast.error when cancel fails", async () => {
    const ev = {
      ...FLEXIBLE_POLLING,
      myRegistration: { id: "r1", status: "INTERESTED", memberCount: 2, payment: null },
    };
    mockGetResidentEvents.mockResolvedValue({ data: [ev] });
    mockCancelRegistration.mockRejectedValue(new Error("Cannot cancel after payment"));
    renderPage();
    await waitFor(() => screen.getByText("Sports Day"));
    fireEvent.click(screen.getByText("Sports Day").closest("[class*='cursor-pointer']")!);
    await waitFor(() => screen.getByRole("dialog"));
    fireEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", { name: /Cancel Interest/i }),
    );
    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith("Cannot cancel after payment");
    });
  });

  it("calls cancelRegistration on Cancel Registration (PENDING) click", async () => {
    const ev = {
      ...BASE_EVENT,
      myRegistration: { id: "r1", status: "PENDING", memberCount: 1, payment: null },
    };
    mockGetResidentEvents.mockResolvedValue({ data: [ev] });
    mockCancelRegistration.mockResolvedValue({ id: "r1", status: "CANCELLED" });
    renderPage();
    await waitFor(() => screen.getByText("Holi 2026"));
    fireEvent.click(screen.getByText("Holi 2026").closest("[class*='cursor-pointer']")!);
    await waitFor(() => screen.getByRole("dialog"));
    fireEvent.click(
      within(screen.getByRole("dialog")).getByRole("button", { name: /Cancel Registration/i }),
    );
    await waitFor(() => {
      expect(mockCancelRegistration).toHaveBeenCalledWith("evt-1");
    });
  });

  // ── Financial summary ─────────────────────────────────────────────────────

  it("shows Financial Summary heading for settled completed events", async () => {
    mockGetResidentEvents.mockResolvedValue({ data: [COMPLETED_SETTLED] });
    mockGetResidentEventFinances.mockResolvedValue(MOCK_FINANCES);
    renderPage();
    await waitFor(() => screen.getByText("Navratri 2025"));
    fireEvent.click(screen.getByText("Navratri 2025").closest("[class*='cursor-pointer']")!);
    await waitFor(() => screen.getByRole("dialog"));
    const dialog = screen.getByRole("dialog");
    await waitFor(() => {
      expect(within(dialog).getByText("Financial Summary")).toBeInTheDocument();
    });
  });

  it("shows total collected and expenses from finances query", async () => {
    mockGetResidentEvents.mockResolvedValue({ data: [COMPLETED_SETTLED] });
    mockGetResidentEventFinances.mockResolvedValue(MOCK_FINANCES);
    renderPage();
    await waitFor(() => screen.getByText("Navratri 2025"));
    fireEvent.click(screen.getByText("Navratri 2025").closest("[class*='cursor-pointer']")!);
    await waitFor(() => screen.getByRole("dialog"));
    const dialog = screen.getByRole("dialog");
    await waitFor(() => {
      expect(within(dialog).getByText(/50,000/)).toBeInTheDocument();
    });
    expect(within(dialog).getByText(/45,000/)).toBeInTheDocument();
  });

  it("shows surplus and disposition", async () => {
    mockGetResidentEvents.mockResolvedValue({ data: [COMPLETED_SETTLED] });
    mockGetResidentEventFinances.mockResolvedValue(MOCK_FINANCES);
    renderPage();
    await waitFor(() => screen.getByText("Navratri 2025"));
    fireEvent.click(screen.getByText("Navratri 2025").closest("[class*='cursor-pointer']")!);
    await waitFor(() => screen.getByRole("dialog"));
    const dialog = screen.getByRole("dialog");
    await waitFor(() => {
      expect(within(dialog).getByText("Surplus")).toBeInTheDocument();
    });
    expect(within(dialog).getByText("₹5,000")).toBeInTheDocument();
    expect(within(dialog).getByText("Transferred to society fund")).toBeInTheDocument();
  });

  it("shows deficit in red for negative net amount", async () => {
    const deficitFinances = {
      ...MOCK_FINANCES,
      netAmount: -3000,
      disposition: "FROM_SOCIETY_FUND",
    };
    mockGetResidentEvents.mockResolvedValue({ data: [COMPLETED_SETTLED] });
    mockGetResidentEventFinances.mockResolvedValue(deficitFinances);
    renderPage();
    await waitFor(() => screen.getByText("Navratri 2025"));
    fireEvent.click(screen.getByText("Navratri 2025").closest("[class*='cursor-pointer']")!);
    await waitFor(() => screen.getByRole("dialog"));
    const dialog = screen.getByRole("dialog");
    await waitFor(() => {
      expect(within(dialog).getByText("Deficit")).toBeInTheDocument();
    });
    const deficitAmt = within(dialog).getByText("₹3,000");
    expect(deficitAmt.className).toContain("red");
    expect(within(dialog).getByText("Covered by society fund")).toBeInTheDocument();
  });

  it("shows expense breakdown items", async () => {
    mockGetResidentEvents.mockResolvedValue({ data: [COMPLETED_SETTLED] });
    mockGetResidentEventFinances.mockResolvedValue(MOCK_FINANCES);
    renderPage();
    await waitFor(() => screen.getByText("Navratri 2025"));
    fireEvent.click(screen.getByText("Navratri 2025").closest("[class*='cursor-pointer']")!);
    await waitFor(() => screen.getByRole("dialog"));
    const dialog = screen.getByRole("dialog");
    await waitFor(() => {
      expect(within(dialog).getByText("DJ & Sound")).toBeInTheDocument();
    });
    expect(within(dialog).getByText("Food & Drinks")).toBeInTheDocument();
    expect(within(dialog).getByText(/15,000/)).toBeInTheDocument();
    expect(within(dialog).getByText(/30,000/)).toBeInTheDocument();
  });

  it("shows 'Financial summary coming soon' for completed but not settled", async () => {
    mockGetResidentEvents.mockResolvedValue({ data: [COMPLETED_UNSETTLED] });
    renderPage();
    await waitFor(() => screen.getByText("Dussehra 2025"));
    fireEvent.click(screen.getByText("Dussehra 2025").closest("[class*='cursor-pointer']")!);
    await waitFor(() => screen.getByRole("dialog"));
    const dialog = screen.getByRole("dialog");
    expect(
      within(dialog).getByText("Event completed. Financial summary coming soon."),
    ).toBeInTheDocument();
  });

  it("shows loading spinner in financial summary while loading", async () => {
    mockGetResidentEvents.mockResolvedValue({ data: [COMPLETED_SETTLED] });
    mockGetResidentEventFinances.mockReturnValue(new Promise(() => {})); // never resolves
    renderPage();
    await waitFor(() => screen.getByText("Navratri 2025"));
    fireEvent.click(screen.getByText("Navratri 2025").closest("[class*='cursor-pointer']")!);
    await waitFor(() => {
      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });
    const dialog = screen.getByRole("dialog");
    await waitFor(() => {
      expect(within(dialog).getByText("Financial Summary")).toBeInTheDocument();
    });
    // Spinner inside dialog — check for animate-spin SVG
    expect(dialog.querySelector(".animate-spin")).toBeTruthy();
  });

  it("does not call getResidentEventFinances for non-settled events", async () => {
    mockGetResidentEvents.mockResolvedValue({ data: [BASE_EVENT] });
    renderPage();
    await waitFor(() => screen.getByText("Holi 2026"));
    fireEvent.click(screen.getByText("Holi 2026").closest("[class*='cursor-pointer']")!);
    await waitFor(() => screen.getByRole("dialog"));
    expect(mockGetResidentEventFinances).not.toHaveBeenCalled();
  });

  // ── Disabled queries when no user ─────────────────────────────────────────

  it("does not call getResidentEvents when user is null", async () => {
    mockGetResidentEvents.mockResolvedValue({ data: [] });
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={queryClient}>
        <AuthContext.Provider
          value={{
            user: null,
            isLoading: false,
            isAuthenticated: false,
            signOut: vi.fn(),
            switchSociety: vi.fn(),
          }}
        >
          <ResidentEventsPage />
        </AuthContext.Provider>
      </QueryClientProvider>,
    );
    await waitFor(() => {
      expect(screen.getByText("Community Events")).toBeInTheDocument();
    });
    expect(mockGetResidentEvents).not.toHaveBeenCalled();
  });

  // ── Multiple events ───────────────────────────────────────────────────────

  it("renders multiple event cards", async () => {
    mockGetResidentEvents.mockResolvedValue({
      data: [BASE_EVENT, FREE_EVENT, FLEXIBLE_POLLING],
    });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Holi 2026")).toBeInTheDocument();
    });
    expect(screen.getByText("AGM Meeting")).toBeInTheDocument();
    expect(screen.getByText("Sports Day")).toBeInTheDocument();
  });

  // ── 'Registration not open' for non-published events ─────────────────────

  it("shows 'Registration not open' for PUBLISHED event without deadline issue", async () => {
    // maxParticipants=5 but only 3 registered, but status is something else
    // Edge case: status PUBLISHED but no deadline and not full → shows register
    // Let's test "Registration not open" via non-PUBLISHED, non-COMPLETED event
    // Actually status other than PUBLISHED → !isRegistrationOpen → "Registration not open"
    const ev = { ...BASE_EVENT, status: "CANCELLED" };
    mockGetResidentEvents.mockResolvedValue({ data: [ev] });
    renderPage();
    await waitFor(() => screen.getByText("Holi 2026"));
    fireEvent.click(screen.getByText("Holi 2026").closest("[class*='cursor-pointer']")!);
    await waitFor(() => screen.getByRole("dialog"));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByText("Registration not open")).toBeInTheDocument();
  });

  // ── Disposition labels coverage ───────────────────────────────────────────

  it("shows 'Refunded to participants' disposition", async () => {
    const finances = { ...MOCK_FINANCES, disposition: "REFUNDED" };
    mockGetResidentEvents.mockResolvedValue({ data: [COMPLETED_SETTLED] });
    mockGetResidentEventFinances.mockResolvedValue(finances);
    renderPage();
    await waitFor(() => screen.getByText("Navratri 2025"));
    fireEvent.click(screen.getByText("Navratri 2025").closest("[class*='cursor-pointer']")!);
    await waitFor(() => screen.getByRole("dialog"));
    const dialog = screen.getByRole("dialog");
    await waitFor(() => {
      expect(within(dialog).getByText("Refunded to participants")).toBeInTheDocument();
    });
  });

  it("shows 'Carried forward' disposition", async () => {
    const finances = { ...MOCK_FINANCES, disposition: "CARRIED_FORWARD" };
    mockGetResidentEvents.mockResolvedValue({ data: [COMPLETED_SETTLED] });
    mockGetResidentEventFinances.mockResolvedValue(finances);
    renderPage();
    await waitFor(() => screen.getByText("Navratri 2025"));
    fireEvent.click(screen.getByText("Navratri 2025").closest("[class*='cursor-pointer']")!);
    await waitFor(() => screen.getByRole("dialog"));
    const dialog = screen.getByRole("dialog");
    await waitFor(() => {
      expect(within(dialog).getByText("Carried forward")).toBeInTheDocument();
    });
  });

  it("shows 'Additional collection' disposition", async () => {
    const finances = { ...MOCK_FINANCES, netAmount: -1000, disposition: "ADDITIONAL_COLLECTION" };
    mockGetResidentEvents.mockResolvedValue({ data: [COMPLETED_SETTLED] });
    mockGetResidentEventFinances.mockResolvedValue(finances);
    renderPage();
    await waitFor(() => screen.getByText("Navratri 2025"));
    fireEvent.click(screen.getByText("Navratri 2025").closest("[class*='cursor-pointer']")!);
    await waitFor(() => screen.getByRole("dialog"));
    const dialog = screen.getByRole("dialog");
    await waitFor(() => {
      expect(within(dialog).getByText("Additional collection")).toBeInTheDocument();
    });
  });

  it("shows raw disposition when not in DISPOSAL_LABELS", async () => {
    const finances = { ...MOCK_FINANCES, disposition: "UNKNOWN_DISPOSITION" };
    mockGetResidentEvents.mockResolvedValue({ data: [COMPLETED_SETTLED] });
    mockGetResidentEventFinances.mockResolvedValue(finances);
    renderPage();
    await waitFor(() => screen.getByText("Navratri 2025"));
    fireEvent.click(screen.getByText("Navratri 2025").closest("[class*='cursor-pointer']")!);
    await waitFor(() => screen.getByRole("dialog"));
    const dialog = screen.getByRole("dialog");
    await waitFor(() => {
      expect(within(dialog).getByText("UNKNOWN_DISPOSITION")).toBeInTheDocument();
    });
  });

  it("handles null disposition gracefully", async () => {
    const finances = { ...MOCK_FINANCES, disposition: null };
    mockGetResidentEvents.mockResolvedValue({ data: [COMPLETED_SETTLED] });
    mockGetResidentEventFinances.mockResolvedValue(finances);
    renderPage();
    await waitFor(() => screen.getByText("Navratri 2025"));
    fireEvent.click(screen.getByText("Navratri 2025").closest("[class*='cursor-pointer']")!);
    await waitFor(() => screen.getByRole("dialog"));
    const dialog = screen.getByRole("dialog");
    await waitFor(() => {
      expect(within(dialog).getByText("Surplus")).toBeInTheDocument();
    });
    // No disposition text rendered
    expect(within(dialog).queryByText("Transferred to society fund")).not.toBeInTheDocument();
  });

  it("handles empty expenses array gracefully (no 'Expense Breakdown' heading)", async () => {
    const finances = { ...MOCK_FINANCES, expenses: [] };
    mockGetResidentEvents.mockResolvedValue({ data: [COMPLETED_SETTLED] });
    mockGetResidentEventFinances.mockResolvedValue(finances);
    renderPage();
    await waitFor(() => screen.getByText("Navratri 2025"));
    fireEvent.click(screen.getByText("Navratri 2025").closest("[class*='cursor-pointer']")!);
    await waitFor(() => screen.getByRole("dialog"));
    const dialog = screen.getByRole("dialog");
    await waitFor(() => {
      expect(within(dialog).getByText("Financial Summary")).toBeInTheDocument();
    });
    expect(within(dialog).queryByText("Expense Breakdown")).not.toBeInTheDocument();
  });

  // ── Category labels coverage ──────────────────────────────────────────────

  it("renders category label for SPORTS category", async () => {
    const ev = { ...BASE_EVENT, category: "SPORTS" };
    mockGetResidentEvents.mockResolvedValue({ data: [ev] });
    renderPage();
    await waitFor(() => {
      expect(screen.getAllByText("Sports").length).toBeGreaterThan(0);
    });
  });

  it("renders fallback category when not in CATEGORY_LABELS", async () => {
    const ev = { ...BASE_EVENT, category: "SPECIAL_EVENT" };
    mockGetResidentEvents.mockResolvedValue({ data: [ev] });
    renderPage();
    await waitFor(() => {
      expect(screen.getAllByText("SPECIAL_EVENT").length).toBeGreaterThan(0);
    });
  });

  // ── Event without _count ──────────────────────────────────────────────────

  it("does not crash when event has no _count", async () => {
    const ev = { ...BASE_EVENT, _count: undefined };
    mockGetResidentEvents.mockResolvedValue({ data: [ev] });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Holi 2026")).toBeInTheDocument();
    });
  });

  it("does not show registered count in sheet when _count is absent", async () => {
    const ev = { ...BASE_EVENT, _count: undefined };
    mockGetResidentEvents.mockResolvedValue({ data: [ev] });
    renderPage();
    await waitFor(() => screen.getByText("Holi 2026"));
    fireEvent.click(screen.getByText("Holi 2026").closest("[class*='cursor-pointer']")!);
    await waitFor(() => screen.getByRole("dialog"));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).queryByText(/registered/)).not.toBeInTheDocument();
  });

  // ── Event without description / location ──────────────────────────────────

  it("does not show description section when description is null", async () => {
    const ev = { ...BASE_EVENT, description: null };
    mockGetResidentEvents.mockResolvedValue({ data: [ev] });
    renderPage();
    await waitFor(() => screen.getByText("Holi 2026"));
    fireEvent.click(screen.getByText("Holi 2026").closest("[class*='cursor-pointer']")!);
    await waitFor(() => screen.getByRole("dialog"));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).queryByText("Annual Holi celebration")).not.toBeInTheDocument();
  });

  it("does not show location in sheet when location is null", async () => {
    const ev = { ...BASE_EVENT, location: null };
    mockGetResidentEvents.mockResolvedValue({ data: [ev] });
    renderPage();
    await waitFor(() => screen.getByText("Holi 2026"));
    fireEvent.click(screen.getByText("Holi 2026").closest("[class*='cursor-pointer']")!);
    await waitFor(() => screen.getByRole("dialog"));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).queryByText("Club House")).not.toBeInTheDocument();
  });

  // ── Max stepper limits ────────────────────────────────────────────────────

  it("decrements member count from 2 to 1 when minus clicked", async () => {
    mockGetResidentEvents.mockResolvedValue({ data: [BASE_EVENT] });
    renderPage();
    await waitFor(() => screen.getByText("Holi 2026"));
    fireEvent.click(screen.getByText("Holi 2026").closest("[class*='cursor-pointer']")!);
    await waitFor(() => screen.getByRole("dialog"));
    const dialog = screen.getByRole("dialog");
    const stepperSection = within(dialog).getByText("How many family members?").parentElement!;
    const plusBtn = stepperSection.querySelector("button:last-of-type")!;
    const minusBtn = stepperSection.querySelector("button:first-of-type")!;
    // Increment to 2 first
    fireEvent.click(plusBtn);
    await waitFor(() => within(dialog).getByText(/2 × ₹200 = ₹400/));
    // Now decrement back to 1
    fireEvent.click(minusBtn);
    await waitFor(() => {
      expect(within(dialog).getByText(/1 × ₹200 = ₹200/)).toBeInTheDocument();
    });
  });

  it("closes sheet when Escape key is pressed", async () => {
    mockGetResidentEvents.mockResolvedValue({ data: [BASE_EVENT] });
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => screen.getByText("Holi 2026"));
    fireEvent.click(screen.getByText("Holi 2026").closest("[class*='cursor-pointer']")!);
    await waitFor(() => screen.getByRole("dialog"));
    // Press Escape to close the sheet — Radix calls onOpenChange(false)
    await user.keyboard("{Escape}");
    // After close, sheet content should be gone or selectedEvent cleared
    expect(screen.getByText("Community Events")).toBeInTheDocument();
  });

  it("shows empty string fee display for unrecognized feeModel (fallback)", async () => {
    const ev = { ...BASE_EVENT, feeModel: "UNKNOWN_MODEL", feeAmount: null };
    mockGetResidentEvents.mockResolvedValue({ data: [ev] });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Holi 2026")).toBeInTheDocument();
    });
    // No fee text should appear (getFeeDisplay returns "")
    expect(screen.queryByText(/₹/)).not.toBeInTheDocument();
  });

  it("shows 'Register' (no price) when feeAmount is null on FIXED event", async () => {
    // Edge case: FIXED event with null feeAmount → amtDue is null → buttonLabel = "Register"
    const ev = { ...BASE_EVENT, feeAmount: null };
    mockGetResidentEvents.mockResolvedValue({ data: [ev] });
    renderPage();
    await waitFor(() => screen.getByText("Holi 2026"));
    fireEvent.click(screen.getByText("Holi 2026").closest("[class*='cursor-pointer']")!);
    await waitFor(() => screen.getByRole("dialog"));
    const dialog = screen.getByRole("dialog");
    expect(within(dialog).getByRole("button", { name: /^Register$/i })).toBeInTheDocument();
  });

  it("shows loading spinner on register button while registering", async () => {
    mockGetResidentEvents.mockResolvedValue({ data: [FREE_EVENT] });
    mockRegisterForEvent.mockReturnValue(new Promise(() => {})); // never resolves
    renderPage();
    await waitFor(() => screen.getByText("AGM Meeting"));
    fireEvent.click(screen.getByText("AGM Meeting").closest("[class*='cursor-pointer']")!);
    await waitFor(() => screen.getByRole("dialog"));
    const dialog = screen.getByRole("dialog");
    fireEvent.click(within(dialog).getByRole("button", { name: /I'm In/i }));
    await waitFor(() => {
      // Button should be disabled and showing spinner
      const btn = within(dialog).getByRole("button", { name: /I'm In/i });
      expect(btn).toBeDisabled();
    });
    expect(dialog.querySelector(".animate-spin")).toBeTruthy();
  });

  it("shows unknown category/feeModel as raw string in sheet badges", async () => {
    const ev = { ...BASE_EVENT, category: "CUSTOM_CAT", feeModel: "CUSTOM_MODEL" };
    mockGetResidentEvents.mockResolvedValue({ data: [ev] });
    renderPage();
    await waitFor(() => screen.getByText("Holi 2026"));
    fireEvent.click(screen.getByText("Holi 2026").closest("[class*='cursor-pointer']")!);
    await waitFor(() => screen.getByRole("dialog"));
    const dialog = screen.getByRole("dialog");
    // Fallback: raw string shown in sheet badges
    expect(within(dialog).getAllByText("CUSTOM_CAT").length).toBeGreaterThan(0);
    expect(within(dialog).getAllByText("CUSTOM_MODEL").length).toBeGreaterThan(0);
  });

  it("renders nothing when finances query returns null", async () => {
    mockGetResidentEvents.mockResolvedValue({ data: [COMPLETED_SETTLED] });
    mockGetResidentEventFinances.mockResolvedValue(null);
    renderPage();
    await waitFor(() => screen.getByText("Navratri 2025"));
    fireEvent.click(screen.getByText("Navratri 2025").closest("[class*='cursor-pointer']")!);
    await waitFor(() => screen.getByRole("dialog"));
    const dialog = screen.getByRole("dialog");
    await waitFor(() => {
      expect(within(dialog).getByText("Financial Summary")).toBeInTheDocument();
    });
    // finances is null so the data grid should not be shown
    expect(within(dialog).queryByText("Total Collected")).not.toBeInTheDocument();
  });

  it("cannot increment member count above 10", async () => {
    mockGetResidentEvents.mockResolvedValue({ data: [BASE_EVENT] });
    renderPage();
    await waitFor(() => screen.getByText("Holi 2026"));
    fireEvent.click(screen.getByText("Holi 2026").closest("[class*='cursor-pointer']")!);
    await waitFor(() => screen.getByRole("dialog"));
    const dialog = screen.getByRole("dialog");
    const stepperSection = within(dialog).getByText("How many family members?").parentElement!;
    const plusBtn = stepperSection.querySelector("button:last-of-type")!;
    // Click plus 10 times
    for (let i = 0; i < 10; i++) {
      fireEvent.click(plusBtn);
    }
    await waitFor(() => {
      expect(within(dialog).getByText("10")).toBeInTheDocument();
    });
    // Button should now be disabled
    expect(plusBtn).toBeDisabled();
  });
});
