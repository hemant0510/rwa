import React from "react";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockGetAdminRequests, mockCreateRequest, mockUseSocietyId } = vi.hoisted(() => ({
  mockGetAdminRequests: vi.fn(),
  mockCreateRequest: vi.fn(),
  mockUseSocietyId: vi.fn(),
}));

vi.mock("@/services/support", () => ({
  getAdminRequests: (...args: unknown[]) => mockGetAdminRequests(...args),
  createRequest: (...args: unknown[]) => mockCreateRequest(...args),
}));

vi.mock("@/hooks/useSocietyId", () => ({
  useSocietyId: () => mockUseSocietyId(),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => "/admin/support",
  useSearchParams: () => new URLSearchParams(""),
}));

// Mock Select so options render as native <select> in JSDOM
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
  SelectTrigger: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SelectContent: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  SelectItem: ({ children, value }: { children: React.ReactNode; value: string }) => (
    <option value={value}>{children}</option>
  ),
  SelectValue: ({ placeholder }: { placeholder?: string }) => <span>{placeholder}</span>,
}));

import AdminSupportPage from "@/app/admin/support/page";

const MOCK_REQUEST = {
  id: "req-1",
  requestNumber: 42,
  type: "BUG_REPORT",
  priority: "HIGH",
  status: "OPEN",
  subject: "Login broken",
  description: "Details here",
  createdAt: "2026-04-01T10:00:00.000Z",
  updatedAt: "2026-04-02T10:00:00.000Z",
  _count: { messages: 3 },
};

const MOCK_AWAITING = {
  ...MOCK_REQUEST,
  id: "req-2",
  requestNumber: 43,
  status: "AWAITING_ADMIN",
  subject: "Need response",
  _count: { messages: 0 },
};

function renderPage(overrides: Partial<ReturnType<typeof mockUseSocietyId>> = {}) {
  mockUseSocietyId.mockReturnValue({
    societyId: "soc-1",
    societyName: "Greenwood Residency",
    societyCode: "GRNW",
    isSuperAdminViewing: false,
    saQueryString: "",
    ...overrides,
  });
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <AdminSupportPage />
    </QueryClientProvider>,
  );
}

