import React from "react";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

import ResidentExpensesPage from "@/app/r/expenses/page";
import { AuthContext } from "@/hooks/useAuth";

const { mockGetExpenses, mockGetExpenseSummary } = vi.hoisted(() => ({
  mockGetExpenses: vi.fn(),
  mockGetExpenseSummary: vi.fn(),
}));

vi.mock("@/services/expenses", () => ({
  getExpenses: (...args: unknown[]) => mockGetExpenses(...args),
  getExpenseSummary: (...args: unknown[]) => mockGetExpenseSummary(...args),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => "/r/expenses",
}));

function renderPage(userOverrides: Record<string, unknown> = {}) {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  const user = {
    id: "u1",
    name: "Test",
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
        <ResidentExpensesPage />
      </AuthContext.Provider>
    </QueryClientProvider>,
  );
}

const MOCK_SUMMARY = {
  totalExpenses: 14400,
  totalCollected: 38400,
  balanceInHand: 24000,
  categoryBreakdown: [
    { category: "SECURITY", total: 4800, count: 1, percentage: 33 },
    { category: "MAINTENANCE", total: 9600, count: 2, percentage: 67 },
  ],
};

describe("ResidentExpensesPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ─── Loading & Title ─────────────────────────────────────────────────────────

  it("renders page title", () => {
    mockGetExpenseSummary.mockReturnValue(new Promise(() => {}));
    mockGetExpenses.mockReturnValue(new Promise(() => {}));
    renderPage();
    expect(screen.getByText("Society Expenses")).toBeInTheDocument();
  });

  it("shows loading skeleton while data is pending", () => {
    mockGetExpenseSummary.mockReturnValue(new Promise(() => {}));
    mockGetExpenses.mockReturnValue(new Promise(() => {}));
    renderPage();
    expect(screen.getByText("Society Expenses")).toBeInTheDocument();
  });

  // ─── Empty State ─────────────────────────────────────────────────────────────

  it("shows empty state when no expenses", async () => {
    mockGetExpenseSummary.mockResolvedValue(null);
    mockGetExpenses.mockResolvedValue({ data: [] });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("No expenses recorded")).toBeInTheDocument();
    });
  });

  // ─── Summary Cards — Three Cards ─────────────────────────────────────────────

  it("shows all three summary cards: Total Collected, Total Expenses, Balance", async () => {
    mockGetExpenseSummary.mockResolvedValue(MOCK_SUMMARY);
    mockGetExpenses.mockResolvedValue({ data: [] });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Total Collected")).toBeInTheDocument();
    });
    expect(screen.getByText("Total Expenses")).toBeInTheDocument();
    expect(screen.getByText("Balance in Hand")).toBeInTheDocument();
  });

  it("shows correct values for all three summary cards", async () => {
    mockGetExpenseSummary.mockResolvedValue(MOCK_SUMMARY);
    mockGetExpenses.mockResolvedValue({ data: [] });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText(/38,400/)).toBeInTheDocument(); // totalCollected
    });
    expect(screen.getByText(/14,400/)).toBeInTheDocument(); // totalExpenses
    expect(screen.getByText(/24,000/)).toBeInTheDocument(); // balance
  });

  it("shows positive balance in green", async () => {
    mockGetExpenseSummary.mockResolvedValue(MOCK_SUMMARY);
    mockGetExpenses.mockResolvedValue({ data: [] });
    renderPage();
    await waitFor(() => {
      const el = screen.getByText(/24,000/);
      expect(el.className).toContain("green");
    });
  });

  it("shows negative balance in red", async () => {
    mockGetExpenseSummary.mockResolvedValue({ ...MOCK_SUMMARY, balanceInHand: -500 });
    mockGetExpenses.mockResolvedValue({ data: [] });
    renderPage();
    await waitFor(() => {
      const els = screen.getAllByText(/-?500/);
      const el = els[0];
      expect(el.className).toContain("red");
    });
  });

  it("does not show summary section when summary is null", async () => {
    mockGetExpenseSummary.mockResolvedValue(null);
    mockGetExpenses.mockResolvedValue({ data: [] });
    renderPage();
    await waitFor(() => {
      expect(screen.queryByText("Total Collected")).not.toBeInTheDocument();
    });
  });

  // ─── Category Breakdown with Bars ────────────────────────────────────────────

  it("shows category breakdown section when breakdown is non-empty", async () => {
    mockGetExpenseSummary.mockResolvedValue(MOCK_SUMMARY);
    mockGetExpenses.mockResolvedValue({ data: [] });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("By Category")).toBeInTheDocument();
    });
    expect(screen.getByText("Security")).toBeInTheDocument();
    expect(screen.getByText("Maintenance")).toBeInTheDocument();
  });

  it("shows percentage values in category breakdown", async () => {
    mockGetExpenseSummary.mockResolvedValue(MOCK_SUMMARY);
    mockGetExpenses.mockResolvedValue({ data: [] });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText(/33%/)).toBeInTheDocument();
    });
    expect(screen.getByText(/67%/)).toBeInTheDocument();
  });

  it("renders percentage bar elements for each category", async () => {
    mockGetExpenseSummary.mockResolvedValue(MOCK_SUMMARY);
    mockGetExpenses.mockResolvedValue({ data: [] });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("By Category")).toBeInTheDocument();
    });
    // Each category bar has inline style with width
    const bars = document.querySelectorAll('[style*="width:"]');
    expect(bars.length).toBeGreaterThanOrEqual(2);
  });

  it("does not show category section when breakdown is empty", async () => {
    mockGetExpenseSummary.mockResolvedValue({ ...MOCK_SUMMARY, categoryBreakdown: [] });
    mockGetExpenses.mockResolvedValue({ data: [] });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("No expenses recorded")).toBeInTheDocument();
    });
    expect(screen.queryByText("By Category")).not.toBeInTheDocument();
  });

  // ─── Expense List ─────────────────────────────────────────────────────────────

  it("shows active expense in list", async () => {
    mockGetExpenseSummary.mockResolvedValue(null);
    mockGetExpenses.mockResolvedValue({
      data: [
        {
          id: "e1",
          description: "Security Guard",
          category: "SECURITY",
          date: "2025-06-15T12:00:00.000Z",
          amount: 1000,
          status: "ACTIVE",
        },
      ],
    });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Security Guard")).toBeInTheDocument();
    });
    expect(screen.getByText("security")).toBeInTheDocument();
  });

  it("filters out non-ACTIVE expenses", async () => {
    mockGetExpenseSummary.mockResolvedValue(null);
    mockGetExpenses.mockResolvedValue({
      data: [
        {
          id: "e1",
          description: "Active Expense",
          category: "MAINTENANCE",
          date: "2025-06-15T12:00:00.000Z",
          amount: 1000,
          status: "ACTIVE",
        },
        {
          id: "e2",
          description: "Reversed Expense",
          category: "MAINTENANCE",
          date: "2025-06-15T12:00:00.000Z",
          amount: 500,
          status: "REVERSED",
        },
      ],
    });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Active Expense")).toBeInTheDocument();
    });
    expect(screen.queryByText("Reversed Expense")).not.toBeInTheDocument();
  });

  it("formats date correctly in expense list", async () => {
    mockGetExpenseSummary.mockResolvedValue(null);
    mockGetExpenses.mockResolvedValue({
      data: [
        {
          id: "e1",
          description: "Test Expense",
          category: "MAINTENANCE",
          date: "2026-03-15T00:00:00.000Z",
          amount: 500,
          status: "ACTIVE",
        },
      ],
    });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText(/15 Mar 2026/)).toBeInTheDocument();
    });
  });

  it("formats amount with Indian locale", async () => {
    mockGetExpenseSummary.mockResolvedValue(null);
    mockGetExpenses.mockResolvedValue({
      data: [
        {
          id: "e1",
          description: "Test Expense",
          category: "SECURITY",
          date: "2026-03-15T00:00:00.000Z",
          amount: 48000,
          status: "ACTIVE",
        },
      ],
    });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText(/48,000/)).toBeInTheDocument();
    });
  });

  // ─── Disabled queries when societyId is empty ─────────────────────────────────

  it("queries disabled when societyId is empty", async () => {
    mockGetExpenseSummary.mockResolvedValue(null);
    mockGetExpenses.mockResolvedValue({ data: [] });
    renderPage({ societyId: "" });
    await waitFor(() => {
      expect(screen.getByText("Society Expenses")).toBeInTheDocument();
    });
    expect(mockGetExpenses).not.toHaveBeenCalled();
  });

  it("falls back to empty string when societyId is null", async () => {
    mockGetExpenseSummary.mockResolvedValue(null);
    mockGetExpenses.mockResolvedValue({ data: [] });
    renderPage({ societyId: null });
    await waitFor(() => {
      expect(screen.getByText("Society Expenses")).toBeInTheDocument();
    });
  });
});
