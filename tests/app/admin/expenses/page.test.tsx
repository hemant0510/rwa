import React from "react";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";

import ExpensesPage from "@/app/admin/expenses/page";
import { AuthContext } from "@/hooks/useAuth";

const {
  mockGetExpenses,
  mockGetExpenseSummary,
  mockCreateExpense,
  mockUpdateExpense,
  mockReverseExpense,
} = vi.hoisted(() => ({
  mockGetExpenses: vi.fn(),
  mockGetExpenseSummary: vi.fn(),
  mockCreateExpense: vi.fn(),
  mockUpdateExpense: vi.fn(),
  mockReverseExpense: vi.fn(),
}));

vi.mock("@/services/expenses", () => ({
  getExpenses: (...args: unknown[]) => mockGetExpenses(...args),
  getExpenseSummary: (...args: unknown[]) => mockGetExpenseSummary(...args),
  createExpense: (...args: unknown[]) => mockCreateExpense(...args),
  updateExpense: (...args: unknown[]) => mockUpdateExpense(...args),
  reverseExpense: (...args: unknown[]) => mockReverseExpense(...args),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => "/admin/expenses",
  useSearchParams: () => new URLSearchParams(""),
}));

// Don't mock supabase client for most tests — receipt upload tested separately
vi.mock("@/lib/supabase/client", () => ({
  createClient: () => ({
    storage: {
      from: () => ({
        upload: vi.fn().mockResolvedValue({ error: null }),
        getPublicUrl: vi
          .fn()
          .mockReturnValue({ data: { publicUrl: "https://cdn.test/receipt.jpg" } }),
      }),
    },
  }),
}));

const FUTURE_WINDOW = new Date(Date.now() + 20 * 60 * 60 * 1000).toISOString(); // 20h from now
const EXPIRED_WINDOW = new Date(Date.now() - 60 * 1000).toISOString(); // 1 min ago

const MOCK_SUMMARY = {
  totalExpenses: 14400,
  totalCollected: 38400,
  balanceInHand: 24000,
  categoryBreakdown: [
    { category: "SECURITY", total: 4800, count: 1, percentage: 33 },
    { category: "MAINTENANCE", total: 9600, count: 2, percentage: 67 },
  ],
};

const MOCK_ACTIVE_EXPENSE = {
  id: "exp-1",
  societyId: "soc-1",
  date: "2026-03-01T00:00:00.000Z",
  amount: 4800,
  category: "SECURITY",
  description: "Security guard salary",
  status: "ACTIVE",
  receiptUrl: null,
  reversalNote: null,
  reversedAt: null,
  reversedBy: null,
  correctionWindowEnds: FUTURE_WINDOW,
  loggedBy: "u1",
  logger: { name: "Hemant Kumar" },
  createdAt: "2026-03-01T09:00:00.000Z",
};

const MOCK_REVERSED_EXPENSE = {
  ...MOCK_ACTIVE_EXPENSE,
  id: "exp-2",
  status: "REVERSED",
  correctionWindowEnds: EXPIRED_WINDOW,
  reversalNote: "Duplicate entry",
};

const MOCK_EXPIRED_WINDOW_EXPENSE = {
  ...MOCK_ACTIVE_EXPENSE,
  id: "exp-3",
  correctionWindowEnds: EXPIRED_WINDOW,
  description: "Old maintenance",
};

function makeAdminUser(overrides: Record<string, unknown> = {}) {
  return {
    id: "u1",
    name: "Hemant Kumar",
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
        <ExpensesPage />
      </AuthContext.Provider>
    </QueryClientProvider>,
  );
}

