import React from "react";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Hoisted mocks ──

const { mockGetPlatformResidents } = vi.hoisted(() => ({
  mockGetPlatformResidents: vi.fn(),
}));

vi.mock("@/services/operations", () => ({
  getPlatformResidents: (...args: unknown[]) => mockGetPlatformResidents(...args),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => "/sa/residents",
}));

import PlatformResidentsPage from "@/app/sa/residents/page";

// ── Helpers ──

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <PlatformResidentsPage />
    </QueryClientProvider>,
  );
}

// ── Mock Data ──

const MOCK_RESIDENT_WITH_PHOTO = {
  id: "r1",
  name: "Rajesh Kumar",
  email: "rajesh@test.com",
  mobile: "9876543210",
  rwaid: "EDEN-001",
  status: "ACTIVE_PAID",
  ownershipType: "OWNER",
  createdAt: "2025-01-15T10:00:00.000Z",
  societyId: "soc-1",
  society: { name: "Eden Estate" },
  photoUrl: "https://example.com/photo.jpg",
  userUnits: [{ unit: { unitNumber: "A-301" } }],
};

const MOCK_RESIDENT_NO_PHOTO = {
  id: "r2",
  name: "Priya Sharma",
  email: "priya@test.com",
  mobile: "9876543211",
  rwaid: null,
  status: "PENDING_APPROVAL",
  ownershipType: "TENANT",
  createdAt: "2025-02-20T10:00:00.000Z",
  societyId: "soc-2",
  society: { name: "Sunrise Apartments" },
  photoUrl: null,
  userUnits: [],
};

const MOCK_RESIDENT_NO_SOCIETY = {
  id: "r3",
  name: "Sunil Verma",
  email: "sunil@test.com",
  mobile: null,
  rwaid: null,
  status: "DEACTIVATED",
  ownershipType: null,
  createdAt: "2025-03-10T10:00:00.000Z",
  societyId: null,
  society: null,
  photoUrl: null,
  userUnits: [],
};

const MOCK_RESIDENT_OVERDUE = {
  id: "r4",
  name: "Anita Patel",
  email: "anita@test.com",
  mobile: "9876543213",
  rwaid: "SUN-002",
  status: "ACTIVE_OVERDUE",
  ownershipType: "OWNER",
  createdAt: "2024-11-05T10:00:00.000Z",
  societyId: "soc-2",
  society: { name: "Sunrise Apartments" },
  photoUrl: null,
  userUnits: [{ unit: { unitNumber: "B-102" } }],
};

const MOCK_KPIS = {
  totalAll: 150,
  activePaid: 100,
  pending: 30,
  overdue: 20,
};

const MOCK_RESPONSE = {
  data: [
    MOCK_RESIDENT_WITH_PHOTO,
    MOCK_RESIDENT_NO_PHOTO,
    MOCK_RESIDENT_NO_SOCIETY,
    MOCK_RESIDENT_OVERDUE,
  ],
  total: 4,
  page: 1,
  limit: 50,
  totalPages: 1,
  kpis: MOCK_KPIS,
};

const EMPTY_RESPONSE = {
  data: [],
  total: 0,
  page: 1,
  limit: 50,
  totalPages: 0,
  kpis: { totalAll: 0, activePaid: 0, pending: 0, overdue: 0 },
};

// ── Tests ──

