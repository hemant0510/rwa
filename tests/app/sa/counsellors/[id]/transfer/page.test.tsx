import { describe, it, expect, vi, beforeEach } from "vitest";

const mockListCounsellors = vi.hoisted(() => vi.fn());
const mockTransferPortfolio = vi.hoisted(() => vi.fn());
const mockToastSuccess = vi.hoisted(() => vi.fn());
const mockToastError = vi.hoisted(() => vi.fn());
const mockPush = vi.hoisted(() => vi.fn());
const mockUseParams = vi.hoisted(() => vi.fn(() => ({ id: "src-1" })));

vi.mock("next/navigation", () => ({
  useParams: mockUseParams,
  useRouter: () => ({ push: mockPush }),
}));
vi.mock("@/services/counsellors", () => ({
  listCounsellors: mockListCounsellors,
  transferPortfolio: mockTransferPortfolio,
}));
vi.mock("sonner", () => ({
  toast: { success: mockToastSuccess, error: mockToastError },
}));

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";

import TransferPortfolioPage from "@/app/sa/counsellors/[id]/transfer/page";

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <TransferPortfolioPage />
    </QueryClientProvider>,
  );
}

const sample = (id: string, name: string, count = 5) => ({
  id,
  name,
  email: `${id}@x.com`,
  mobile: null,
  photoUrl: null,
  isActive: true,
  mfaEnrolledAt: new Date().toISOString(),
  lastLoginAt: null,
  createdAt: new Date().toISOString(),
  _count: { assignments: count },
});

beforeEach(() => {
  vi.clearAllMocks();
  mockListCounsellors.mockResolvedValue({
    counsellors: [
      sample("src-1", "Source"),
      sample("tgt-1", "Target One"),
      sample("tgt-2", "Target Two"),
    ],
    total: 3,
    page: 1,
    pageSize: 50,
  });
});

describe("TransferPortfolioPage", () => {
  it("renders header and search", async () => {
    renderPage();
    expect(screen.getByText("Transfer Portfolio")).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Search active counsellors/)).toBeInTheDocument();
  });

  it("excludes the source counsellor from candidate list", async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Target One")).toBeInTheDocument();
      expect(screen.queryByText("Source")).not.toBeInTheDocument();
    });
  });

  it("shows skeleton while loading", () => {
    mockListCounsellors.mockImplementation(() => new Promise(() => {}));
    const { container } = renderPage();
    expect(container.querySelector('[class*="animate-pulse"]')).toBeTruthy();
  });

  it("shows error banner on query failure", async () => {
    mockListCounsellors.mockRejectedValue(new Error("server"));
    renderPage();
    await waitFor(() => {
      expect(screen.getByText(/Failed to load counsellors/)).toBeInTheDocument();
    });
  });

  it("shows empty state when no other active counsellors exist", async () => {
    mockListCounsellors.mockResolvedValue({
      counsellors: [sample("src-1", "Source")],
      total: 1,
      page: 1,
      pageSize: 50,
    });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("No other active counsellors")).toBeInTheDocument();
    });
  });

  it("disables Transfer button until a target is picked", async () => {
    renderPage();
    await waitFor(() => expect(screen.getByText("Target One")).toBeInTheDocument());
    expect(screen.getByRole("button", { name: /Pick a target/ })).toBeDisabled();
  });

  it("enables Transfer button after picking a target", async () => {
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => expect(screen.getByText("Target One")).toBeInTheDocument());
    await user.click(screen.getAllByRole("radio")[0]);
    expect(screen.getByRole("button", { name: /Transfer to Target One/ })).toBeEnabled();
  });

  it("filters by search input", async () => {
    const user = userEvent.setup();
    renderPage();
    await user.type(screen.getByPlaceholderText(/Search active/), "asha");
    await waitFor(() => {
      expect(mockListCounsellors).toHaveBeenCalledWith(
        expect.objectContaining({ search: "asha", status: "active" }),
      );
    });
  });

  it("calls transferPortfolio and shows success toast on success", async () => {
    mockTransferPortfolio.mockResolvedValue({ transferred: 3, skipped: 0 });
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => expect(screen.getByText("Target One")).toBeInTheDocument());
    await user.click(screen.getAllByRole("radio")[0]);
    await user.click(screen.getByRole("button", { name: /Transfer to Target One/ }));
    await waitFor(() => {
      expect(mockTransferPortfolio).toHaveBeenCalledWith("src-1", { targetCounsellorId: "tgt-1" });
      expect(mockToastSuccess).toHaveBeenCalledWith(
        expect.stringContaining("Transferred 3 societies"),
      );
      expect(mockPush).toHaveBeenCalledWith("/sa/counsellors/src-1");
    });
  });

  it("uses singular 'society' for transferred=1", async () => {
    mockTransferPortfolio.mockResolvedValue({ transferred: 1, skipped: 0 });
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => expect(screen.getByText("Target One")).toBeInTheDocument());
    await user.click(screen.getAllByRole("radio")[0]);
    await user.click(screen.getByRole("button", { name: /Transfer to Target One/ }));
    await waitFor(() => {
      expect(mockToastSuccess).toHaveBeenCalledWith(
        expect.stringContaining("Transferred 1 society"),
      );
    });
  });

  it("shows informational toast when transferred=0", async () => {
    mockTransferPortfolio.mockResolvedValue({ transferred: 0, skipped: 2 });
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => expect(screen.getByText("Target One")).toBeInTheDocument());
    await user.click(screen.getAllByRole("radio")[0]);
    await user.click(screen.getByRole("button", { name: /Transfer to Target One/ }));
    await waitFor(() => {
      expect(mockToastSuccess).toHaveBeenCalledWith(
        expect.stringContaining("No societies needed transfer"),
      );
    });
  });

  it("shows toast.error when transfer fails", async () => {
    mockTransferPortfolio.mockRejectedValue(new Error("conflict"));
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => expect(screen.getByText("Target One")).toBeInTheDocument());
    await user.click(screen.getAllByRole("radio")[0]);
    await user.click(screen.getByRole("button", { name: /Transfer to Target One/ }));
    await waitFor(() => {
      expect(mockToastError).toHaveBeenCalledWith("conflict");
    });
  });

  it("navigates back on Cancel", async () => {
    const user = userEvent.setup();
    renderPage();
    await waitFor(() => expect(screen.getByText("Target One")).toBeInTheDocument());
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(mockPush).toHaveBeenCalledWith("/sa/counsellors/src-1");
  });
});