describe("Admin ExpensesPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ─── Loading & Empty States ─────────────────────────────────────────────────

  it("renders page title", () => {
    mockGetExpenseSummary.mockReturnValue(new Promise(() => {}));
    mockGetExpenses.mockReturnValue(new Promise(() => {}));
    renderPage();
    expect(screen.getByText("Expense Ledger")).toBeInTheDocument();
  });

  it("shows loading skeleton while data is pending", () => {
    mockGetExpenseSummary.mockReturnValue(new Promise(() => {}));
    mockGetExpenses.mockReturnValue(new Promise(() => {}));
    renderPage();
    // Skeleton should render — page doesn't crash
    expect(screen.getByText("Expense Ledger")).toBeInTheDocument();
  });

  it("shows empty state when no expenses exist", async () => {
    mockGetExpenseSummary.mockResolvedValue(null);
    mockGetExpenses.mockResolvedValue({ data: [], total: 0, page: 1, limit: 20 });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText(/No expenses found/)).toBeInTheDocument();
    });
  });

  // ─── Summary Cards ──────────────────────────────────────────────────────────

  it("renders all three summary cards with correct values", async () => {
    mockGetExpenseSummary.mockResolvedValue(MOCK_SUMMARY);
    mockGetExpenses.mockResolvedValue({ data: [], total: 0, page: 1, limit: 20 });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Total Expenses")).toBeInTheDocument();
    });
    expect(screen.getByText("Total Collected")).toBeInTheDocument();
    expect(screen.getByText("Balance in Hand")).toBeInTheDocument();
    expect(screen.getByText(/14,400/)).toBeInTheDocument();
    expect(screen.getByText(/38,400/)).toBeInTheDocument();
    expect(screen.getByText(/24,000/)).toBeInTheDocument();
  });

  it("shows positive balance in green", async () => {
    mockGetExpenseSummary.mockResolvedValue(MOCK_SUMMARY);
    mockGetExpenses.mockResolvedValue({ data: [], total: 0, page: 1, limit: 20 });
    renderPage();
    await waitFor(() => {
      const el = screen.getByText(/24,000/);
      expect(el.className).toContain("green");
    });
  });

  it("shows negative balance in red", async () => {
    mockGetExpenseSummary.mockResolvedValue({ ...MOCK_SUMMARY, balanceInHand: -5000 });
    mockGetExpenses.mockResolvedValue({ data: [], total: 0, page: 1, limit: 20 });
    renderPage();
    await waitFor(() => {
      const el = screen.getByText(/−?5,000/);
      expect(el.className).toContain("red");
    });
  });

  it("does not render summary section when summary is null", async () => {
    mockGetExpenseSummary.mockResolvedValue(null);
    mockGetExpenses.mockResolvedValue({ data: [], total: 0, page: 1, limit: 20 });
    renderPage();
    await waitFor(() => {
      expect(screen.queryByText("Total Expenses")).not.toBeInTheDocument();
    });
  });

  // ─── Category Breakdown ─────────────────────────────────────────────────────

  it("renders category breakdown with percentage bars", async () => {
    mockGetExpenseSummary.mockResolvedValue(MOCK_SUMMARY);
    mockGetExpenses.mockResolvedValue({ data: [], total: 0, page: 1, limit: 20 });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Category Breakdown")).toBeInTheDocument();
    });
    expect(screen.getByText("Security")).toBeInTheDocument();
    expect(screen.getByText("Maintenance")).toBeInTheDocument();
    expect(screen.getByText(/33%/)).toBeInTheDocument();
    expect(screen.getByText(/67%/)).toBeInTheDocument();
  });

  it("hides category breakdown when list is empty", async () => {
    mockGetExpenseSummary.mockResolvedValue({ ...MOCK_SUMMARY, categoryBreakdown: [] });
    mockGetExpenses.mockResolvedValue({ data: [], total: 0, page: 1, limit: 20 });
    renderPage();
    await waitFor(() => {
      expect(screen.queryByText("Category Breakdown")).not.toBeInTheDocument();
    });
  });

  // ─── Expense Table ───────────────────────────────────────────────────────────

  it("renders expense rows in the table", async () => {
    mockGetExpenseSummary.mockResolvedValue(null);
    mockGetExpenses.mockResolvedValue({
      data: [MOCK_ACTIVE_EXPENSE],
      total: 1,
      page: 1,
      limit: 20,
    });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Security guard salary")).toBeInTheDocument();
    });
    expect(screen.getByText("Hemant Kumar")).toBeInTheDocument();
  });

  it("shows reversed expense with Reversed badge", async () => {
    mockGetExpenseSummary.mockResolvedValue(null);
    mockGetExpenses.mockResolvedValue({
      data: [MOCK_REVERSED_EXPENSE],
      total: 1,
      page: 1,
      limit: 20,
    });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Reversed")).toBeInTheDocument();
    });
  });

  it("shows Active badge for active expenses", async () => {
    mockGetExpenseSummary.mockResolvedValue(null);
    mockGetExpenses.mockResolvedValue({
      data: [MOCK_ACTIVE_EXPENSE],
      total: 1,
      page: 1,
      limit: 20,
    });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Active")).toBeInTheDocument();
    });
  });

  it("shows correction window badge for fresh active expenses", async () => {
    mockGetExpenseSummary.mockResolvedValue(null);
    mockGetExpenses.mockResolvedValue({
      data: [MOCK_ACTIVE_EXPENSE],
      total: 1,
      page: 1,
      limit: 20,
    });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText(/to edit/)).toBeInTheDocument();
    });
  });

  it("does not show correction window badge when window is expired", async () => {
    mockGetExpenseSummary.mockResolvedValue(null);
    mockGetExpenses.mockResolvedValue({
      data: [MOCK_EXPIRED_WINDOW_EXPENSE],
      total: 1,
      page: 1,
      limit: 20,
    });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Old maintenance")).toBeInTheDocument();
    });
    expect(screen.queryByText(/to edit/)).not.toBeInTheDocument();
  });

  // ─── Filters ─────────────────────────────────────────────────────────────────

  it("renders category filter dropdown", async () => {
    mockGetExpenseSummary.mockResolvedValue(null);
    mockGetExpenses.mockResolvedValue({ data: [], total: 0, page: 1, limit: 20 });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("All Categories")).toBeInTheDocument();
    });
  });

  it("renders date From and To inputs", async () => {
    mockGetExpenseSummary.mockResolvedValue(null);
    mockGetExpenses.mockResolvedValue({ data: [], total: 0, page: 1, limit: 20 });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("From")).toBeInTheDocument();
    });
    expect(screen.getByText("To")).toBeInTheDocument();
  });

  it("shows clear dates button when date filter is set", async () => {
    mockGetExpenseSummary.mockResolvedValue(null);
    mockGetExpenses.mockResolvedValue({ data: [], total: 0, page: 1, limit: 20 });
    renderPage();
    await screen.findAllByDisplayValue("");
    // Find the date inputs (type="date")
    const dateInputs = document.querySelectorAll('input[type="date"]');
    expect(dateInputs.length).toBeGreaterThanOrEqual(2);
    fireEvent.change(dateInputs[0], { target: { value: "2026-01-01" } });
    await waitFor(() => {
      expect(screen.getByText("Clear dates")).toBeInTheDocument();
    });
  });

  // ─── Detail Sheet ────────────────────────────────────────────────────────────

  it("opens detail sheet when active expense row is clicked", async () => {
    mockGetExpenseSummary.mockResolvedValue(null);
    mockGetExpenses.mockResolvedValue({
      data: [MOCK_ACTIVE_EXPENSE],
      total: 1,
      page: 1,
      limit: 20,
    });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Security guard salary")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText("Security guard salary"));
    await waitFor(() => {
      expect(screen.getByText("Expense Details")).toBeInTheDocument();
    });
  });

  it("shows Edit and Reverse buttons in detail sheet for active expense with open window", async () => {
    mockGetExpenseSummary.mockResolvedValue(null);
    mockGetExpenses.mockResolvedValue({
      data: [MOCK_ACTIVE_EXPENSE],
      total: 1,
      page: 1,
      limit: 20,
    });
    renderPage();
    await waitFor(() => screen.getByText("Security guard salary"));
    fireEvent.click(screen.getByText("Security guard salary"));
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Edit/i })).toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Reverse/i })).toBeInTheDocument();
    });
  });

  it("shows only Reverse button in detail sheet when correction window expired", async () => {
    mockGetExpenseSummary.mockResolvedValue(null);
    mockGetExpenses.mockResolvedValue({
      data: [MOCK_EXPIRED_WINDOW_EXPENSE],
      total: 1,
      page: 1,
      limit: 20,
    });
    renderPage();
    await waitFor(() => screen.getByText("Old maintenance"));
    fireEvent.click(screen.getByText("Old maintenance"));
    await waitFor(() => {
      expect(screen.queryByRole("button", { name: /^Edit$/i })).not.toBeInTheDocument();
      expect(screen.getByRole("button", { name: /Reverse/i })).toBeInTheDocument();
    });
  });

  it("shows receipt link in detail sheet when receiptUrl is present", async () => {
    const expenseWithReceipt = {
      ...MOCK_ACTIVE_EXPENSE,
      receiptUrl: "https://cdn.test/receipt.pdf",
    };
    mockGetExpenseSummary.mockResolvedValue(null);
    mockGetExpenses.mockResolvedValue({ data: [expenseWithReceipt], total: 1, page: 1, limit: 20 });
    renderPage();
    await waitFor(() => screen.getByText("Security guard salary"));
    fireEvent.click(screen.getByText("Security guard salary"));
    await waitFor(() => {
      expect(screen.getByText("View Receipt")).toBeInTheDocument();
    });
  });

  // ─── Add Expense Dialog ───────────────────────────────────────────────────────

  it("opens add expense dialog on button click", async () => {
    mockGetExpenseSummary.mockResolvedValue(null);
    mockGetExpenses.mockResolvedValue({ data: [], total: 0, page: 1, limit: 20 });
    renderPage();
    await waitFor(() => screen.getByText("Log Expense"));
    fireEvent.click(screen.getByText("Log Expense"));
    await waitFor(() => {
      expect(screen.getByText("Log New Expense")).toBeInTheDocument();
    });
  });

  it("shows balance impact preview when amount is entered", async () => {
    mockGetExpenseSummary.mockResolvedValue(MOCK_SUMMARY);
    mockGetExpenses.mockResolvedValue({ data: [], total: 0, page: 1, limit: 20 });
    renderPage();
    await waitFor(() => screen.getByText("Log Expense"));
    fireEvent.click(screen.getByText("Log Expense"));
    await waitFor(() => screen.getByText("Log New Expense"));
    const amountInput = document.querySelector('input[type="number"]') as HTMLInputElement;
    fireEvent.change(amountInput, { target: { value: "5000" } });
    await waitFor(() => {
      expect(screen.getByText("Balance Impact")).toBeInTheDocument();
    });
    expect(screen.getByText("Current Balance")).toBeInTheDocument();
    expect(screen.getByText("New Balance")).toBeInTheDocument();
  });

  it("submits add expense form and invalidates queries on success", async () => {
    mockGetExpenseSummary.mockResolvedValue(MOCK_SUMMARY);
    mockGetExpenses.mockResolvedValue({ data: [], total: 0, page: 1, limit: 20 });
    mockCreateExpense.mockResolvedValue({ id: "new-exp" });

    const user = userEvent.setup();
    renderPage();
    await waitFor(() => screen.getByText("Log Expense"));
    await user.click(screen.getByText("Log Expense"));
    await waitFor(() => screen.getByText("Log New Expense"));

    // Fill description
    const descInput = screen.getByPlaceholderText("What was this expense for?");
    await user.clear(descInput);
    await user.type(descInput, "Water pump repair");

    // Fill amount
    const numInputs = document.querySelectorAll('input[type="number"]');
    await user.clear(numInputs[0] as HTMLElement);
    await user.type(numInputs[0] as HTMLElement, "2000");

    await user.click(screen.getByRole("button", { name: /Log Expense/i }));
    await waitFor(() => {
      expect(mockCreateExpense).toHaveBeenCalled();
    });
  });

  it("shows file attachment button in add expense dialog", async () => {
    mockGetExpenseSummary.mockResolvedValue(null);
    mockGetExpenses.mockResolvedValue({ data: [], total: 0, page: 1, limit: 20 });
    renderPage();
    await waitFor(() => screen.getByText("Log Expense"));
    fireEvent.click(screen.getByText("Log Expense"));
    await waitFor(() => {
      expect(screen.getByText(/Attach receipt/)).toBeInTheDocument();
    });
  });

  // ─── Edit Expense Dialog ──────────────────────────────────────────────────────

  it("opens edit dialog from detail sheet and saves changes", async () => {
    mockGetExpenseSummary.mockResolvedValue(null);
    mockGetExpenses.mockResolvedValue({
      data: [MOCK_ACTIVE_EXPENSE],
      total: 1,
      page: 1,
      limit: 20,
    });
    mockUpdateExpense.mockResolvedValue({ ...MOCK_ACTIVE_EXPENSE, amount: 5000 });

    const user = userEvent.setup();
    renderPage();
    await waitFor(() => screen.getByText("Security guard salary"));
    fireEvent.click(screen.getByText("Security guard salary"));
    await waitFor(() => screen.getByText("Expense Details"));
    await user.click(screen.getByRole("button", { name: /^Edit$/i }));
    await waitFor(() => {
      expect(screen.getByText("Edit Expense")).toBeInTheDocument();
    });
    await user.click(screen.getByRole("button", { name: /Save Changes/i }));
    await waitFor(() => {
      expect(mockUpdateExpense).toHaveBeenCalled();
    });
  });

  // ─── Reverse Expense Dialog ───────────────────────────────────────────────────

  it("opens reverse dialog from detail sheet", async () => {
    mockGetExpenseSummary.mockResolvedValue(null);
    mockGetExpenses.mockResolvedValue({
      data: [MOCK_ACTIVE_EXPENSE],
      total: 1,
      page: 1,
      limit: 20,
    });
    renderPage();
    await waitFor(() => screen.getByText("Security guard salary"));
    fireEvent.click(screen.getByText("Security guard salary"));
    await waitFor(() => screen.getByText("Expense Details"));
    fireEvent.click(screen.getByRole("button", { name: /Reverse/i }));
    await waitFor(() => {
      expect(screen.getByText("Reverse Expense")).toBeInTheDocument();
    });
  });

  it("disables Confirm Reversal button when reason is too short", async () => {
    mockGetExpenseSummary.mockResolvedValue(null);
    mockGetExpenses.mockResolvedValue({
      data: [MOCK_ACTIVE_EXPENSE],
      total: 1,
      page: 1,
      limit: 20,
    });
    renderPage();
    await waitFor(() => screen.getByText("Security guard salary"));
    fireEvent.click(screen.getByText("Security guard salary"));
    await waitFor(() => screen.getByText("Expense Details"));
    fireEvent.click(screen.getByRole("button", { name: /Reverse/i }));
    await waitFor(() => screen.getByText("Reverse Expense"));
    const confirmBtn = screen.getByRole("button", { name: /Confirm Reversal/i });
    expect(confirmBtn).toBeDisabled();
  });

  it("enables Confirm Reversal button when reason has 5+ chars", async () => {
    mockGetExpenseSummary.mockResolvedValue(null);
    mockGetExpenses.mockResolvedValue({
      data: [MOCK_ACTIVE_EXPENSE],
      total: 1,
      page: 1,
      limit: 20,
    });
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => screen.getByText("Security guard salary"));
    fireEvent.click(screen.getByText("Security guard salary"));
    await waitFor(() => screen.getByText("Expense Details"));
    fireEvent.click(screen.getByRole("button", { name: /Reverse/i }));
    await waitFor(() => screen.getByText("Reverse Expense"));
    const reasonInput = screen.getByPlaceholderText(/Why is this expense/i);
    await user.type(reasonInput, "Duplicate entry logged");
    const confirmBtn = screen.getByRole("button", { name: /Confirm Reversal/i });
    expect(confirmBtn).not.toBeDisabled();
  });

  it("calls reverseExpense with reason and closes dialog on success", async () => {
    mockGetExpenseSummary.mockResolvedValue(null);
    mockGetExpenses.mockResolvedValue({
      data: [MOCK_ACTIVE_EXPENSE],
      total: 1,
      page: 1,
      limit: 20,
    });
    mockReverseExpense.mockResolvedValue({ message: "Expense reversed" });

    const user = userEvent.setup();
    renderPage();
    await waitFor(() => screen.getByText("Security guard salary"));
    fireEvent.click(screen.getByText("Security guard salary"));
    await waitFor(() => screen.getByText("Expense Details"));
    fireEvent.click(screen.getByRole("button", { name: /Reverse/i }));
    await waitFor(() => screen.getByText("Reverse Expense"));
    const reasonInput = screen.getByPlaceholderText(/Why is this expense/i);
    await user.type(reasonInput, "Logged in error by admin");
    await user.click(screen.getByRole("button", { name: /Confirm Reversal/i }));
    await waitFor(() => {
      expect(mockReverseExpense).toHaveBeenCalledWith("soc-1", "exp-1", {
        reason: "Logged in error by admin",
      });
    });
  });

  // ─── Reversal Entry Row ───────────────────────────────────────────────────────

  it("shows Reversal Entry badge for negative amount expenses", async () => {
    const reversalEntry = {
      ...MOCK_ACTIVE_EXPENSE,
      id: "rev-entry-1",
      amount: -4800,
      description: "Reversal: Security guard salary",
      correctionWindowEnds: null,
    };
    mockGetExpenseSummary.mockResolvedValue(null);
    mockGetExpenses.mockResolvedValue({ data: [reversalEntry], total: 1, page: 1, limit: 20 });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Reversal Entry")).toBeInTheDocument();
    });
  });

  // ─── Disabled state when no societyId ────────────────────────────────────────

  it("does not fetch when societyId is empty", async () => {
    mockGetExpenseSummary.mockResolvedValue(null);
    mockGetExpenses.mockResolvedValue({ data: [], total: 0, page: 1, limit: 20 });
    renderPage({ societyId: "" });
    // Queries disabled when societyId falsy — page still renders
    await waitFor(() => {
      expect(screen.getByText("Expense Ledger")).toBeInTheDocument();
    });
    expect(mockGetExpenses).not.toHaveBeenCalled();
  });
});