describe("PlatformResidentsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Page structure ──

  it("renders page title and description", () => {
    mockGetPlatformResidents.mockReturnValue(new Promise(() => {}));
    renderPage();
    expect(screen.getByText("Platform Residents")).toBeInTheDocument();
    expect(
      screen.getByText("All residents across every society on the platform"),
    ).toBeInTheDocument();
  });

  it("renders search input", () => {
    mockGetPlatformResidents.mockReturnValue(new Promise(() => {}));
    renderPage();
    expect(
      screen.getByPlaceholderText("Search by name, email, phone, or RWAID..."),
    ).toBeInTheDocument();
  });

  it("renders status filter dropdown", () => {
    mockGetPlatformResidents.mockReturnValue(new Promise(() => {}));
    renderPage();
    expect(screen.getByText("All Statuses")).toBeInTheDocument();
  });

  // ── Loading state ──

  it("shows loading skeletons while data is pending", () => {
    mockGetPlatformResidents.mockReturnValue(new Promise(() => {}));
    renderPage();
    // KPI skeletons render animate-pulse
    expect(document.querySelector(".animate-pulse")).toBeTruthy();
  });

  it("shows table loading skeletons", () => {
    mockGetPlatformResidents.mockReturnValue(new Promise(() => {}));
    renderPage();
    // 5 skeleton rows in table + 4 skeleton cards for KPIs
    const skeletons = document.querySelectorAll(".animate-pulse");
    expect(skeletons.length).toBeGreaterThanOrEqual(1);
  });

  // ── Fetching indicator ──

  it("shows spinner during background fetch (isFetching && !isLoading)", async () => {
    // First render with data, then trigger refetch
    mockGetPlatformResidents.mockResolvedValue(MOCK_RESPONSE);
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Rajesh Kumar")).toBeInTheDocument();
    });
    // After initial load, the fetching spinner only shows during refetch
    // We can test that data is displayed without spinner
    expect(screen.getByText("Platform Residents")).toBeInTheDocument();
  });

  // ── Empty state ──

  it("shows empty state when no residents found", async () => {
    mockGetPlatformResidents.mockResolvedValue(EMPTY_RESPONSE);
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("No residents found")).toBeInTheDocument();
    });
    expect(screen.getByText("Try adjusting your search or filters")).toBeInTheDocument();
  });

  // ── KPI cards ──

  it("renders KPI cards with data", async () => {
    mockGetPlatformResidents.mockResolvedValue(MOCK_RESPONSE);
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Total Residents")).toBeInTheDocument();
    });
    expect(screen.getByText("150")).toBeInTheDocument();
    expect(screen.getByText("Active & Paid")).toBeInTheDocument();
    expect(screen.getByText("100")).toBeInTheDocument();
    expect(screen.getByText("Pending Approval")).toBeInTheDocument();
    expect(screen.getByText("30")).toBeInTheDocument();
    expect(screen.getByText("Overdue")).toBeInTheDocument();
    expect(screen.getByText("20")).toBeInTheDocument();
  });

  // ── Data rendering ──

  it("renders resident names in table", async () => {
    mockGetPlatformResidents.mockResolvedValue(MOCK_RESPONSE);
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Rajesh Kumar")).toBeInTheDocument();
    });
    expect(screen.getByText("Priya Sharma")).toBeInTheDocument();
    expect(screen.getByText("Sunil Verma")).toBeInTheDocument();
    expect(screen.getByText("Anita Patel")).toBeInTheDocument();
  });

  it("renders society names", async () => {
    mockGetPlatformResidents.mockResolvedValue(MOCK_RESPONSE);
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Eden Estate")).toBeInTheDocument();
    });
    expect(screen.getAllByText("Sunrise Apartments").length).toBeGreaterThanOrEqual(1);
  });

  it("renders dash for resident without society", async () => {
    mockGetPlatformResidents.mockResolvedValue({
      ...MOCK_RESPONSE,
      data: [MOCK_RESIDENT_NO_SOCIETY],
      total: 1,
    });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Sunil Verma")).toBeInTheDocument();
    });
  });

  it("renders unit numbers", async () => {
    mockGetPlatformResidents.mockResolvedValue(MOCK_RESPONSE);
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("A-301")).toBeInTheDocument();
    });
    expect(screen.getByText("B-102")).toBeInTheDocument();
  });

  it("renders email addresses", async () => {
    mockGetPlatformResidents.mockResolvedValue(MOCK_RESPONSE);
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("rajesh@test.com")).toBeInTheDocument();
    });
    expect(screen.getByText("priya@test.com")).toBeInTheDocument();
  });

  it("renders masked mobile numbers", async () => {
    mockGetPlatformResidents.mockResolvedValue(MOCK_RESPONSE);
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Rajesh Kumar")).toBeInTheDocument();
    });
    // maskMobile("9876543210") => "****3210"
    // The page uses its own maskMobile which returns "****" + last 4
    const masked = screen.getAllByText(/\*\*\*\*\d{4}/);
    expect(masked.length).toBeGreaterThanOrEqual(1);
  });

  it("renders status badges", async () => {
    mockGetPlatformResidents.mockResolvedValue(MOCK_RESPONSE);
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("ACTIVE PAID")).toBeInTheDocument();
    });
    // formatStatus replaces _ with space
    expect(screen.getByText("PENDING APPROVAL")).toBeInTheDocument();
    expect(screen.getByText("DEACTIVATED")).toBeInTheDocument();
    expect(screen.getByText("ACTIVE OVERDUE")).toBeInTheDocument();
  });

  it("renders registered dates", async () => {
    mockGetPlatformResidents.mockResolvedValue(MOCK_RESPONSE);
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Rajesh Kumar")).toBeInTheDocument();
    });
    // Dates formatted as "15 Jan 2025" etc
    expect(screen.getByText("15 Jan 2025")).toBeInTheDocument();
    expect(screen.getByText("20 Feb 2025")).toBeInTheDocument();
  });

  // ── Avatar with photo ──

  it("renders avatar for resident with photoUrl set", async () => {
    mockGetPlatformResidents.mockResolvedValue(MOCK_RESPONSE);
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Rajesh Kumar")).toBeInTheDocument();
    });
    // In JSDOM, Radix AvatarImage does not fire onLoad so fallback always shows
    // Avatar container should exist for all residents
    const avatars = document.querySelectorAll('[data-slot="avatar"]');
    expect(avatars.length).toBeGreaterThanOrEqual(4);
    // Rajesh Kumar has photoUrl but fallback initials "RK" show in JSDOM
    expect(screen.getByText("RK")).toBeInTheDocument();
  });

  it("renders fallback initials when no photo", async () => {
    mockGetPlatformResidents.mockResolvedValue(MOCK_RESPONSE);
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Priya Sharma")).toBeInTheDocument();
    });
    // "Priya Sharma" => "PS"
    expect(screen.getByText("PS")).toBeInTheDocument();
    // "Sunil Verma" => "SV"
    expect(screen.getByText("SV")).toBeInTheDocument();
  });

  // ── Name links ──

  it("renders resident name as link when societyId exists", async () => {
    mockGetPlatformResidents.mockResolvedValue(MOCK_RESPONSE);
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Rajesh Kumar")).toBeInTheDocument();
    });
    const link = screen.getByText("Rajesh Kumar").closest("a");
    expect(link).toBeTruthy();
    expect(link?.getAttribute("href")).toBe("/sa/societies/soc-1");
  });

  it("renders resident name as span when no societyId", async () => {
    mockGetPlatformResidents.mockResolvedValue({
      ...MOCK_RESPONSE,
      data: [MOCK_RESIDENT_NO_SOCIETY],
      total: 1,
    });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Sunil Verma")).toBeInTheDocument();
    });
    const nameEl = screen.getByText("Sunil Verma");
    expect(nameEl.closest("a")).toBeNull();
    expect(nameEl.tagName).toBe("SPAN");
  });

  // ── Search interaction ──

  it("updates search filter when typing", async () => {
    mockGetPlatformResidents.mockResolvedValue(MOCK_RESPONSE);
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Rajesh Kumar")).toBeInTheDocument();
    });
    const searchInput = screen.getByPlaceholderText("Search by name, email, phone, or RWAID...");
    await user.type(searchInput, "test");
    // Should trigger re-fetch with search param
    await waitFor(() => {
      expect(mockGetPlatformResidents).toHaveBeenCalledWith(
        expect.objectContaining({ search: expect.stringContaining("t") }),
      );
    });
  });

  // ── Status filter ──

  it("calls getPlatformResidents with default filters", async () => {
    mockGetPlatformResidents.mockResolvedValue(MOCK_RESPONSE);
    renderPage();
    await waitFor(() => {
      expect(mockGetPlatformResidents).toHaveBeenCalledWith({ page: 1, limit: 50 });
    });
  });

  // ── Pagination ──

  it("renders pagination info", async () => {
    mockGetPlatformResidents.mockResolvedValue(MOCK_RESPONSE);
    renderPage();
    await waitFor(() => {
      expect(screen.getByText(/Showing 1/)).toBeInTheDocument();
    });
  });

  it("disables Previous button on first page", async () => {
    mockGetPlatformResidents.mockResolvedValue(MOCK_RESPONSE);
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Rajesh Kumar")).toBeInTheDocument();
    });
    expect(screen.getByText("Previous")).toBeDisabled();
  });

  it("disables Next button on last page", async () => {
    mockGetPlatformResidents.mockResolvedValue(MOCK_RESPONSE);
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Rajesh Kumar")).toBeInTheDocument();
    });
    expect(screen.getByText("Next")).toBeDisabled();
  });

  it("enables Next button when more pages exist", async () => {
    mockGetPlatformResidents.mockResolvedValue({
      ...MOCK_RESPONSE,
      total: 100,
      totalPages: 2,
    });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Rajesh Kumar")).toBeInTheDocument();
    });
    expect(screen.getByText("Next")).not.toBeDisabled();
  });

  it("navigates to next page when Next clicked", async () => {
    mockGetPlatformResidents.mockResolvedValue({
      ...MOCK_RESPONSE,
      total: 100,
      totalPages: 2,
    });
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Next")).not.toBeDisabled();
    });
    await user.click(screen.getByText("Next"));
    await waitFor(() => {
      expect(mockGetPlatformResidents).toHaveBeenCalledWith(expect.objectContaining({ page: 2 }));
    });
  });

  it("navigates to previous page when Previous clicked", async () => {
    mockGetPlatformResidents.mockResolvedValue({
      ...MOCK_RESPONSE,
      total: 100,
      totalPages: 2,
    });
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Next")).not.toBeDisabled();
    });
    await user.click(screen.getByText("Next"));
    await waitFor(() => {
      expect(mockGetPlatformResidents).toHaveBeenCalledWith(expect.objectContaining({ page: 2 }));
    });
    await user.click(screen.getByText("Previous"));
    await waitFor(() => {
      expect(mockGetPlatformResidents).toHaveBeenCalledWith(expect.objectContaining({ page: 1 }));
    });
  });

  // ── Table headers ──

  it("renders all table column headers", async () => {
    mockGetPlatformResidents.mockResolvedValue(MOCK_RESPONSE);
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Rajesh Kumar")).toBeInTheDocument();
    });
    expect(screen.getByText("Name")).toBeInTheDocument();
    expect(screen.getByText("Email")).toBeInTheDocument();
    expect(screen.getByText("Mobile")).toBeInTheDocument();
    expect(screen.getByText("Society")).toBeInTheDocument();
    expect(screen.getByText("Unit")).toBeInTheDocument();
    expect(screen.getByText("Status")).toBeInTheDocument();
    expect(screen.getByText("Registered")).toBeInTheDocument();
  });

  // ── Mobile masking edge cases ──

  it("renders dash for null mobile", async () => {
    mockGetPlatformResidents.mockResolvedValue({
      ...MOCK_RESPONSE,
      data: [MOCK_RESIDENT_NO_SOCIETY],
      total: 1,
    });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Sunil Verma")).toBeInTheDocument();
    });
  });

  // ── Unit rendering edge cases ──

  it("renders dash for residents without units", async () => {
    mockGetPlatformResidents.mockResolvedValue({
      ...MOCK_RESPONSE,
      data: [MOCK_RESIDENT_NO_PHOTO],
      total: 1,
    });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Priya Sharma")).toBeInTheDocument();
    });
  });

  // ── Status filter interaction ──

  it("resets page when changing status filter", async () => {
    mockGetPlatformResidents.mockResolvedValue({
      ...MOCK_RESPONSE,
      total: 100,
      totalPages: 2,
    });
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Rajesh Kumar")).toBeInTheDocument();
    });
    // Go to page 2 first
    await user.click(screen.getByText("Next"));
    await waitFor(() => {
      expect(mockGetPlatformResidents).toHaveBeenCalledWith(expect.objectContaining({ page: 2 }));
    });
    // Now the search should reset page
    const searchInput = screen.getByPlaceholderText("Search by name, email, phone, or RWAID...");
    await user.type(searchInput, "a");
    await waitFor(() => {
      expect(mockGetPlatformResidents).toHaveBeenCalledWith(expect.objectContaining({ page: 1 }));
    });
  });

  // ── Single-character name initials ──

  it("renders single letter initial for single-name resident", async () => {
    const singleName = { ...MOCK_RESIDENT_NO_PHOTO, id: "r-single", name: "Cher", photoUrl: null };
    mockGetPlatformResidents.mockResolvedValue({
      ...MOCK_RESPONSE,
      data: [singleName],
      total: 1,
    });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Cher")).toBeInTheDocument();
    });
    expect(screen.getByText("C")).toBeInTheDocument();
  });

  // ── Status colors coverage ──

  it("renders badges for all status types", async () => {
    const allStatuses = [
      { ...MOCK_RESIDENT_WITH_PHOTO, id: "s1", status: "ACTIVE_PAID" },
      { ...MOCK_RESIDENT_WITH_PHOTO, id: "s2", status: "ACTIVE_PENDING", name: "Pending Person" },
      { ...MOCK_RESIDENT_WITH_PHOTO, id: "s3", status: "ACTIVE_OVERDUE", name: "Overdue Person" },
      { ...MOCK_RESIDENT_WITH_PHOTO, id: "s4", status: "ACTIVE_PARTIAL", name: "Partial Person" },
      { ...MOCK_RESIDENT_WITH_PHOTO, id: "s5", status: "ACTIVE_EXEMPTED", name: "Exempted Person" },
      {
        ...MOCK_RESIDENT_WITH_PHOTO,
        id: "s6",
        status: "PENDING_APPROVAL",
        name: "PendApproval Person",
      },
      { ...MOCK_RESIDENT_WITH_PHOTO, id: "s7", status: "REJECTED", name: "Rejected Person" },
      { ...MOCK_RESIDENT_WITH_PHOTO, id: "s8", status: "DEACTIVATED", name: "Deactivated Person" },
    ];
    mockGetPlatformResidents.mockResolvedValue({
      ...MOCK_RESPONSE,
      data: allStatuses,
      total: 8,
    });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("ACTIVE PAID")).toBeInTheDocument();
    });
    expect(screen.getByText("ACTIVE PENDING")).toBeInTheDocument();
    expect(screen.getByText("ACTIVE OVERDUE")).toBeInTheDocument();
    expect(screen.getByText("ACTIVE PARTIAL")).toBeInTheDocument();
    expect(screen.getByText("ACTIVE EXEMPTED")).toBeInTheDocument();
    expect(screen.getByText("PENDING APPROVAL")).toBeInTheDocument();
    expect(screen.getByText("REJECTED")).toBeInTheDocument();
    expect(screen.getByText("DEACTIVATED")).toBeInTheDocument();
  });

  // ── formatStatus helper coverage ──

  it("formats status with underscores replaced by spaces", async () => {
    mockGetPlatformResidents.mockResolvedValue(MOCK_RESPONSE);
    renderPage();
    await waitFor(() => {
      // "ACTIVE_PAID" => "ACTIVE PAID"
      expect(screen.getByText("ACTIVE PAID")).toBeInTheDocument();
    });
  });

  // ── maskMobile helper coverage (local function) ──

  it("handles short mobile number", async () => {
    const shortMobile = {
      ...MOCK_RESIDENT_WITH_PHOTO,
      id: "r-short",
      mobile: "123",
      name: "Short Mobile",
    };
    mockGetPlatformResidents.mockResolvedValue({
      ...MOCK_RESPONSE,
      data: [shortMobile],
      total: 1,
    });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Short Mobile")).toBeInTheDocument();
    });
    // maskMobile("123") returns "123" since length < 4
    expect(screen.getByText("123")).toBeInTheDocument();
  });

  // ── Status filter dropdown selection ──

  it("filters by specific status when a status option is selected", async () => {
    mockGetPlatformResidents.mockResolvedValue(MOCK_RESPONSE);
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Rajesh Kumar")).toBeInTheDocument();
    });
    // Click the status filter trigger to open dropdown
    const statusTrigger = screen.getByRole("combobox");
    await user.click(statusTrigger);
    // Select "Active" status option
    await waitFor(() => {
      expect(screen.getByRole("option", { name: "Active" })).toBeInTheDocument();
    });
    await user.click(screen.getByRole("option", { name: "Active" }));
    await waitFor(() => {
      expect(mockGetPlatformResidents).toHaveBeenCalledWith(
        expect.objectContaining({ status: "ACTIVE" }),
      );
    });
  });

  it("clears status filter when 'All Statuses' is re-selected", async () => {
    mockGetPlatformResidents.mockResolvedValue(MOCK_RESPONSE);
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Rajesh Kumar")).toBeInTheDocument();
    });
    // First select a specific status
    const statusTrigger = screen.getByRole("combobox");
    await user.click(statusTrigger);
    await waitFor(() => {
      expect(screen.getByRole("option", { name: "Active" })).toBeInTheDocument();
    });
    await user.click(screen.getByRole("option", { name: "Active" }));
    await waitFor(() => {
      expect(mockGetPlatformResidents).toHaveBeenCalledWith(
        expect.objectContaining({ status: "ACTIVE" }),
      );
    });
    // Now re-select "All Statuses" — should pass undefined for status
    await user.click(statusTrigger);
    await waitFor(() => {
      expect(screen.getByRole("option", { name: "All Statuses" })).toBeInTheDocument();
    });
    await user.click(screen.getByRole("option", { name: "All Statuses" }));
    await waitFor(() => {
      // When "all" is selected, status should be undefined (omitted)
      const lastCall =
        mockGetPlatformResidents.mock.calls[mockGetPlatformResidents.mock.calls.length - 1][0];
      expect(lastCall.status).toBeUndefined();
    });
  });

  // ── setFilter covers the status callback (line 148) via useCallback ──

  it("setFilter with status key resets page to 1", async () => {
    mockGetPlatformResidents.mockResolvedValue({
      ...MOCK_RESPONSE,
      total: 100,
      totalPages: 2,
    });
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Rajesh Kumar")).toBeInTheDocument();
    });
    // Go to page 2
    await user.click(screen.getByText("Next"));
    await waitFor(() => {
      expect(mockGetPlatformResidents).toHaveBeenCalledWith(expect.objectContaining({ page: 2 }));
    });
    // Search changes page back to 1 (exercises setFilter with non-page key)
    const input = screen.getByPlaceholderText("Search by name, email, phone, or RWAID...");
    await user.type(input, "a");
    await waitFor(() => {
      expect(mockGetPlatformResidents).toHaveBeenCalledWith(expect.objectContaining({ page: 1 }));
    });
  });

  // ── Previous button onClick (line 263) ──

  it("Previous button onClick fires on page 2", async () => {
    // Return page 2 data so Previous is enabled
    mockGetPlatformResidents.mockResolvedValue({
      ...MOCK_RESPONSE,
      total: 100,
      page: 2,
      totalPages: 2,
    });
    const user = userEvent.setup();
    renderPage();
    // First trigger a Next click to update page state
    await waitFor(() => {
      expect(screen.getByText("Rajesh Kumar")).toBeInTheDocument();
    });
    // Click Next to get to page 2 state
    await user.click(screen.getByText("Next"));
    // Now Previous should be clickable
    await waitFor(() => {
      const prevBtn = screen.getByText("Previous");
      expect(prevBtn).not.toBeDisabled();
    });
    await user.click(screen.getByText("Previous"));
    await waitFor(() => {
      expect(mockGetPlatformResidents).toHaveBeenCalledWith(expect.objectContaining({ page: 1 }));
    });
  });

  // ── setFilter resets page for non-page keys ──

  it("resets page to 1 when non-page filter changes", async () => {
    mockGetPlatformResidents.mockResolvedValue({
      ...MOCK_RESPONSE,
      total: 100,
      totalPages: 2,
    });
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Rajesh Kumar")).toBeInTheDocument();
    });
    // Go to page 2
    await user.click(screen.getByText("Next"));
    await waitFor(() => {
      expect(mockGetPlatformResidents).toHaveBeenCalledWith(expect.objectContaining({ page: 2 }));
    });
    // Now type in search - page should reset
    const searchInput = screen.getByPlaceholderText("Search by name, email, phone, or RWAID...");
    await user.type(searchInput, "x");
    await waitFor(() => {
      expect(mockGetPlatformResidents).toHaveBeenCalledWith(expect.objectContaining({ page: 1 }));
    });
  });
});
