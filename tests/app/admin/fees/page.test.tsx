import React from "react";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { toast } from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockGetFeeDashboard = vi.hoisted(() => vi.fn());
const mockGetFeeSessions = vi.hoisted(() => vi.fn());
const mockRecordPayment = vi.hoisted(() => vi.fn());
const mockGrantExemption = vi.hoisted(() => vi.fn());
const mockGetAdminPaymentClaims = vi.hoisted(() => vi.fn());
const mockVerifyClaim = vi.hoisted(() => vi.fn());
const mockRejectClaim = vi.hoisted(() => vi.fn());

vi.mock("@/services/fees", () => ({
  getFeeDashboard: mockGetFeeDashboard,
  getFeeSessions: mockGetFeeSessions,
  recordPayment: mockRecordPayment,
  grantExemption: mockGrantExemption,
}));
vi.mock("@/services/admin-payment-claims", () => ({
  getAdminPaymentClaims: mockGetAdminPaymentClaims,
  verifyClaim: mockVerifyClaim,
  rejectClaim: mockRejectClaim,
}));
vi.mock("@/hooks/useSocietyId", () => ({
  useSocietyId: vi.fn(() => ({ societyId: "soc-1" })),
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

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

const mockSessions = [
  { id: "s1", sessionYear: "2025-26" },
  { id: "s2", sessionYear: "2024-25" },
];

const baseClaim = {
  id: "claim-1",
  societyId: "soc-1",
  userId: "user-1",
  membershipFeeId: "fee-1",
  claimedAmount: 2000,
  utrNumber: "UTR123456789",
  paymentDate: "2026-04-01T00:00:00Z",
  screenshotUrl: "https://example.com/screenshot.png",
  status: "PENDING" as const,
  verifiedBy: null,
  verifiedAt: null,
  rejectionReason: null,
  adminNotes: null,
  createdAt: "2026-04-01T10:00:00Z",
  updatedAt: "2026-04-01T10:00:00Z",
  user: { name: "Hemant Kumar", unitNumber: "302" },
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
    mockGetFeeSessions.mockResolvedValue(mockSessions);
    mockGetAdminPaymentClaims.mockResolvedValue({ claims: [], total: 0, page: 1, pageSize: 20 });
  });

  it("shows page header", () => {
    mockGetFeeDashboard.mockReturnValue(new Promise(() => {}));
    renderPage();
    expect(screen.getByText("Fee Management")).toBeInTheDocument();
  });

  it("does not show a UPI Payment Claims link card", async () => {
    mockGetFeeDashboard.mockResolvedValue(baseDashboard);
    renderPage();
    await waitFor(() => expect(screen.getByText("Hemant Kumar")).toBeInTheDocument());
    expect(screen.queryByRole("link", { name: /UPI Payment Claims/i })).not.toBeInTheDocument();
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
    await waitFor(() => expect(document.querySelectorAll(".animate-pulse")).toHaveLength(0));
    expect(screen.queryByText("Total Due")).not.toBeInTheDocument();
  });

  // ── UPI Claim badge & Review Claim button ─────────────────────────────────

  it("shows 'UPI Claim' badge and 'Review Claim' button when a pending claim exists for the fee", async () => {
    mockGetFeeDashboard.mockResolvedValue(baseDashboard);
    mockGetAdminPaymentClaims.mockResolvedValue({
      claims: [baseClaim],
      total: 1,
      page: 1,
      pageSize: 20,
    });
    renderPage();
    await waitFor(() => expect(screen.getByText("UPI Claim")).toBeInTheDocument());
    expect(screen.getByRole("button", { name: /Review Claim/i })).toBeInTheDocument();
  });

  it("shows screenshot, UTR and Verify button in dialog when claim exists", async () => {
    const user = userEvent.setup();
    mockGetFeeDashboard.mockResolvedValue(baseDashboard);
    mockGetAdminPaymentClaims.mockResolvedValue({
      claims: [baseClaim],
      total: 1,
      page: 1,
      pageSize: 20,
    });
    renderPage();
    await waitFor(() => screen.getByRole("button", { name: /Review Claim/i }));
    await user.click(screen.getByRole("button", { name: /Review Claim/i }));

    expect(screen.getByText("UPI Payment Claim")).toBeInTheDocument();
    expect(screen.getByText(/UTR123456789/)).toBeInTheDocument();
    expect(screen.getByRole("img", { name: /payment screenshot/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Verify & Mark Paid/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Reject Claim/i })).toBeInTheDocument();
  });

  it("calls verifyClaim and closes dialog on verify", async () => {
    const user = userEvent.setup();
    mockGetFeeDashboard.mockResolvedValue(baseDashboard);
    mockGetAdminPaymentClaims.mockResolvedValue({
      claims: [baseClaim],
      total: 1,
      page: 1,
      pageSize: 20,
    });
    mockVerifyClaim.mockResolvedValue({ claim: baseClaim });
    renderPage();
    await waitFor(() => screen.getByRole("button", { name: /Review Claim/i }));
    await user.click(screen.getByRole("button", { name: /Review Claim/i }));
    await user.click(screen.getByRole("button", { name: /Verify & Mark Paid/i }));
    await waitFor(() => expect(mockToast.success).toHaveBeenCalledWith("Payment claim verified"));
  });

  it("shows rejection form when Reject Claim is clicked", async () => {
    const user = userEvent.setup();
    mockGetFeeDashboard.mockResolvedValue(baseDashboard);
    mockGetAdminPaymentClaims.mockResolvedValue({
      claims: [baseClaim],
      total: 1,
      page: 1,
      pageSize: 20,
    });
    renderPage();
    await waitFor(() => screen.getByRole("button", { name: /Review Claim/i }));
    await user.click(screen.getByRole("button", { name: /Review Claim/i }));
    await user.click(screen.getByRole("button", { name: /Reject Claim/i }));
    expect(screen.getByPlaceholderText(/UTR not found/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Confirm Rejection/i })).toBeDisabled();
  });

  it("calls rejectClaim and shows success when reason is >= 10 chars", async () => {
    const user = userEvent.setup();
    mockGetFeeDashboard.mockResolvedValue(baseDashboard);
    mockGetAdminPaymentClaims.mockResolvedValue({
      claims: [baseClaim],
      total: 1,
      page: 1,
      pageSize: 20,
    });
    mockRejectClaim.mockResolvedValue({ claim: baseClaim });
    renderPage();
    await waitFor(() => screen.getByRole("button", { name: /Review Claim/i }));
    await user.click(screen.getByRole("button", { name: /Review Claim/i }));
    await user.click(screen.getByRole("button", { name: /Reject Claim/i }));
    await user.type(screen.getByPlaceholderText(/UTR not found/i), "UTR not found in bank");
    await user.click(screen.getByRole("button", { name: /Confirm Rejection/i }));
    await waitFor(() => expect(mockToast.success).toHaveBeenCalledWith("Payment claim rejected"));
  });

  it("hides rejection form when Cancel is clicked", async () => {
    const user = userEvent.setup();
    mockGetFeeDashboard.mockResolvedValue(baseDashboard);
    mockGetAdminPaymentClaims.mockResolvedValue({
      claims: [baseClaim],
      total: 1,
      page: 1,
      pageSize: 20,
    });
    renderPage();
    await waitFor(() => screen.getByRole("button", { name: /Review Claim/i }));
    await user.click(screen.getByRole("button", { name: /Review Claim/i }));
    await user.click(screen.getByRole("button", { name: /Reject Claim/i }));
    await user.click(screen.getByRole("button", { name: /^Cancel$/i }));
    expect(screen.queryByPlaceholderText(/UTR not found/i)).not.toBeInTheDocument();
  });

  it("shows error toast when verifyClaim fails", async () => {
    const user = userEvent.setup();
    mockGetFeeDashboard.mockResolvedValue(baseDashboard);
    mockGetAdminPaymentClaims.mockResolvedValue({
      claims: [baseClaim],
      total: 1,
      page: 1,
      pageSize: 20,
    });
    mockVerifyClaim.mockRejectedValue(new Error("Verify failed"));
    renderPage();
    await waitFor(() => screen.getByRole("button", { name: /Review Claim/i }));
    await user.click(screen.getByRole("button", { name: /Review Claim/i }));
    await user.click(screen.getByRole("button", { name: /Verify & Mark Paid/i }));
    await waitFor(() => expect(mockToast.error).toHaveBeenCalledWith("Verify failed"));
  });

  it("shows error toast when rejectClaim fails", async () => {
    const user = userEvent.setup();
    mockGetFeeDashboard.mockResolvedValue(baseDashboard);
    mockGetAdminPaymentClaims.mockResolvedValue({
      claims: [baseClaim],
      total: 1,
      page: 1,
      pageSize: 20,
    });
    mockRejectClaim.mockRejectedValue(new Error("Reject failed"));
    renderPage();
    await waitFor(() => screen.getByRole("button", { name: /Review Claim/i }));
    await user.click(screen.getByRole("button", { name: /Review Claim/i }));
    await user.click(screen.getByRole("button", { name: /Reject Claim/i }));
    await user.type(screen.getByPlaceholderText(/UTR not found/i), "UTR not found at all");
    await user.click(screen.getByRole("button", { name: /Confirm Rejection/i }));
    await waitFor(() => expect(mockToast.error).toHaveBeenCalledWith("Reject failed"));
  });

  // ── Record Payment (no claim) ─────────────────────────────────────────────

  it("opens Record Payment dialog when button clicked", async () => {
    const user = userEvent.setup();
    mockGetFeeDashboard.mockResolvedValue(baseDashboard);
    renderPage();
    await waitFor(() => screen.getByRole("button", { name: /Record Payment/i }));
    await user.click(screen.getByRole("button", { name: /Record Payment/i }));
    expect(screen.getByText(/Record Payment — Hemant Kumar/i)).toBeInTheDocument();
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

  // ── Exemption ─────────────────────────────────────────────────────────────

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
    await user.click(screen.getByRole("button", { name: /Cancel/i }));
    await waitFor(() => expect(screen.queryByText(/Grant Exemption to/i)).not.toBeInTheDocument());
  });

  // ── Filters ───────────────────────────────────────────────────────────────

  it("renders session year dropdown with options from getFeeSessions", async () => {
    mockGetFeeDashboard.mockResolvedValue(baseDashboard);
    renderPage();
    await waitFor(() => expect(mockGetFeeSessions).toHaveBeenCalled());
    const comboboxes = screen.getAllByRole("combobox");
    expect(comboboxes.length).toBeGreaterThanOrEqual(2);
  });

  it("calls getFeeDashboard with selected session year when changed", async () => {
    const user = userEvent.setup();
    mockGetFeeDashboard.mockResolvedValue(baseDashboard);
    renderPage();
    await waitFor(() => expect(screen.getByText("Hemant Kumar")).toBeInTheDocument());

    const [sessionCombobox] = screen.getAllByRole("combobox");
    await user.click(sessionCombobox);
    const option = await screen.findByRole("option", { name: "2025-26" });
    await user.click(option);

    await waitFor(() => expect(mockGetFeeDashboard).toHaveBeenCalledWith("soc-1", "2025-26"));
  });

  it("filters fee rows by status when status filter is changed", async () => {
    const user = userEvent.setup();
    mockGetFeeDashboard.mockResolvedValue({
      ...baseDashboard,
      fees: [
        {
          ...baseDashboard.fees[0],
          id: "fee-1",
          status: "PENDING",
          user: { ...baseDashboard.fees[0].user, name: "Alice" },
        },
        {
          ...baseDashboard.fees[0],
          id: "fee-2",
          status: "PAID",
          user: { ...baseDashboard.fees[0].user, name: "Bob" },
        },
      ],
    });
    renderPage();
    await waitFor(() => expect(screen.getByText("Alice")).toBeInTheDocument());
    expect(screen.getByText("Bob")).toBeInTheDocument();

    const [, statusCombobox] = screen.getAllByRole("combobox");
    await user.click(statusCombobox);
    const paidOption = await screen.findByRole("option", { name: "Paid" });
    await user.click(paidOption);

    await waitFor(() => expect(screen.queryByText("Alice")).not.toBeInTheDocument());
    expect(screen.getByText("Bob")).toBeInTheDocument();
  });

  it("shows filtered empty state when status filter matches no fees", async () => {
    const user = userEvent.setup();
    mockGetFeeDashboard.mockResolvedValue(baseDashboard);
    renderPage();
    await waitFor(() => expect(screen.getByText("Hemant Kumar")).toBeInTheDocument());

    const [, statusCombobox] = screen.getAllByRole("combobox");
    await user.click(statusCombobox);
    const paidOption = await screen.findByRole("option", { name: "Paid" });
    await user.click(paidOption);

    await waitFor(() =>
      expect(screen.getByText(/No paid fee records for this session/i)).toBeInTheDocument(),
    );
  });

  // ── Misc ─────────────────────────────────────────────────────────────────

  it("shows dash for rwaid when not provided", async () => {
    mockGetFeeDashboard.mockResolvedValue({
      ...baseDashboard,
      fees: [{ ...baseDashboard.fees[0], user: { ...baseDashboard.fees[0].user, rwaid: null } }],
    });
    renderPage();
    await waitFor(() => expect(screen.getByText("Hemant Kumar")).toBeInTheDocument());
    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("shows amount validation error when amount is cleared", async () => {
    const user = userEvent.setup();
    mockGetFeeDashboard.mockResolvedValue(baseDashboard);
    renderPage();
    await waitFor(() => screen.getAllByRole("button", { name: /Record Payment/i }));
    await user.click(screen.getAllByRole("button", { name: /Record Payment/i })[0]);

    const amountInput = screen.getByRole("spinbutton");
    await user.clear(amountInput);
    await user.type(screen.getByPlaceholderText(/Transaction ID/i), "UTR123456789012");
    await user.click(screen.getByRole("button", { name: /^Record Payment$/i }));

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

    const amountInput = screen.getByRole("spinbutton");
    await user.clear(amountInput);
    await user.type(amountInput, "1500");
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

    // Find the payment mode combobox (the one inside the dialog)
    const combobox = screen
      .getAllByRole("combobox")
      .find(
        (el) => el.getAttribute("aria-label") !== null || el.closest("[role='dialog']") !== null,
      )!;
    await user.click(combobox);
    const bankOption = await screen.findByRole("option", { name: /bank transfer/i });
    await user.click(bankOption);

    expect(screen.getByPlaceholderText(/Transaction ID/i)).toBeInTheDocument();
  });

  it("changes payment mode to CASH (no reference field)", async () => {
    const user = userEvent.setup();
    mockGetFeeDashboard.mockResolvedValue(baseDashboard);
    renderPage();
    await waitFor(() => screen.getAllByRole("button", { name: /Record Payment/i }));
    await user.click(screen.getAllByRole("button", { name: /Record Payment/i })[0]);

    const combobox = screen
      .getAllByRole("combobox")
      .find((el) => el.closest("[role='dialog']") !== null)!;
    await user.click(combobox);
    const cashOption = await screen.findByRole("option", { name: /cash/i });
    await user.click(cashOption);

    expect(screen.queryByPlaceholderText(/Transaction ID/i)).not.toBeInTheDocument();
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
    await user.type(screen.getByPlaceholderText(/Transaction ID/i), "UTR123456789012");

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

  it("closes exemption dialog via Escape key (onOpenChange both branches)", async () => {
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

  it("ignores null membershipFeeId in claim (claimByFeeId map guard)", async () => {
    mockGetFeeDashboard.mockResolvedValue(baseDashboard);
    mockGetAdminPaymentClaims.mockResolvedValue({
      claims: [{ ...baseClaim, membershipFeeId: null as unknown as string }],
      total: 1,
      page: 1,
      pageSize: 20,
    });
    renderPage();
    await waitFor(() => expect(screen.getByText("Hemant Kumar")).toBeInTheDocument());
    // No UPI Claim badge — the null feeId claim was not added to the map
    expect(screen.queryByText("UPI Claim")).not.toBeInTheDocument();
  });

  it("shows Loader2 spinner in verify button while verifyMutation is pending", async () => {
    const user = userEvent.setup();
    mockGetFeeDashboard.mockResolvedValue(baseDashboard);
    mockGetAdminPaymentClaims.mockResolvedValue({
      claims: [baseClaim],
      total: 1,
      page: 1,
      pageSize: 20,
    });
    mockVerifyClaim.mockReturnValue(new Promise(() => {}));
    renderPage();
    await waitFor(() => screen.getByRole("button", { name: /Review Claim/i }));
    await user.click(screen.getByRole("button", { name: /Review Claim/i }));
    await user.click(screen.getByRole("button", { name: /Verify & Mark Paid/i }));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /Verify & Mark Paid/i })).toBeDisabled(),
    );
  });

  it("shows Loader2 spinner in reject button while rejectMutation is pending", async () => {
    const user = userEvent.setup();
    mockGetFeeDashboard.mockResolvedValue(baseDashboard);
    mockGetAdminPaymentClaims.mockResolvedValue({
      claims: [baseClaim],
      total: 1,
      page: 1,
      pageSize: 20,
    });
    mockRejectClaim.mockReturnValue(new Promise(() => {}));
    renderPage();
    await waitFor(() => screen.getByRole("button", { name: /Review Claim/i }));
    await user.click(screen.getByRole("button", { name: /Review Claim/i }));
    await user.click(screen.getByRole("button", { name: /Reject Claim/i }));
    await user.type(screen.getByPlaceholderText(/UTR not found/i), "UTR not found in bank");
    await user.click(screen.getByRole("button", { name: /Confirm Rejection/i }));
    await waitFor(() =>
      expect(screen.getByRole("button", { name: /Confirm Rejection/i })).toBeDisabled(),
    );
  });

  it("shows empty state with no status label when ALL filter and no fees after filter", async () => {
    // statusFilter stays ALL, but fees is empty — covers the "" branch in the ternary
    mockGetFeeDashboard.mockResolvedValue({ ...baseDashboard, fees: [] });
    renderPage();
    await waitFor(() =>
      expect(screen.getByText(/No fee records found for this session/i)).toBeInTheDocument(),
    );
  });

  it("resets to current session when 'Current session' option is selected (v === 'current' branch)", async () => {
    const user = userEvent.setup();
    mockGetFeeDashboard.mockResolvedValue(baseDashboard);
    renderPage();
    await waitFor(() => expect(screen.getByText("Hemant Kumar")).toBeInTheDocument());

    // First select a specific year
    const [sessionCombobox] = screen.getAllByRole("combobox");
    await user.click(sessionCombobox);
    const yearOption = await screen.findByRole("option", { name: "2025-26" });
    await user.click(yearOption);
    await waitFor(() => expect(mockGetFeeDashboard).toHaveBeenCalledWith("soc-1", "2025-26"));

    // Now select "Current session" — should call with undefined
    await user.click(sessionCombobox);
    const currentOption = await screen.findByRole("option", { name: /Current session/i });
    await user.click(currentOption);
    await waitFor(() => expect(mockGetFeeDashboard).toHaveBeenCalledWith("soc-1", undefined));
  });
});
