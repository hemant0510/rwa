import { describe, it, expect, vi, beforeEach } from "vitest";

const mockListCounsellors = vi.hoisted(() => vi.fn());

vi.mock("@/services/counsellors", () => ({
  listCounsellors: mockListCounsellors,
}));

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import CounsellorsPage from "@/app/sa/counsellors/page";

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <CounsellorsPage />
    </QueryClientProvider>,
  );
}

const sample = (id: string, over: Record<string, unknown> = {}) => ({
  id,
  name: `Counsellor ${id}`,
  email: `${id}@x.com`,
  mobile: "+91 9876543210",
  photoUrl: null,
  isActive: true,
  mfaEnrolledAt: new Date().toISOString(),
  lastLoginAt: null,
  createdAt: new Date().toISOString(),
  _count: { assignments: 3 },
  ...over,
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe("CounsellorsPage", () => {
  it("renders page header and New Counsellor action", () => {
    mockListCounsellors.mockResolvedValue({ counsellors: [], total: 0, page: 1, pageSize: 20 });
    renderPage();
    expect(screen.getByText("Counsellors")).toBeInTheDocument();
    expect(screen.getAllByText(/New Counsellor/).length).toBeGreaterThan(0);
  });

  it("shows loading skeleton while fetching", () => {
    mockListCounsellors.mockImplementation(() => new Promise(() => {}));
    const { container } = renderPage();
    expect(container.querySelector('[class*="animate-pulse"]')).toBeTruthy();
  });

  it("renders empty state when no counsellors", async () => {
    mockListCounsellors.mockResolvedValue({ counsellors: [], total: 0, page: 1, pageSize: 20 });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("No counsellors yet")).toBeInTheDocument();
    });
  });

  it("renders counsellor rows when data is present", async () => {
    mockListCounsellors.mockResolvedValue({
      counsellors: [sample("c-1"), sample("c-2")],
      total: 2,
      page: 1,
      pageSize: 20,
    });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Counsellor c-1")).toBeInTheDocument();
      expect(screen.getByText("Counsellor c-2")).toBeInTheDocument();
    });
  });

  it("shows 'Showing X of Y' summary when total exceeds page size", async () => {
    mockListCounsellors.mockResolvedValue({
      counsellors: [sample("c-1")],
      total: 50,
      page: 1,
      pageSize: 1,
    });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText(/Showing 1 of 50/)).toBeInTheDocument();
    });
  });

  it("renders error banner when the query fails", async () => {
    mockListCounsellors.mockRejectedValue(new Error("server down"));
    renderPage();
    await waitFor(() => {
      expect(screen.getByText(/Failed to load counsellors/)).toBeInTheDocument();
      expect(screen.getByText(/server down/)).toBeInTheDocument();
    });
  });

  it("filters by search term", async () => {
    mockListCounsellors.mockResolvedValue({ counsellors: [], total: 0, page: 1, pageSize: 20 });
    const user = userEvent.setup();
    renderPage();
    await user.type(screen.getByPlaceholderText(/Search by name/), "asha");
    await waitFor(() => {
      expect(mockListCounsellors).toHaveBeenCalledWith(expect.objectContaining({ search: "asha" }));
    });
  });

  it("filters by Active status", async () => {
    mockListCounsellors.mockResolvedValue({ counsellors: [], total: 0, page: 1, pageSize: 20 });
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole("button", { name: /^Active$/ }));
    await waitFor(() => {
      expect(mockListCounsellors).toHaveBeenCalledWith(
        expect.objectContaining({ status: "active" }),
      );
    });
  });

  it("filters by Suspended status", async () => {
    mockListCounsellors.mockResolvedValue({ counsellors: [], total: 0, page: 1, pageSize: 20 });
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole("button", { name: /^Suspended$/ }));
    await waitFor(() => {
      expect(mockListCounsellors).toHaveBeenCalledWith(
        expect.objectContaining({ status: "inactive" }),
      );
    });
  });

  it("resets to 'all' when All button is clicked", async () => {
    mockListCounsellors.mockResolvedValue({ counsellors: [], total: 0, page: 1, pageSize: 20 });
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole("button", { name: /^Active$/ }));
    await user.click(screen.getByRole("button", { name: /^All$/ }));
    await waitFor(() => {
      const lastCall = mockListCounsellors.mock.calls.at(-1)?.[0];
      expect(lastCall?.status).toBeUndefined();
    });
  });
});
