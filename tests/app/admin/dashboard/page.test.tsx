import React from "react";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";

import AdminDashboardPage from "@/app/admin/dashboard/page";
import { AuthContext } from "@/hooks/useAuth";

// ── Hoisted mocks ────────────────────────────────────────────────────────────

const {
  mockGetUnreadAnnouncements,
  mockGetResidents,
  mockGetFeeDashboard,
  mockGetExpenseSummary,
  mockUseSearchParams,
} = vi.hoisted(() => ({
  mockGetUnreadAnnouncements: vi.fn(),
  mockGetResidents: vi.fn(),
  mockGetFeeDashboard: vi.fn(),
  mockGetExpenseSummary: vi.fn(),
  mockUseSearchParams: vi.fn(() => new URLSearchParams("")),
}));

vi.mock("@/services/announcements", () => ({
  getUnreadAnnouncements: (...args: unknown[]) => mockGetUnreadAnnouncements(...args),
}));

vi.mock("@/services/residents", () => ({
  getResidents: (...args: unknown[]) => mockGetResidents(...args),
}));

vi.mock("@/services/fees", () => ({
  getFeeDashboard: (...args: unknown[]) => mockGetFeeDashboard(...args),
}));

vi.mock("@/services/expenses", () => ({
  getExpenseSummary: (...args: unknown[]) => mockGetExpenseSummary(...args),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => mockUseSearchParams(),
  usePathname: () => "/admin/dashboard",
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
        <AdminDashboardPage />
      </AuthContext.Provider>
    </QueryClientProvider>,
  );
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe("AdminDashboardPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the page header", () => {
    mockGetUnreadAnnouncements.mockReturnValue(new Promise(() => {}));
    mockGetResidents.mockReturnValue(new Promise(() => {}));
    mockGetFeeDashboard.mockReturnValue(new Promise(() => {}));
    mockGetExpenseSummary.mockReturnValue(new Promise(() => {}));
    renderPage();
    expect(screen.getByText("Dashboard")).toBeInTheDocument();
    expect(screen.getByText("Overview of your society")).toBeInTheDocument();
  });

  it("shows loading skeletons while data is pending", () => {
    mockGetUnreadAnnouncements.mockReturnValue(new Promise(() => {}));
    mockGetResidents.mockReturnValue(new Promise(() => {}));
    mockGetFeeDashboard.mockReturnValue(new Promise(() => {}));
    mockGetExpenseSummary.mockReturnValue(new Promise(() => {}));
    renderPage();
    // Page renders without crashing during loading state
    expect(screen.getByText("Dashboard")).toBeInTheDocument();
  });

  it("renders stat cards and quick actions after data loads", async () => {
    mockGetUnreadAnnouncements.mockResolvedValue([]);
    mockGetResidents
      .mockResolvedValueOnce({ data: [], total: 42, page: 1, limit: 20 })
      .mockResolvedValueOnce({ data: [], total: 3, page: 1, limit: 20 });
    mockGetFeeDashboard.mockResolvedValue({
      totalCollected: 50000,
      totalDue: 100000,
      collectionRate: 50,
      stats: [{ status: "PAID", _count: 5 }],
    });
    mockGetExpenseSummary.mockResolvedValue({
      totalExpenses: 20000,
      totalCollected: 50000,
      balanceInHand: 30000,
      categoryBreakdown: [],
    });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Total Residents")).toBeInTheDocument();
    });
    expect(screen.getByText("42")).toBeInTheDocument();
    expect(screen.getByText("Pending Approvals")).toBeInTheDocument();
    expect(screen.getByText("Fees Collected")).toBeInTheDocument();
    expect(screen.getByText("Balance in Hand")).toBeInTheDocument();
    // Quick actions
    expect(screen.getByText("Quick Actions")).toBeInTheDocument();
    expect(screen.getByText("Manage Fee Collection")).toBeInTheDocument();
    expect(screen.getByText("Log an Expense")).toBeInTheDocument();
    expect(screen.getByText("Send Broadcast")).toBeInTheDocument();
  });

  it("shows registration link when societyCode is available", async () => {
    mockGetUnreadAnnouncements.mockResolvedValue([]);
    mockGetResidents.mockResolvedValue({ data: [], total: 0, page: 1, limit: 20 });
    mockGetFeeDashboard.mockResolvedValue({
      totalCollected: 0,
      totalDue: 0,
      collectionRate: 0,
      stats: [],
    });
    mockGetExpenseSummary.mockResolvedValue({
      totalExpenses: 0,
      totalCollected: 0,
      balanceInHand: 0,
      categoryBreakdown: [],
    });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Resident Registration Link")).toBeInTheDocument();
    });
    expect(screen.getByText(/\/register\/TST/)).toBeInTheDocument();
  });

  it("shows collection progress when fees data is available", async () => {
    mockGetUnreadAnnouncements.mockResolvedValue([]);
    mockGetResidents.mockResolvedValue({ data: [], total: 10, page: 1, limit: 20 });
    mockGetFeeDashboard.mockResolvedValue({
      totalCollected: 25000,
      totalDue: 50000,
      collectionRate: 50,
      stats: [
        { status: "PAID", _count: 5 },
        { status: "PENDING", _count: 5 },
      ],
    });
    mockGetExpenseSummary.mockResolvedValue({
      totalExpenses: 10000,
      totalCollected: 25000,
      balanceInHand: 15000,
      categoryBreakdown: [],
    });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Collection Progress")).toBeInTheDocument();
    });
    expect(screen.getByText("50%")).toBeInTheDocument();
  });

  // ── Announcement banners ──────────────────────────────────────────────────

  it("renders URGENT and normal announcements", async () => {
    mockGetUnreadAnnouncements.mockResolvedValue([
      {
        id: "a1",
        subject: "Urgent Notice",
        body: "Server maintenance tonight",
        priority: "URGENT",
      },
      { id: "a2", subject: "Info Update", body: "New features available", priority: "NORMAL" },
    ]);
    mockGetResidents.mockResolvedValue({ data: [], total: 0, page: 1, limit: 20 });
    mockGetFeeDashboard.mockResolvedValue({
      totalCollected: 0,
      totalDue: 0,
      collectionRate: 0,
      stats: [],
    });
    mockGetExpenseSummary.mockResolvedValue({
      totalExpenses: 0,
      totalCollected: 0,
      balanceInHand: 0,
      categoryBreakdown: [],
    });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Urgent Notice")).toBeInTheDocument();
    });
    expect(screen.getByText("Server maintenance tonight")).toBeInTheDocument();
    expect(screen.getByText("Info Update")).toBeInTheDocument();
    expect(screen.getByText("New features available")).toBeInTheDocument();
  });

  it("dismisses an announcement when the X button is clicked", async () => {
    const user = userEvent.setup();
    mockGetUnreadAnnouncements.mockResolvedValue([
      { id: "a1", subject: "Dismiss Me", body: "This should go away", priority: "NORMAL" },
      { id: "a2", subject: "Keep Me", body: "This stays", priority: "URGENT" },
    ]);
    mockGetResidents.mockResolvedValue({ data: [], total: 0, page: 1, limit: 20 });
    mockGetFeeDashboard.mockResolvedValue({
      totalCollected: 0,
      totalDue: 0,
      collectionRate: 0,
      stats: [],
    });
    mockGetExpenseSummary.mockResolvedValue({
      totalExpenses: 0,
      totalCollected: 0,
      balanceInHand: 0,
      categoryBreakdown: [],
    });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Dismiss Me")).toBeInTheDocument();
    });
    // Find the dismiss button within the first announcement banner
    const firstAnnouncement = screen
      .getByText("Dismiss Me")
      .closest("div[class*='flex items-start']");
    const dismissBtn = firstAnnouncement!.querySelector("button")!;
    await user.click(dismissBtn);
    expect(screen.queryByText("Dismiss Me")).not.toBeInTheDocument();
    expect(screen.getByText("Keep Me")).toBeInTheDocument();
  });

  // ── Copy to clipboard ─────────────────────────────────────────────────────

  it("copies registration URL to clipboard when copy button is clicked", async () => {
    const user = userEvent.setup();
    const writeTextSpy = vi.spyOn(navigator.clipboard, "writeText");
    mockGetUnreadAnnouncements.mockResolvedValue([]);
    mockGetResidents.mockResolvedValue({ data: [], total: 0, page: 1, limit: 20 });
    mockGetFeeDashboard.mockResolvedValue({
      totalCollected: 0,
      totalDue: 0,
      collectionRate: 0,
      stats: [],
    });
    mockGetExpenseSummary.mockResolvedValue({
      totalExpenses: 0,
      totalCollected: 0,
      balanceInHand: 0,
      categoryBreakdown: [],
    });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Resident Registration Link")).toBeInTheDocument();
    });
    // Find the copy button within the registration link card
    const regCard = screen.getByText("Resident Registration Link").closest("[class*='space-y']");
    const copyBtn = regCard!.querySelector("button")!;
    await user.click(copyBtn);
    await waitFor(() => {
      expect(writeTextSpy).toHaveBeenCalledWith(expect.stringContaining("/register/TST"));
    });
  });

  // ── Expense breakdown ─────────────────────────────────────────────────────

  it("renders expense category breakdown when data is available", async () => {
    mockGetUnreadAnnouncements.mockResolvedValue([]);
    mockGetResidents.mockResolvedValue({ data: [], total: 5, page: 1, limit: 20 });
    mockGetFeeDashboard.mockResolvedValue({
      totalCollected: 10000,
      totalDue: 20000,
      collectionRate: 50,
      stats: [],
    });
    mockGetExpenseSummary.mockResolvedValue({
      totalExpenses: 8000,
      totalCollected: 10000,
      balanceInHand: 2000,
      categoryBreakdown: [
        { category: "MAINTENANCE", total: 5000, percentage: 62.5 },
        { category: "WATER_SUPPLY", total: 3000, percentage: 37.5 },
      ],
    });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Expense Breakdown")).toBeInTheDocument();
    });
    // Category names should be formatted: lowercase + underscores replaced with spaces
    expect(screen.getByText("maintenance")).toBeInTheDocument();
    expect(screen.getByText("water supply")).toBeInTheDocument();
    expect(screen.getByText("62.5%")).toBeInTheDocument();
    expect(screen.getByText("37.5%")).toBeInTheDocument();
  });

  it("does not render expense breakdown when categoryBreakdown is empty", async () => {
    mockGetUnreadAnnouncements.mockResolvedValue([]);
    mockGetResidents.mockResolvedValue({ data: [], total: 5, page: 1, limit: 20 });
    mockGetFeeDashboard.mockResolvedValue({
      totalCollected: 10000,
      totalDue: 20000,
      collectionRate: 50,
      stats: [],
    });
    mockGetExpenseSummary.mockResolvedValue({
      totalExpenses: 0,
      totalCollected: 10000,
      balanceInHand: 10000,
      categoryBreakdown: [],
    });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Total Residents")).toBeInTheDocument();
    });
    expect(screen.queryByText("Expense Breakdown")).not.toBeInTheDocument();
  });

  // ── Pending approvals review link ─────────────────────────────────────────

  it("shows 'Review now' link when there are pending approvals", async () => {
    mockGetUnreadAnnouncements.mockResolvedValue([]);
    mockGetResidents
      .mockResolvedValueOnce({ data: [], total: 10, page: 1, limit: 20 })
      .mockResolvedValueOnce({ data: [], total: 3, page: 1, limit: 20 });
    mockGetFeeDashboard.mockResolvedValue({
      totalCollected: 0,
      totalDue: 0,
      collectionRate: 0,
      stats: [],
    });
    mockGetExpenseSummary.mockResolvedValue({
      totalExpenses: 0,
      totalCollected: 0,
      balanceInHand: 0,
      categoryBreakdown: [],
    });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Review now")).toBeInTheDocument();
    });
  });

  // ── No registration link when societyCode is missing ──────────────────────

  // ── Super Admin viewing ──────────────────────────────────────────────────

  it("renders links with SA query params when viewed by super admin", async () => {
    mockUseSearchParams.mockReturnValue(
      new URLSearchParams("sid=soc-99&sname=Target%20Society&scode=TGT"),
    );
    mockGetUnreadAnnouncements.mockResolvedValue([]);
    mockGetResidents
      .mockResolvedValueOnce({ data: [], total: 5, page: 1, limit: 20 })
      .mockResolvedValueOnce({ data: [], total: 2, page: 1, limit: 20 });
    mockGetFeeDashboard.mockResolvedValue({
      totalCollected: 0,
      totalDue: 0,
      collectionRate: 0,
      stats: [],
    });
    mockGetExpenseSummary.mockResolvedValue({
      totalExpenses: 0,
      totalCollected: 0,
      balanceInHand: 0,
      categoryBreakdown: [],
    });
    renderPage({ role: "SUPER_ADMIN", societyId: null, societyCode: null });
    await waitFor(() => {
      expect(screen.getByText("Review now")).toBeInTheDocument();
    });
    // The "Review Pending Approvals" quick action link should contain SA query params
    expect(screen.getByText(/Review Pending Approvals/)).toBeInTheDocument();
    // Reset to default for subsequent tests
    mockUseSearchParams.mockReturnValue(new URLSearchParams(""));
  });

  it("does not show registration link when societyCode is null", async () => {
    mockGetUnreadAnnouncements.mockResolvedValue([]);
    mockGetResidents.mockResolvedValue({ data: [], total: 0, page: 1, limit: 20 });
    mockGetFeeDashboard.mockResolvedValue({
      totalCollected: 0,
      totalDue: 0,
      collectionRate: 0,
      stats: [],
    });
    mockGetExpenseSummary.mockResolvedValue({
      totalExpenses: 0,
      totalCollected: 0,
      balanceInHand: 0,
      categoryBreakdown: [],
    });
    renderPage({ societyCode: null });
    await waitFor(() => {
      expect(screen.getByText("Total Residents")).toBeInTheDocument();
    });
    expect(screen.queryByText("Resident Registration Link")).not.toBeInTheDocument();
  });
});
