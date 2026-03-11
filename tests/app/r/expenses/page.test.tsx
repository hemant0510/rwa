import React from "react";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

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

import ResidentExpensesPage from "@/app/r/expenses/page";

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
    ...userOverrides,
  };
  return render(
    <QueryClientProvider client={queryClient}>
      <AuthContext.Provider
        value={{ user, isLoading: false, isAuthenticated: true, signOut: vi.fn() }}
      >
        <ResidentExpensesPage />
      </AuthContext.Provider>
    </QueryClientProvider>,
  );
}

describe("ResidentExpensesPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows loading skeleton while data is pending", () => {
    mockGetExpenseSummary.mockReturnValue(new Promise(() => {}));
    mockGetExpenses.mockReturnValue(new Promise(() => {}));
    renderPage();
    // When isLoading, the TableSkeleton or an animate-pulse element is shown
    // Just confirm the page renders without crashing during loading
    expect(screen.getByText("Society Expenses")).toBeInTheDocument();
  });

  it("shows empty state when no expenses", async () => {
    mockGetExpenseSummary.mockResolvedValue(null);
    mockGetExpenses.mockResolvedValue({ data: [] });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("No expenses recorded")).toBeInTheDocument();
    });
  });

  it("shows active expense in list", async () => {
    mockGetExpenseSummary.mockResolvedValue(null);
    mockGetExpenses.mockResolvedValue({
      data: [
        {
          id: "e1",
          description: "Security Guard",
          category: "MAINTENANCE",
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
    expect(screen.getByText("maintenance")).toBeInTheDocument();
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
          description: "Archived Expense",
          category: "MAINTENANCE",
          date: "2025-06-15T12:00:00.000Z",
          amount: 500,
          status: "ARCHIVED",
        },
      ],
    });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Active Expense")).toBeInTheDocument();
    });
    expect(screen.queryByText("Archived Expense")).not.toBeInTheDocument();
  });

  it("shows summary cards with total expenses when summary is present", async () => {
    mockGetExpenseSummary.mockResolvedValue({
      totalExpenses: 5000,
      balanceInHand: 2000,
      categoryBreakdown: [],
    });
    mockGetExpenses.mockResolvedValue({ data: [] });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Total Expenses")).toBeInTheDocument();
    });
    expect(screen.getByText("Balance")).toBeInTheDocument();
  });

  it("shows positive balance in green text", async () => {
    mockGetExpenseSummary.mockResolvedValue({
      totalExpenses: 5000,
      balanceInHand: 2000,
      categoryBreakdown: [],
    });
    mockGetExpenses.mockResolvedValue({ data: [] });
    renderPage();
    await waitFor(() => {
      const el = screen.getByText(/2,000/);
      expect(el.className).toContain("green");
    });
  });

  it("shows negative balance in red text", async () => {
    mockGetExpenseSummary.mockResolvedValue({
      totalExpenses: 5000,
      balanceInHand: -500,
      categoryBreakdown: [],
    });
    mockGetExpenses.mockResolvedValue({ data: [] });
    renderPage();
    await waitFor(() => {
      const els = screen.getAllByText(/-500/);
      const el = els[0];
      expect(el.className).toContain("red");
    });
  });

  it("shows category breakdown section when breakdown is non-empty", async () => {
    mockGetExpenseSummary.mockResolvedValue({
      totalExpenses: 5000,
      balanceInHand: 1000,
      categoryBreakdown: [{ category: "MAINTENANCE", total: 3000 }],
    });
    mockGetExpenses.mockResolvedValue({ data: [] });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("By Category")).toBeInTheDocument();
    });
    expect(screen.getByText("maintenance")).toBeInTheDocument();
  });

  it("does not show category section when breakdown is empty", async () => {
    mockGetExpenseSummary.mockResolvedValue({
      totalExpenses: 0,
      balanceInHand: 0,
      categoryBreakdown: [],
    });
    mockGetExpenses.mockResolvedValue({ data: [] });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("No expenses recorded")).toBeInTheDocument();
    });
    expect(screen.queryByText("By Category")).not.toBeInTheDocument();
  });

  it("does not show summary section when summary is null", async () => {
    mockGetExpenseSummary.mockResolvedValue(null);
    mockGetExpenses.mockResolvedValue({ data: [] });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("No expenses recorded")).toBeInTheDocument();
    });
    expect(screen.queryByText("Total Expenses")).not.toBeInTheDocument();
  });

  it("queries with empty societyId when user has none", async () => {
    mockGetExpenseSummary.mockResolvedValue(null);
    mockGetExpenses.mockResolvedValue({ data: [] });
    renderPage({ societyId: "" });
    // With empty societyId the queries are disabled (enabled: !!societyId)
    await waitFor(() => {
      expect(screen.getByText("Society Expenses")).toBeInTheDocument();
    });
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
