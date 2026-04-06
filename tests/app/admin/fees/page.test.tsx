import React from "react";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { toast } from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockGetFeeDashboard = vi.hoisted(() => vi.fn());
const mockRecordPayment = vi.hoisted(() => vi.fn());
const mockGrantExemption = vi.hoisted(() => vi.fn());

vi.mock("@/services/fees", () => ({
  getFeeDashboard: mockGetFeeDashboard,
  recordPayment: mockRecordPayment,
  grantExemption: mockGrantExemption,
}));
vi.mock("@/hooks/useSocietyId", () => ({
  useSocietyId: vi.fn(() => ({ societyId: "soc-1" })),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("next/link", () => ({
  default: ({ href, children }: { href: string; children: React.ReactNode }) => (
    <a href={href}>{children}</a>
  ),
}));

import FeesPage from "@/app/admin/fees/page";

const mockToast = vi.mocked(toast);

const baseDashboard = {
  totalDue: 50000,
  totalCollected: 30000,
  collectionRate: 60,
  fees: [
    {
      id: "fee-1",
      amountDue: 2000,
      amountPaid: 0,
      balance: 2000,
      status: "PENDING",
      user: { name: "Hemant Kumar", mobile: "9876543210", rwaid: "EE-001" },
    },
  ],
};

function renderPage() {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <FeesPage />
    </QueryClientProvider>,
  );
}

describe("FeesPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("always shows UPI Payment Claims card with link to /admin/fees/claims", () => {
    mockGetFeeDashboard.mockReturnValue(new Promise(() => {}));
    renderPage();
    const link = screen.getByRole("link", { name: /UPI Payment Claims/i });
    expect(link).toHaveAttribute("href", "/admin/fees/claims");
  });

  it("shows page header while fetching (no dashboard stats yet)", () => {
    mockGetFeeDashboard.mockReturnValue(new Promise(() => {}));
    renderPage();
    expect(screen.getByText("Fee Management")).toBeInTheDocument();
    expect(screen.queryByText("Total Due")).not.toBeInTheDocument();
  });

  it("shows dashboard stats when loaded", async () => {
    mockGetFeeDashboard.mockResolvedValue(baseDashboard);
    renderPage();
    await waitFor(() => expect(screen.getByText("Total Due")).toBeInTheDocument());
    expect(screen.getByText(/60%/)).toBeInTheDocument();
  });

  it("renders fee rows in the table", async () => {
    mockGetFeeDashboard.mockResolvedValue(baseDashboard);
    renderPage();
    await waitFor(() => expect(screen.getByText("Hemant Kumar")).toBeInTheDocument());
    expect(screen.getByText("EE-001")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Record Payment/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Exempt/i })).toBeInTheDocument();
  });

  it("hides Record Payment and Exempt buttons for PAID fee", async () => {
    mockGetFeeDashboard.mockResolvedValue({
      ...baseDashboard,
      fees: [{ ...baseDashboard.fees[0], status: "PAID" }],
    });
    renderPage();
    await waitFor(() => expect(screen.getByText("Hemant Kumar")).toBeInTheDocument());
    expect(screen.queryByRole("button", { name: /Record Payment/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Exempt/i })).not.toBeInTheDocument();
  });

  it("shows empty state when fees list is empty", async () => {
    mockGetFeeDashboard.mockResolvedValue({ ...baseDashboard, fees: [] });
    renderPage();
    await waitFor(() =>
      expect(screen.getByText(/No fee records found for this session/i)).toBeInTheDocument(),
    );
  });

  it("renders nothing for the dashboard section when data is null", async () => {
    mockGetFeeDashboard.mockResolvedValue(null);
    renderPage();
    // Wait for the query to resolve (loading → false, data → null) — skeletons disappear
    await waitFor(() => expect(document.querySelectorAll(".animate-pulse")).toHaveLength(0));
    expect(screen.queryByText("Total Due")).not.toBeInTheDocument();
  });

  it("opens Record Payment dialog when button clicked", async () => {
    const user = userEvent.setup();
    mockGetFeeDashboard.mockResolvedValue(baseDashboard);
    renderPage();
    await waitFor(() => screen.getByRole("button", { name: /Record Payment/i }));
    await user.click(screen.getByRole("button", { name: /Record Payment/i }));
    expect(screen.getByText(/Record Payment for Hemant Kumar/i)).toBeInTheDocument();
  });

  it("submits payment form and shows success toast", async () => {
    const user = userEvent.setup();
    mockGetFeeDashboard.mockResolvedValue(baseDashboard);
    mockRecordPayment.mockResolvedValue({ ok: true });
    renderPage();
    await waitFor(() => screen.getAllByRole("button", { name: /Record Payment/i }));
    await user.click(screen.getAllByRole("button", { name: /Record Payment/i })[0]);

    const amountInput = screen.getByRole("spinbutton");
    await user.clear(amountInput);
    await user.type(amountInput, "1500");

    // UPI mode (default) requires a reference number
    const refInput = screen.getByPlaceholderText(/Transaction ID/i);
    await user.type(refInput, "UTR123456789012");

    await user.click(screen.getByRole("button", { name: /^Record Payment$/i }));
    await waitFor(() => expect(mockToast.success).toHaveBeenCalledWith("Payment recorded!"));
  });

  it("shows error toast when payment fails", async () => {
    const user = userEvent.setup();
    mockGetFeeDashboard.mockResolvedValue(baseDashboard);
    mockRecordPayment.mockRejectedValue(new Error("Payment failed"));
    renderPage();
    await waitFor(() => screen.getAllByRole("button", { name: /Record Payment/i }));
    await user.click(screen.getAllByRole("button", { name: /Record Payment/i })[0]);

    const amountInput = screen.getByRole("spinbutton");
    await user.clear(amountInput);
    await user.type(amountInput, "1500");

    const refInput = screen.getByPlaceholderText(/Transaction ID/i);
    await user.type(refInput, "UTR123456789012");

    await user.click(screen.getByRole("button", { name: /^Record Payment$/i }));
    await waitFor(() => expect(mockToast.error).toHaveBeenCalledWith("Payment failed"));
  });

  it("opens Exemption dialog when Exempt button clicked", async () => {
    const user = userEvent.setup();
    mockGetFeeDashboard.mockResolvedValue(baseDashboard);
    renderPage();
    await waitFor(() => screen.getByRole("button", { name: /Exempt/i }));
    await user.click(screen.getByRole("button", { name: /Exempt/i }));
    expect(screen.getByText(/Grant Exemption to Hemant Kumar/i)).toBeInTheDocument();
  });

  it("enables Grant Exemption button only when reason >= 10 chars", async () => {
    const user = userEvent.setup();
    mockGetFeeDashboard.mockResolvedValue(baseDashboard);
    renderPage();
    await waitFor(() => screen.getByRole("button", { name: /Exempt/i }));
    await user.click(screen.getByRole("button", { name: /Exempt/i }));

    const grantBtn = screen.getByRole("button", { name: /Grant Exemption/i });
    expect(grantBtn).toBeDisabled();

    const reasonInput = screen.getByPlaceholderText(/Senior citizen/i);
    await user.type(reasonInput, "Too old to pay");
    await waitFor(() => expect(grantBtn).not.toBeDisabled());
  });

  it("submits exemption and shows success toast", async () => {
    const user = userEvent.setup();
    mockGetFeeDashboard.mockResolvedValue(baseDashboard);
    mockGrantExemption.mockResolvedValue({ ok: true });
    renderPage();
    await waitFor(() => screen.getByRole("button", { name: /Exempt/i }));
    await user.click(screen.getByRole("button", { name: /Exempt/i }));

    await user.type(screen.getByPlaceholderText(/Senior citizen/i), "Senior citizen hardship");
    await user.click(screen.getByRole("button", { name: /Grant Exemption/i }));
    await waitFor(() => expect(mockToast.success).toHaveBeenCalledWith("Exemption granted!"));
  });

  it("shows error toast when exemption fails", async () => {
    const user = userEvent.setup();
    mockGetFeeDashboard.mockResolvedValue(baseDashboard);
    mockGrantExemption.mockRejectedValue(new Error("Exemption failed"));
    renderPage();
    await waitFor(() => screen.getByRole("button", { name: /Exempt/i }));
    await user.click(screen.getByRole("button", { name: /Exempt/i }));

    await user.type(screen.getByPlaceholderText(/Senior citizen/i), "Senior citizen hardship");
    await user.click(screen.getByRole("button", { name: /Grant Exemption/i }));
    await waitFor(() => expect(mockToast.error).toHaveBeenCalledWith("Exemption failed"));
  });

  it("closes exemption dialog on Cancel", async () => {
    const user = userEvent.setup();
    mockGetFeeDashboard.mockResolvedValue(baseDashboard);
    renderPage();
    await waitFor(() => screen.getByRole("button", { name: /Exempt/i }));
    await user.click(screen.getByRole("button", { name: /Exempt/i }));
    expect(screen.getByText(/Grant Exemption to/i)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Cancel/i }));
    await waitFor(() => expect(screen.queryByText(/Grant Exemption to/i)).not.toBeInTheDocument());
  });

  it("closes payment dialog via Escape key (onOpenChange branch)", async () => {
    const user = userEvent.setup();
    mockGetFeeDashboard.mockResolvedValue(baseDashboard);
    renderPage();
    await waitFor(() => screen.getAllByRole("button", { name: /Record Payment/i }));
    await user.click(screen.getAllByRole("button", { name: /Record Payment/i })[0]);
    expect(screen.getByText(/Record Payment for Hemant Kumar/i)).toBeInTheDocument();
    await user.keyboard("{Escape}");
    await waitFor(() =>
      expect(screen.queryByText(/Record Payment for Hemant Kumar/i)).not.toBeInTheDocument(),
    );
  });

  it("closes exemption dialog via Escape key (onOpenChange branch)", async () => {
    const user = userEvent.setup();
    mockGetFeeDashboard.mockResolvedValue(baseDashboard);
    renderPage();
    await waitFor(() => screen.getByRole("button", { name: /Exempt/i }));
    await user.click(screen.getByRole("button", { name: /Exempt/i }));
    expect(screen.getByText(/Grant Exemption to Hemant Kumar/i)).toBeInTheDocument();
    await user.keyboard("{Escape}");
    await waitFor(() =>
      expect(screen.queryByText(/Grant Exemption to Hemant Kumar/i)).not.toBeInTheDocument(),
    );
  });

  it("changes payment mode in dialog (onValueChange branch)", async () => {
    const user = userEvent.setup();
    mockGetFeeDashboard.mockResolvedValue(baseDashboard);
    renderPage();
    await waitFor(() => screen.getAllByRole("button", { name: /Record Payment/i }));
    await user.click(screen.getAllByRole("button", { name: /Record Payment/i })[0]);

    // Dialog is open — click the payment mode combobox
    const combobox = screen.getByRole("combobox");
    await user.click(combobox);

    // Select CASH (no reference number required)
    const cashOption = await screen.findByRole("option", { name: /cash/i });
    await user.click(cashOption);

    // Reference number field should disappear after switching to CASH
    expect(screen.queryByPlaceholderText(/Transaction ID/i)).not.toBeInTheDocument();
  });

  it("shows dash for rwaid when not provided", async () => {
    mockGetFeeDashboard.mockResolvedValue({
      ...baseDashboard,
      fees: [{ ...baseDashboard.fees[0], user: { ...baseDashboard.fees[0].user, rwaid: null } }],
    });
    renderPage();
    await waitFor(() => expect(screen.getByText("Hemant Kumar")).toBeInTheDocument());
    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("shows amount validation error when amount is cleared (NaN)", async () => {
    const user = userEvent.setup();
    mockGetFeeDashboard.mockResolvedValue(baseDashboard);
    renderPage();
    await waitFor(() => screen.getAllByRole("button", { name: /Record Payment/i }));
    await user.click(screen.getAllByRole("button", { name: /Record Payment/i })[0]);

    // Clear amount (leaves NaN) and fill referenceNo so only the amount error fires
    const amountInput = screen.getByRole("spinbutton");
    await user.clear(amountInput);
    await user.type(screen.getByPlaceholderText(/Transaction ID/i), "UTR123456789012");

    await user.click(screen.getByRole("button", { name: /^Record Payment$/i }));

    // Zod reports NaN as invalid_type — errors.amount is truthy → error paragraph renders
    await waitFor(() =>
      expect(screen.getByText(/expected number|Amount must be positive/i)).toBeInTheDocument(),
    );
  });

  it("shows referenceNo validation error when UPI mode with empty reference", async () => {
    const user = userEvent.setup();
    mockGetFeeDashboard.mockResolvedValue(baseDashboard);
    renderPage();
    await waitFor(() => screen.getAllByRole("button", { name: /Record Payment/i }));
    await user.click(screen.getAllByRole("button", { name: /Record Payment/i })[0]);

    // Fill a valid amount but leave referenceNo empty (UPI mode is default)
    const amountInput = screen.getByRole("spinbutton");
    await user.clear(amountInput);
    await user.type(amountInput, "1500");

    // Do NOT fill the referenceNo — UPI mode requires it
    await user.click(screen.getByRole("button", { name: /^Record Payment$/i }));

    await waitFor(() =>
      expect(screen.getByText(/Reference number is required/i)).toBeInTheDocument(),
    );
  });

  it("shows referenceNo field when payment mode is BANK_TRANSFER", async () => {
    const user = userEvent.setup();
    mockGetFeeDashboard.mockResolvedValue(baseDashboard);
    renderPage();
    await waitFor(() => screen.getAllByRole("button", { name: /Record Payment/i }));
    await user.click(screen.getAllByRole("button", { name: /Record Payment/i })[0]);

    const combobox = screen.getByRole("combobox");
    await user.click(combobox);
    const bankOption = await screen.findByRole("option", { name: /bank transfer/i });
    await user.click(bankOption);

    expect(screen.getByPlaceholderText(/Transaction ID/i)).toBeInTheDocument();
  });

  it("disables payment button while mutation is pending", async () => {
    const user = userEvent.setup();
    mockGetFeeDashboard.mockResolvedValue(baseDashboard);
    mockRecordPayment.mockReturnValue(new Promise(() => {}));
    renderPage();
    await waitFor(() => screen.getAllByRole("button", { name: /Record Payment/i }));
    await user.click(screen.getAllByRole("button", { name: /Record Payment/i })[0]);

    const amountInput = screen.getByRole("spinbutton");
    await user.clear(amountInput);
    await user.type(amountInput, "1500");

    const refInput = screen.getByPlaceholderText(/Transaction ID/i);
    await user.type(refInput, "UTR123456789012");

    await user.click(screen.getByRole("button", { name: /^Record Payment$/i }));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /^Record Payment$/i })).toBeDisabled(),
    );
  });

  it("disables Grant Exemption button while mutation is pending", async () => {
    const user = userEvent.setup();
    mockGetFeeDashboard.mockResolvedValue(baseDashboard);
    mockGrantExemption.mockReturnValue(new Promise(() => {}));
    renderPage();
    await waitFor(() => screen.getByRole("button", { name: /Exempt/i }));
    await user.click(screen.getByRole("button", { name: /Exempt/i }));

    await user.type(screen.getByPlaceholderText(/Senior citizen/i), "Senior citizen hardship");
    await user.click(screen.getByRole("button", { name: /Grant Exemption/i }));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /Grant Exemption/i })).toBeDisabled(),
    );
  });
});
