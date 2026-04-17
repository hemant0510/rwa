import React from "react";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor, within, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi, beforeEach } from "vitest";

import PetitionsPage from "@/app/admin/petitions/page";
import { AuthContext } from "@/hooks/useAuth";

// ── Hoisted mocks ────────────────────────────────────────────────────────────

const { mockGetPetitions, mockCreatePetition, mockPush } = vi.hoisted(() => ({
  mockGetPetitions: vi.fn(),
  mockCreatePetition: vi.fn(),
  mockPush: vi.fn(),
}));

vi.mock("@/services/petitions", () => ({
  getPetitions: (...args: unknown[]) => mockGetPetitions(...args),
  createPetition: (...args: unknown[]) => mockCreatePetition(...args),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(""),
  usePathname: () => "/admin/petitions",
  useParams: () => ({}),
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

// Mock Radix Select with native <select> so onValueChange fires in JSDOM
vi.mock("@/components/ui/select", () => ({
  Select: ({
    children,
    value,
    onValueChange,
  }: {
    children: React.ReactNode;
    value?: string;
    onValueChange?: (v: string) => void;
  }) => (
    <select
      data-testid="mock-select"
      value={value}
      onChange={(e: React.ChangeEvent<HTMLSelectElement>) => onValueChange?.(e.target.value)}
    >
      {children}
    </select>
  ),
  SelectTrigger: ({ children }: { children: React.ReactNode; className?: string }) => (
    <>{children}</>
  ),
  SelectContent: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SelectItem: ({ children, value }: { children: React.ReactNode; value: string }) => (
    <option value={value}>{children}</option>
  ),
  SelectValue: () => null,
}));

// ── Fixtures ─────────────────────────────────────────────────────────────────

const MOCK_PETITION_COMPLAINT = {
  id: "pet-1",
  title: "Fix Water Supply",
  type: "COMPLAINT",
  status: "PUBLISHED",
  targetAuthority: "Municipal Corp",
  minSignatures: 50,
  _count: { signatures: 12 },
  createdAt: "2026-04-10T10:00:00.000Z",
  creator: { name: "Admin" },
};

const MOCK_PETITION_DRAFT = {
  id: "pet-2",
  title: "Park Renovation",
  type: "PETITION",
  status: "DRAFT",
  targetAuthority: null,
  minSignatures: null,
  _count: { signatures: 0 },
  createdAt: "2026-04-12T10:00:00.000Z",
  creator: { name: "Admin" },
};

const MOCK_PETITION_NOTICE = {
  id: "pet-3",
  title: "Annual Meeting Notice",
  type: "NOTICE",
  status: "SUBMITTED",
  targetAuthority: "RWA Board",
  minSignatures: 10,
  _count: { signatures: 10 },
  createdAt: "2026-04-14T10:00:00.000Z",
  creator: { name: "Admin" },
};

const MOCK_PETITION_CLOSED = {
  id: "pet-4",
  title: "Closed Petition",
  type: "PETITION",
  status: "CLOSED",
  targetAuthority: null,
  minSignatures: null,
  _count: { signatures: 3 },
  createdAt: "2026-04-15T10:00:00.000Z",
  creator: { name: "Admin" },
};

const MOCK_PETITION_NO_COUNT = {
  id: "pet-5",
  title: "No Count Petition",
  type: "PETITION",
  status: "DRAFT",
  targetAuthority: "—",
  minSignatures: null,
  _count: undefined,
  createdAt: "2026-04-15T10:00:00.000Z",
  creator: { name: "Admin" },
};

const EMPTY_LIST = { data: [], total: 0, page: 1, limit: 20 };

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
        <PetitionsPage />
      </AuthContext.Provider>
    </QueryClientProvider>,
  );
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe("AdminPetitionsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ─── Page Header & Basic Rendering ──────────────────────────────────────

  it("renders the page header and create button", async () => {
    mockGetPetitions.mockReturnValue(new Promise(() => {}));
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Petitions")).toBeInTheDocument();
    });
    expect(screen.getByText("Manage community petitions & complaints")).toBeInTheDocument();
    expect(screen.getByText("Create Petition")).toBeInTheDocument();
  });

  it("does not fetch when societyId is empty", async () => {
    mockGetPetitions.mockResolvedValue(EMPTY_LIST);
    renderPage({ societyId: "" });
    await waitFor(() => {
      expect(screen.getByText("Petitions")).toBeInTheDocument();
    });
    expect(mockGetPetitions).not.toHaveBeenCalled();
  });

  // ─── Empty State ────────────────────────────────────────────────────────

  it("shows empty state when no petitions exist", async () => {
    mockGetPetitions.mockResolvedValue(EMPTY_LIST);
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("No petitions found.")).toBeInTheDocument();
    });
  });

  // ─── Table Rendering ───────────────────────────────────────────────────

  it("renders petition rows in the table after data loads", async () => {
    mockGetPetitions.mockResolvedValue({
      data: [MOCK_PETITION_COMPLAINT, MOCK_PETITION_DRAFT],
      total: 2,
      page: 1,
      limit: 20,
    });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Fix Water Supply")).toBeInTheDocument();
    });
    expect(screen.getByText("Park Renovation")).toBeInTheDocument();
    expect(screen.getByText("Municipal Corp")).toBeInTheDocument();
    expect(screen.getByText("12/50")).toBeInTheDocument();
    // Status badges (may also appear in filter <option> elements)
    expect(screen.getAllByText("Published").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Draft").length).toBeGreaterThanOrEqual(1);
    // Type badges (may also appear in filter <option> elements)
    expect(screen.getAllByText("Complaint").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByText("Petition").length).toBeGreaterThanOrEqual(1);
  });

  it("shows dash for null targetAuthority", async () => {
    mockGetPetitions.mockResolvedValue({
      data: [MOCK_PETITION_DRAFT],
      total: 1,
      page: 1,
      limit: 20,
    });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Park Renovation")).toBeInTheDocument();
    });
    // null targetAuthority renders "—"
    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("shows signature count without minSignatures when minSignatures is null", async () => {
    mockGetPetitions.mockResolvedValue({
      data: [MOCK_PETITION_DRAFT],
      total: 1,
      page: 1,
      limit: 20,
    });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Park Renovation")).toBeInTheDocument();
    });
    // minSignatures is null → shows just count (0) without /max
    expect(screen.getByText("0")).toBeInTheDocument();
  });

  it("shows 0 signatures when _count is undefined and minSignatures is null", async () => {
    mockGetPetitions.mockResolvedValue({
      data: [MOCK_PETITION_NO_COUNT],
      total: 1,
      page: 1,
      limit: 20,
    });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("No Count Petition")).toBeInTheDocument();
    });
    // _count is undefined, minSignatures is null → falls back to 0
    expect(screen.getByText("0")).toBeInTheDocument();
  });

  it("shows 0/N when minSignatures is set but _count is undefined", async () => {
    mockGetPetitions.mockResolvedValue({
      data: [
        {
          ...MOCK_PETITION_NO_COUNT,
          id: "pet-6",
          title: "Min Sigs No Count",
          minSignatures: 25,
          _count: undefined,
        },
      ],
      total: 1,
      page: 1,
      limit: 20,
    });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Min Sigs No Count")).toBeInTheDocument();
    });
    // minSignatures != null but _count undefined → "0/25"
    expect(screen.getByText("0/25")).toBeInTheDocument();
  });

  it("formats createdAt date correctly", async () => {
    mockGetPetitions.mockResolvedValue({
      data: [MOCK_PETITION_COMPLAINT],
      total: 1,
      page: 1,
      limit: 20,
    });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("10 Apr 2026")).toBeInTheDocument();
    });
  });

  // ─── Status Badges ─────────────────────────────────────────────────────

  it("renders SUBMITTED status badge", async () => {
    mockGetPetitions.mockResolvedValue({
      data: [MOCK_PETITION_NOTICE],
      total: 1,
      page: 1,
      limit: 20,
    });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Submitted")).toBeInTheDocument();
    });
  });

  it("renders CLOSED status badge", async () => {
    mockGetPetitions.mockResolvedValue({
      data: [MOCK_PETITION_CLOSED],
      total: 1,
      page: 1,
      limit: 20,
    });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Closed")).toBeInTheDocument();
    });
  });

  it("renders fallback for unknown status", async () => {
    mockGetPetitions.mockResolvedValue({
      data: [{ ...MOCK_PETITION_DRAFT, status: "UNKNOWN_STATUS" }],
      total: 1,
      page: 1,
      limit: 20,
    });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Unknown_status")).toBeInTheDocument();
    });
  });

  // ─── Type Badges ────────────────────────────────────────────────────────

  it("renders NOTICE type badge", async () => {
    mockGetPetitions.mockResolvedValue({
      data: [MOCK_PETITION_NOTICE],
      total: 1,
      page: 1,
      limit: 20,
    });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Notice")).toBeInTheDocument();
    });
  });

  it("renders fallback for unknown type", async () => {
    mockGetPetitions.mockResolvedValue({
      data: [{ ...MOCK_PETITION_DRAFT, type: "UNKNOWN_TYPE" }],
      total: 1,
      page: 1,
      limit: 20,
    });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Unknown_type")).toBeInTheDocument();
    });
  });

  // ─── Row Click Navigation ──────────────────────────────────────────────

  it("navigates to petition detail on row click", async () => {
    mockGetPetitions.mockResolvedValue({
      data: [MOCK_PETITION_COMPLAINT],
      total: 1,
      page: 1,
      limit: 20,
    });
    renderPage();
    await waitFor(() => screen.getByText("Fix Water Supply"));
    fireEvent.click(screen.getByText("Fix Water Supply"));
    expect(mockPush).toHaveBeenCalledWith("/admin/petitions/pet-1");
  });

  // ─── Filter Dropdowns ──────────────────────────────────────────────────

  it("renders filter dropdowns", async () => {
    mockGetPetitions.mockResolvedValue(EMPTY_LIST);
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("No petitions found.")).toBeInTheDocument();
    });
    // With mocked native selects, we get testid mock-select for each filter
    const selects = screen.getAllByTestId("mock-select");
    // At least 2 for status and type filters
    expect(selects.length).toBeGreaterThanOrEqual(2);
  });

  it("calls getPetitions with status filter when changed", async () => {
    mockGetPetitions.mockResolvedValue(EMPTY_LIST);
    renderPage();
    await waitFor(() => screen.getByText("No petitions found."));

    // Native <select> mock — the first mock-select is status filter
    const selects = screen.getAllByTestId("mock-select");
    fireEvent.change(selects[0], { target: { value: "DRAFT" } });

    await waitFor(() => {
      expect(mockGetPetitions).toHaveBeenCalledWith(
        "soc-1",
        expect.objectContaining({ status: "DRAFT" }),
      );
    });
  });

  it("calls getPetitions with type filter when changed", async () => {
    mockGetPetitions.mockResolvedValue(EMPTY_LIST);
    renderPage();
    await waitFor(() => screen.getByText("No petitions found."));

    // Native <select> mock — the second mock-select is type filter
    const selects = screen.getAllByTestId("mock-select");
    fireEvent.change(selects[1], { target: { value: "COMPLAINT" } });

    await waitFor(() => {
      expect(mockGetPetitions).toHaveBeenCalledWith(
        "soc-1",
        expect.objectContaining({ type: "COMPLAINT" }),
      );
    });
  });

  // ─── Pagination ─────────────────────────────────────────────────────────

  it("shows pagination when total exceeds limit", async () => {
    mockGetPetitions.mockResolvedValue({
      data: [MOCK_PETITION_COMPLAINT],
      total: 25,
      page: 1,
      limit: 20,
    });
    renderPage();
    await waitFor(
      () => {
        expect(screen.getByRole("button", { name: /Next/i })).toBeInTheDocument();
      },
      { timeout: 5000 },
    );
    expect(screen.getByRole("button", { name: /Previous/i })).toBeInTheDocument();
  });

  it("Previous button is disabled on first page", async () => {
    mockGetPetitions.mockResolvedValue({
      data: [MOCK_PETITION_COMPLAINT],
      total: 25,
      page: 1,
      limit: 20,
    });
    renderPage();
    await waitFor(() => {
      expect(screen.getByRole("button", { name: /Previous/i })).toBeDisabled();
    });
  });

  it("does not show pagination when total fits in one page", async () => {
    mockGetPetitions.mockResolvedValue({
      data: [MOCK_PETITION_COMPLAINT],
      total: 1,
      page: 1,
      limit: 20,
    });
    renderPage();
    await waitFor(() => screen.getByText("Fix Water Supply"));
    expect(screen.queryByRole("button", { name: /Next/i })).not.toBeInTheDocument();
  });

  it("shows pagination range text", async () => {
    mockGetPetitions.mockResolvedValue({
      data: [MOCK_PETITION_COMPLAINT],
      total: 25,
      page: 1,
      limit: 20,
    });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText(/Showing 1/)).toBeInTheDocument();
    });
    expect(screen.getByText(/of 25/)).toBeInTheDocument();
  });

  it("Next button advances to next page", async () => {
    mockGetPetitions.mockResolvedValue({
      data: [MOCK_PETITION_COMPLAINT],
      total: 45,
      page: 1,
      limit: 20,
    });
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => screen.getByRole("button", { name: /Next/i }));

    await user.click(screen.getByRole("button", { name: /Next/i }));
    await waitFor(() => {
      expect(mockGetPetitions).toHaveBeenCalledWith("soc-1", expect.objectContaining({ page: 2 }));
    });
  });

  it("Previous button goes back a page", async () => {
    // First render at page 1, then go to page 2 and back
    mockGetPetitions.mockResolvedValue({
      data: [MOCK_PETITION_COMPLAINT],
      total: 45,
      page: 1,
      limit: 20,
    });
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => screen.getByRole("button", { name: /Next/i }));

    // Go to page 2
    await user.click(screen.getByRole("button", { name: /Next/i }));
    await waitFor(() => {
      expect(mockGetPetitions).toHaveBeenCalledWith("soc-1", expect.objectContaining({ page: 2 }));
    });

    // Go back to page 1
    await user.click(screen.getByRole("button", { name: /Previous/i }));
    await waitFor(() => {
      const lastCall = mockGetPetitions.mock.calls[mockGetPetitions.mock.calls.length - 1];
      expect(lastCall[1]).toMatchObject({ page: 1 });
    });
  });

  it("Next button is disabled on last page", async () => {
    mockGetPetitions.mockResolvedValue({
      data: [MOCK_PETITION_COMPLAINT],
      total: 20,
      page: 1,
      limit: 20,
    });
    renderPage();
    // total === limit, no pagination shown
    await waitFor(() => screen.getByText("Fix Water Supply"));
    expect(screen.queryByRole("button", { name: /Next/i })).not.toBeInTheDocument();
  });

  // ─── Create Petition Dialog ─────────────────────────────────────────────

  it("opens create dialog on button click", async () => {
    mockGetPetitions.mockResolvedValue(EMPTY_LIST);
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => screen.getByRole("button", { name: /Create Petition/i }));
    await user.click(screen.getByRole("button", { name: /Create Petition/i }));
    await waitFor(() => {
      expect(screen.getByRole("dialog")).toBeInTheDocument();
    });
    expect(screen.getByRole("heading", { name: "Create Petition" })).toBeInTheDocument();
  });

  it("shows all form fields in create dialog", async () => {
    mockGetPetitions.mockResolvedValue(EMPTY_LIST);
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole("button", { name: /Create Petition/i }));
    await waitFor(() => screen.getByRole("dialog"));

    expect(screen.getByPlaceholderText("Petition title")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("Describe this petition...")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("e.g. Municipal Corporation")).toBeInTheDocument();
    expect(screen.getByPlaceholderText("e.g. 100")).toBeInTheDocument();
  });

  it("closes dialog and resets form on Cancel click", async () => {
    mockGetPetitions.mockResolvedValue(EMPTY_LIST);
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole("button", { name: /Create Petition/i }));
    await waitFor(() => screen.getByRole("dialog"));

    const dialog = screen.getByRole("dialog");
    await user.type(within(dialog).getByPlaceholderText("Petition title"), "Test");
    await user.click(within(dialog).getByRole("button", { name: /^Cancel$/i }));
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    });
  });

  it("submits create form with valid data and shows success toast", async () => {
    const { toast } = await import("sonner");
    mockGetPetitions.mockResolvedValue(EMPTY_LIST);
    mockCreatePetition.mockResolvedValue({ id: "pet-new", title: "New Petition" });

    const user = userEvent.setup();
    renderPage();
    await waitFor(() => screen.getByRole("button", { name: /Create Petition/i }));
    await user.click(screen.getByRole("button", { name: /Create Petition/i }));
    await waitFor(() => screen.getByRole("dialog"));

    const dialog = screen.getByRole("dialog");
    await user.type(within(dialog).getByPlaceholderText("Petition title"), "New Water Petition");

    // Click the submit button in footer
    const submitBtns = within(dialog).getAllByRole("button", { name: /Create Petition/i });
    await user.click(submitBtns[submitBtns.length - 1]);

    await waitFor(() => {
      expect(mockCreatePetition).toHaveBeenCalledWith(
        "soc-1",
        expect.objectContaining({ title: "New Water Petition" }),
      );
    });

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith("Petition created!");
    });
  });

  it("shows error toast on create mutation failure", async () => {
    const { toast } = await import("sonner");
    mockGetPetitions.mockResolvedValue(EMPTY_LIST);
    mockCreatePetition.mockRejectedValue(new Error("Server Error"));

    const user = userEvent.setup();
    renderPage();
    await waitFor(() => screen.getByRole("button", { name: /Create Petition/i }));
    await user.click(screen.getByRole("button", { name: /Create Petition/i }));
    await waitFor(() => screen.getByRole("dialog"));

    const dialog = screen.getByRole("dialog");
    await user.type(within(dialog).getByPlaceholderText("Petition title"), "Failing Petition");

    const submitBtns = within(dialog).getAllByRole("button", { name: /Create Petition/i });
    await user.click(submitBtns[submitBtns.length - 1]);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Server Error");
    });
  });

  it("does not call createPetition when title is empty (validation)", async () => {
    mockGetPetitions.mockResolvedValue(EMPTY_LIST);
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole("button", { name: /Create Petition/i }));
    await waitFor(() => screen.getByRole("dialog"));

    const dialog = screen.getByRole("dialog");
    // Submit without filling title
    const submitBtns = within(dialog).getAllByRole("button", { name: /Create Petition/i });
    await user.click(submitBtns[submitBtns.length - 1]);

    await waitFor(() => {
      expect(mockCreatePetition).not.toHaveBeenCalled();
    });
  });

  it("shows title validation error when title is too short", async () => {
    mockGetPetitions.mockResolvedValue(EMPTY_LIST);
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole("button", { name: /Create Petition/i }));
    await waitFor(() => screen.getByRole("dialog"));

    const dialog = screen.getByRole("dialog");
    await user.type(within(dialog).getByPlaceholderText("Petition title"), "AB");

    const submitBtns = within(dialog).getAllByRole("button", { name: /Create Petition/i });
    await user.click(submitBtns[submitBtns.length - 1]);

    await waitFor(() => {
      expect(screen.getByText(/Title must be at least 3 characters/)).toBeInTheDocument();
    });
    expect(mockCreatePetition).not.toHaveBeenCalled();
  });

  it("renders type select in create dialog and allows changing type", async () => {
    mockGetPetitions.mockResolvedValue(EMPTY_LIST);
    mockCreatePetition.mockResolvedValue({ id: "pet-new", title: "Typed" });
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole("button", { name: /Create Petition/i }));
    await waitFor(() => screen.getByRole("dialog"));

    const dialog = screen.getByRole("dialog");
    // The dialog has a third <select> for petition type (first two are page filters)
    const selects = within(dialog).getAllByTestId("mock-select");
    // Change type to COMPLAINT
    fireEvent.change(selects[0], { target: { value: "COMPLAINT" } });

    // Fill title and submit to verify the type was set
    await user.type(within(dialog).getByPlaceholderText("Petition title"), "Typed Petition");
    const submitBtns = within(dialog).getAllByRole("button", { name: /Create Petition/i });
    await user.click(submitBtns[submitBtns.length - 1]);

    await waitFor(() => {
      expect(mockCreatePetition).toHaveBeenCalledWith(
        "soc-1",
        expect.objectContaining({ type: "COMPLAINT" }),
      );
    });
  });

  it("submits with minSignatures when a number is entered", async () => {
    mockGetPetitions.mockResolvedValue(EMPTY_LIST);
    mockCreatePetition.mockResolvedValue({ id: "pet-ms", title: "MinSig" });
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole("button", { name: /Create Petition/i }));
    await waitFor(() => screen.getByRole("dialog"));

    const dialog = screen.getByRole("dialog");
    await user.type(within(dialog).getByPlaceholderText("Petition title"), "MinSig Petition");
    await user.type(within(dialog).getByPlaceholderText("e.g. 100"), "50");

    const submitBtns = within(dialog).getAllByRole("button", { name: /Create Petition/i });
    await user.click(submitBtns[submitBtns.length - 1]);

    await waitFor(() => {
      expect(mockCreatePetition).toHaveBeenCalledWith(
        "soc-1",
        expect.objectContaining({ title: "MinSig Petition", minSignatures: 50 }),
      );
    });
  });

  it("submits via form onSubmit when form is submitted natively", async () => {
    mockGetPetitions.mockResolvedValue(EMPTY_LIST);
    mockCreatePetition.mockResolvedValue({ id: "pet-new2", title: "Form Submit" });
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole("button", { name: /Create Petition/i }));
    await waitFor(() => screen.getByRole("dialog"));

    const dialog = screen.getByRole("dialog");
    await user.type(within(dialog).getByPlaceholderText("Petition title"), "Form Submit Test");

    // Trigger native form submit (covers onSubmit handler)
    const form = dialog.querySelector("form")!;
    fireEvent.submit(form);

    await waitFor(() => {
      expect(mockCreatePetition).toHaveBeenCalledWith(
        "soc-1",
        expect.objectContaining({ title: "Form Submit Test" }),
      );
    });
  });

  it("shows signature count with minSignatures format (count/min)", async () => {
    mockGetPetitions.mockResolvedValue({
      data: [MOCK_PETITION_NOTICE],
      total: 1,
      page: 1,
      limit: 20,
    });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("10/10")).toBeInTheDocument();
    });
  });
});