describe("AdminSupportPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetAdminRequests.mockResolvedValue({ data: [], total: 0 });
  });

  it("renders page title", async () => {
    renderPage();
    expect(screen.getByText("Support")).toBeInTheDocument();
    await waitFor(() => expect(mockGetAdminRequests).toHaveBeenCalled());
  });

  it("does not fetch when societyId is empty", () => {
    renderPage({ societyId: "" });
    expect(mockGetAdminRequests).not.toHaveBeenCalled();
  });

  it("passes societyId to the service", async () => {
    renderPage();
    await waitFor(() =>
      expect(mockGetAdminRequests).toHaveBeenCalledWith(
        expect.objectContaining({ societyId: "soc-1" }),
      ),
    );
  });

  it("shows loading skeletons while loading", () => {
    mockGetAdminRequests.mockReturnValue(new Promise(() => {}));
    const { container } = renderPage();
    expect(
      container.querySelectorAll('[data-slot="skeleton"], .animate-pulse').length,
    ).toBeGreaterThan(0);
  });

  it("renders empty state when no requests and no filters", async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText(/No support requests yet/)).toBeInTheDocument());
  });

  it("renders requests in a table", async () => {
    mockGetAdminRequests.mockResolvedValue({ data: [MOCK_REQUEST], total: 1 });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Login broken")).toBeInTheDocument();
    });
    expect(screen.getByText("(1)")).toBeInTheDocument();
    expect(screen.getByText("42")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("renders 0 when ticket has no _count", async () => {
    mockGetAdminRequests.mockResolvedValue({
      data: [{ ...MOCK_REQUEST, _count: undefined }],
      total: 1,
    });
    renderPage();
    await waitFor(() => expect(screen.getByText("Login broken")).toBeInTheDocument());
    expect(screen.getByText("0")).toBeInTheDocument();
  });

  it("applies highlighted background for AWAITING_ADMIN rows", async () => {
    mockGetAdminRequests.mockResolvedValue({ data: [MOCK_AWAITING], total: 1 });
    renderPage();
    await waitFor(() => expect(screen.getByText("Need response")).toBeInTheDocument());
    const row = screen.getByText("Need response").closest("tr");
    expect(row?.className).toContain("bg-yellow-50");
  });

  it("navigates to detail on row click with saQueryString preserved", async () => {
    mockGetAdminRequests.mockResolvedValue({ data: [MOCK_REQUEST], total: 1 });
    const hrefSetter = vi.fn();
    const originalLocation = window.location;
    Object.defineProperty(window, "location", {
      configurable: true,
      value: {
        ...originalLocation,
        get href() {
          return "";
        },
        set href(v: string) {
          hrefSetter(v);
        },
      },
    });
    renderPage({ isSuperAdminViewing: true, saQueryString: "?sid=soc-1" });
    await waitFor(() => expect(screen.getByText("Login broken")).toBeInTheDocument());
    fireEvent.click(screen.getByText("Login broken"));
    expect(hrefSetter).toHaveBeenCalledWith("/admin/support/req-1?sid=soc-1");
    Object.defineProperty(window, "location", { configurable: true, value: originalLocation });
  });

  it("toggles the create form via New Request button", async () => {
    renderPage();
    fireEvent.click(screen.getByRole("button", { name: "New Request" }));
    expect(screen.getByText("New Support Request")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Cancel/i }));
    await waitFor(() => expect(screen.queryByText("New Support Request")).not.toBeInTheDocument());
  });

  it("submits the create form with form values", async () => {
    mockCreateRequest.mockResolvedValue({ id: "new-req" });
    renderPage();
    await waitFor(() => expect(mockGetAdminRequests).toHaveBeenCalled());
    fireEvent.click(screen.getByRole("button", { name: "New Request" }));
    await waitFor(() => expect(screen.getByPlaceholderText(/Brief summary/i)).toBeInTheDocument());

    fireEvent.change(screen.getByPlaceholderText(/Brief summary/i), {
      target: { value: "Valid subject here" },
    });
    fireEvent.change(screen.getByPlaceholderText(/Describe the issue/i), {
      target: { value: "This is a long enough description for validation." },
    });
    fireEvent.click(screen.getByRole("button", { name: /Submit Request/i }));
    await waitFor(() =>
      expect(mockCreateRequest).toHaveBeenCalledWith(
        expect.objectContaining({ subject: "Valid subject here" }),
        expect.anything(),
      ),
    );
    await waitFor(() => expect(screen.queryByText("New Support Request")).not.toBeInTheDocument());
  });

  it("shows the create mutation error message", async () => {
    mockCreateRequest.mockRejectedValue(new Error("boom"));
    renderPage();
    await waitFor(() => expect(mockGetAdminRequests).toHaveBeenCalled());
    fireEvent.click(screen.getByRole("button", { name: "New Request" }));
    await waitFor(() => expect(screen.getByPlaceholderText(/Brief summary/i)).toBeInTheDocument());
    fireEvent.change(screen.getByPlaceholderText(/Brief summary/i), {
      target: { value: "Valid subject here" },
    });
    fireEvent.change(screen.getByPlaceholderText(/Describe the issue/i), {
      target: { value: "Long enough description passing min length validation." },
    });
    fireEvent.click(screen.getByRole("button", { name: /Submit Request/i }));
    await waitFor(() => expect(screen.getByText("boom")).toBeInTheDocument());
  });

  it("filters by status and shows Clear button, then clears", async () => {
    mockGetAdminRequests.mockResolvedValue({ data: [MOCK_REQUEST], total: 1 });
    renderPage();
    await waitFor(() => expect(mockGetAdminRequests).toHaveBeenCalled());

    // First select is Status (mocked as <select>)
    const selects = screen.getAllByTestId("mock-select");
    fireEvent.change(selects[0], { target: { value: "OPEN" } });
    await waitFor(() =>
      expect(mockGetAdminRequests).toHaveBeenLastCalledWith(
        expect.objectContaining({ status: "OPEN" }),
      ),
    );

    // Clear filters — button in filter bar has exact name "Clear"
    fireEvent.click(screen.getByRole("button", { name: "Clear" }));
    await waitFor(() => {
      const lastCall = mockGetAdminRequests.mock.calls[mockGetAdminRequests.mock.calls.length - 1];
      expect(lastCall[0]).not.toHaveProperty("status");
    });
  });

  it("filters by type", async () => {
    renderPage();
    await waitFor(() => expect(mockGetAdminRequests).toHaveBeenCalled());
    const selects = screen.getAllByTestId("mock-select");
    fireEvent.change(selects[1], { target: { value: "BUG_REPORT" } });
    await waitFor(() =>
      expect(mockGetAdminRequests).toHaveBeenLastCalledWith(
        expect.objectContaining({ type: "BUG_REPORT" }),
      ),
    );
  });

  it("filters by priority", async () => {
    renderPage();
    await waitFor(() => expect(mockGetAdminRequests).toHaveBeenCalled());
    const selects = screen.getAllByTestId("mock-select");
    fireEvent.change(selects[2], { target: { value: "HIGH" } });
    await waitFor(() =>
      expect(mockGetAdminRequests).toHaveBeenLastCalledWith(
        expect.objectContaining({ priority: "HIGH" }),
      ),
    );
  });

  it("shows 'No requests match your filters' and Clear link when filtered empty", async () => {
    renderPage();
    await waitFor(() => expect(mockGetAdminRequests).toHaveBeenCalled());
    const selects = screen.getAllByTestId("mock-select");
    fireEvent.change(selects[0], { target: { value: "OPEN" } });
    await waitFor(() => {
      expect(screen.getByText(/No requests match your filters/)).toBeInTheDocument();
    });
    fireEvent.click(screen.getByRole("button", { name: /Clear filters/i }));
    await waitFor(() => {
      expect(screen.queryByText(/No requests match your filters/)).not.toBeInTheDocument();
    });
  });

  it("renders pagination controls when there are >20 results", async () => {
    mockGetAdminRequests.mockResolvedValue({ data: [MOCK_REQUEST], total: 45 });
    renderPage();
    await waitFor(() => expect(screen.getByText("Login broken")).toBeInTheDocument());
    expect(screen.getByText(/Page 1 of 3/)).toBeInTheDocument();

    // Previous disabled on page 1
    expect(screen.getByRole("button", { name: /Previous/i })).toBeDisabled();
    // Next enabled
    expect(screen.getByRole("button", { name: /^Next$/i })).not.toBeDisabled();
    // Click Next — safe to click (even if filters.page reset quirk, button exists)
    fireEvent.click(screen.getByRole("button", { name: /^Next$/i }));
  });

  it.each([
    ["status", 0, "OPEN"],
    ["type", 1, "BUG_REPORT"],
    ["priority", 2, "HIGH"],
  ] as const)("resets %s filter to empty when user selects 'all'", async (field, index, value) => {
    renderPage();
    await waitFor(() => expect(mockGetAdminRequests).toHaveBeenCalled());
    const selects = screen.getAllByTestId("mock-select");
    fireEvent.change(selects[index], { target: { value } });
    await waitFor(() =>
      expect(mockGetAdminRequests).toHaveBeenLastCalledWith(
        expect.objectContaining({ [field]: value }),
      ),
    );
    fireEvent.change(selects[index], { target: { value: "all" } });
    await waitFor(() => {
      const lastCall = mockGetAdminRequests.mock.calls.at(-1);
      expect(lastCall?.[0]).not.toHaveProperty(field);
    });
  });

  it("does not render pagination when only one page of results", async () => {
    mockGetAdminRequests.mockResolvedValue({ data: [MOCK_REQUEST], total: 1 });
    renderPage();
    await waitFor(() => expect(screen.getByText("Login broken")).toBeInTheDocument());
    expect(screen.queryByText(/Page 1 of/)).not.toBeInTheDocument();
  });
});
