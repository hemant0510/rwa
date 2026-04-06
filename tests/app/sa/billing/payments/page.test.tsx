import React from "react";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { toast } from "sonner";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockGetAllPayments = vi.hoisted(() => vi.fn());
const mockGetSaSubscriptionClaims = vi.hoisted(() => vi.fn());
const mockGetSaPendingSubClaimsCount = vi.hoisted(() => vi.fn());
const mockVerifySubscriptionClaim = vi.hoisted(() => vi.fn());
const mockRejectSubscriptionClaim = vi.hoisted(() => vi.fn());

vi.mock("@/services/billing", () => ({
  getAllPayments: (...args: unknown[]) => mockGetAllPayments(...args),
}));

vi.mock("@/services/subscription-payment-claims", () => ({
  getSaSubscriptionClaims: (...args: unknown[]) => mockGetSaSubscriptionClaims(...args),
  getSaPendingSubClaimsCount: (...args: unknown[]) => mockGetSaPendingSubClaimsCount(...args),
  verifySubscriptionClaim: (...args: unknown[]) => mockVerifySubscriptionClaim(...args),
  rejectSubscriptionClaim: (...args: unknown[]) => mockRejectSubscriptionClaim(...args),
}));

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

import SuperAdminBillingPaymentsPage from "@/app/sa/billing/payments/page";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function renderPage() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <SuperAdminBillingPaymentsPage />
    </QueryClientProvider>,
  );
}

const mockClaim = {
  id: "claim-1",
  societyId: "soc-1",
  subscriptionId: "sub-1",
  amount: 1799,
  utrNumber: "UTR428756123456",
  paymentDate: "2026-04-01",
  screenshotUrl: "https://example.com/ss.png",
  status: "PENDING",
  verifiedBy: null,
  verifiedAt: null,
  rejectionReason: null,
  periodStart: "2026-04-01",
  periodEnd: "2026-05-01",
  createdAt: "2026-04-04T10:00:00Z",
  society: { name: "Eden Estate" },
  subscription: { planId: "plan-1" },
};

const mockPaymentRow = {
  id: "p-1",
  societyName: "Eden Estate",
  societyCode: "EDEN",
  amount: 5000,
  paymentMode: "UPI",
  referenceNo: "UTR123",
  invoiceNo: "INV-001",
  paymentDate: "2026-01-15",
  isReversal: false,
  isReversed: false,
  createdAt: "2026-01-15",
};

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
  mockGetSaPendingSubClaimsCount.mockResolvedValue({ count: 0 });
  mockGetAllPayments.mockResolvedValue({ rows: [], total: 0 });
  mockGetSaSubscriptionClaims.mockResolvedValue({ claims: [], total: 0, page: 1, pageSize: 20 });
});

// ═══════════════════════════════════════════════════════════════════════════
// Page-level rendering
// ═══════════════════════════════════════════════════════════════════════════

describe("SuperAdminBillingPaymentsPage", () => {
  it("renders page header", () => {
    renderPage();
    expect(screen.getByText("All Payments")).toBeInTheDocument();
    expect(screen.getByText("Payment records and subscription claims")).toBeInTheDocument();
  });

  it("renders both tab triggers", () => {
    renderPage();
    expect(screen.getByRole("tab", { name: /Recorded Payments/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Pending Claims/i })).toBeInTheDocument();
  });

  it("shows pending count badge when count > 0", async () => {
    mockGetSaPendingSubClaimsCount.mockResolvedValue({ count: 5 });
    renderPage();
    await waitFor(() => {
      expect(screen.getByRole("tab", { name: /Pending Claims \(5\)/i })).toBeInTheDocument();
    });
  });

  it("hides pending count badge when count is 0", () => {
    renderPage();
    expect(screen.getByRole("tab", { name: "Pending Claims" })).toBeInTheDocument();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Recorded Payments Tab
// ═══════════════════════════════════════════════════════════════════════════

describe("RecordedPaymentsTab", () => {
  it("shows loading state", () => {
    mockGetAllPayments.mockReturnValue(new Promise(() => {}));
    renderPage();
    expect(screen.getByText("Loading payments...")).toBeInTheDocument();
  });

  it("shows empty state when no records", async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("No payment records found.")).toBeInTheDocument();
    });
  });

  it("renders table with payment data", async () => {
    mockGetAllPayments.mockResolvedValue({ rows: [mockPaymentRow], total: 1 });
    renderPage();
    await waitFor(() => expect(screen.getByText("Eden Estate")).toBeInTheDocument());
    expect(screen.getByText("EDEN")).toBeInTheDocument();
    expect(screen.getByText("UTR123")).toBeInTheDocument();
    expect(screen.getByText("INV-001")).toBeInTheDocument();
    expect(screen.getByText("Active")).toBeInTheDocument();
  });

  it("shows reversal badge for reversal rows", async () => {
    mockGetAllPayments.mockResolvedValue({
      rows: [{ ...mockPaymentRow, isReversal: true }],
      total: 1,
    });
    renderPage();
    await waitFor(() => expect(screen.getByText("Reversal")).toBeInTheDocument());
  });

  it("shows reversed badge for reversed rows", async () => {
    mockGetAllPayments.mockResolvedValue({
      rows: [{ ...mockPaymentRow, isReversed: true }],
      total: 1,
    });
    renderPage();
    await waitFor(() => expect(screen.getByText("Reversed")).toBeInTheDocument());
  });

  it("shows dash for missing referenceNo", async () => {
    mockGetAllPayments.mockResolvedValue({
      rows: [{ ...mockPaymentRow, referenceNo: null }],
      total: 1,
    });
    renderPage();
    await waitFor(() => expect(screen.getByText("Eden Estate")).toBeInTheDocument());
    // referenceNo column shows "-"
    const cells = screen.getAllByRole("cell");
    const refCell = cells.find((c) => c.textContent === "-");
    expect(refCell).toBeDefined();
  });

  it("renders pagination when totalPages > 1", async () => {
    const rows = Array.from({ length: 50 }, (_, i) => ({
      ...mockPaymentRow,
      id: `p-${i}`,
    }));
    mockGetAllPayments.mockResolvedValue({ rows, total: 100 });
    renderPage();
    await waitFor(() => expect(screen.getByText("Page 1 of 2")).toBeInTheDocument());
    expect(screen.getByRole("button", { name: "Previous" })).toBeDisabled();
    expect(screen.getByRole("button", { name: "Next" })).toBeEnabled();
  });

  it("navigates to next page on Next click", async () => {
    const user = userEvent.setup();
    const rows = Array.from({ length: 50 }, (_, i) => ({
      ...mockPaymentRow,
      id: `p-${i}`,
    }));
    mockGetAllPayments.mockResolvedValue({ rows, total: 100 });
    renderPage();
    await waitFor(() => expect(screen.getByText("Page 1 of 2")).toBeInTheDocument());
    await user.click(screen.getByRole("button", { name: "Next" }));
    await waitFor(() => expect(screen.getByText("Page 2 of 2")).toBeInTheDocument());
  });

  it("navigates to previous page on Previous click", async () => {
    const user = userEvent.setup();
    const rows = Array.from({ length: 50 }, (_, i) => ({
      ...mockPaymentRow,
      id: `p-${i}`,
    }));
    mockGetAllPayments.mockResolvedValue({ rows, total: 100 });
    renderPage();
    await waitFor(() => expect(screen.getByText("Page 1 of 2")).toBeInTheDocument());
    // Go to page 2
    await user.click(screen.getByRole("button", { name: "Next" }));
    await waitFor(() => expect(screen.getByText("Page 2 of 2")).toBeInTheDocument());
    // Go back to page 1
    await user.click(screen.getByRole("button", { name: "Previous" }));
    await waitFor(() => expect(screen.getByText("Page 1 of 2")).toBeInTheDocument());
  });

  it("hides pagination when only 1 page", async () => {
    mockGetAllPayments.mockResolvedValue({ rows: [mockPaymentRow], total: 1 });
    renderPage();
    await waitFor(() => expect(screen.getByText("Eden Estate")).toBeInTheDocument());
    expect(screen.queryByText("Page 1 of")).not.toBeInTheDocument();
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// Pending Claims Tab
// ═══════════════════════════════════════════════════════════════════════════

describe("PendingClaimsTab", () => {
  async function switchToClaimsTab() {
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole("tab", { name: /Pending Claims/i }));
    return user;
  }

  it("shows loading state", async () => {
    mockGetSaSubscriptionClaims.mockReturnValue(new Promise(() => {}));
    await switchToClaimsTab();
    expect(screen.getByText("Loading claims...")).toBeInTheDocument();
  });

  it("shows empty state when no claims", async () => {
    await switchToClaimsTab();
    await waitFor(() => {
      expect(screen.getByText("No subscription payment claims found.")).toBeInTheDocument();
    });
  });

  it("renders claim cards", async () => {
    mockGetSaSubscriptionClaims.mockResolvedValue({
      claims: [mockClaim],
      total: 1,
      page: 1,
      pageSize: 20,
    });
    await switchToClaimsTab();
    await waitFor(() => expect(screen.getByText("Eden Estate")).toBeInTheDocument());
    expect(screen.getByText(/UTR428756123456/)).toBeInTheDocument();
    expect(screen.getByText("PENDING")).toBeInTheDocument();
  });

  it("renders status filter dropdown", async () => {
    await switchToClaimsTab();
    expect(screen.getByLabelText(/Filter by status/i)).toBeInTheDocument();
  });

  it("filters claims by status selection", async () => {
    const user = await switchToClaimsTab();
    const select = screen.getByLabelText(/Filter by status/i);
    await user.selectOptions(select, "VERIFIED");
    await waitFor(() => {
      expect(mockGetSaSubscriptionClaims).toHaveBeenCalledWith(
        expect.objectContaining({ status: "VERIFIED" }),
      );
    });
  });

  it("shows all statuses when filter set to empty", async () => {
    const user = await switchToClaimsTab();
    const select = screen.getByLabelText(/Filter by status/i);
    await user.selectOptions(select, "");
    await waitFor(() => {
      expect(mockGetSaSubscriptionClaims).toHaveBeenCalledWith(
        expect.objectContaining({ status: undefined }),
      );
    });
  });
});

// ═══════════════════════════════════════════════════════════════════════════
// PendingSubClaimCard
// ═══════════════════════════════════════════════════════════════════════════

describe("PendingSubClaimCard", () => {
  async function renderWithClaim(claim = mockClaim) {
    mockGetSaSubscriptionClaims.mockResolvedValue({
      claims: [claim],
      total: 1,
      page: 1,
      pageSize: 20,
    });
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole("tab", { name: /Pending Claims/i }));
    await waitFor(() => expect(screen.getByText("Eden Estate")).toBeInTheDocument());
    return user;
  }

  it("displays society name, amount, and date", async () => {
    await renderWithClaim();
    expect(screen.getByText("Eden Estate")).toBeInTheDocument();
    expect(screen.getByText(/1,799/)).toBeInTheDocument();
  });

  it("displays UTR and period", async () => {
    await renderWithClaim();
    expect(screen.getByText(/UTR428756123456/)).toBeInTheDocument();
    expect(screen.getByText(/Period/)).toBeInTheDocument();
  });

  it("shows screenshot link when present", async () => {
    await renderWithClaim();
    const link = screen.getByText("View Screenshot");
    expect(link).toHaveAttribute("href", "https://example.com/ss.png");
    expect(link).toHaveAttribute("target", "_blank");
  });

  it("hides screenshot link when null", async () => {
    await renderWithClaim({ ...mockClaim, screenshotUrl: null });
    expect(screen.queryByText("View Screenshot")).not.toBeInTheDocument();
  });

  it("shows Confirm and Reject buttons for PENDING claims", async () => {
    await renderWithClaim();
    expect(screen.getByRole("button", { name: /Confirm Payment/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Reject/i })).toBeInTheDocument();
  });

  it("hides action buttons for VERIFIED claims", async () => {
    await renderWithClaim({ ...mockClaim, status: "VERIFIED" });
    expect(screen.queryByRole("button", { name: /Confirm Payment/i })).not.toBeInTheDocument();
    expect(screen.getByText("VERIFIED")).toBeInTheDocument();
  });

  it("hides action buttons for REJECTED claims", async () => {
    await renderWithClaim({ ...mockClaim, status: "REJECTED" });
    expect(screen.queryByRole("button", { name: /Confirm Payment/i })).not.toBeInTheDocument();
    expect(screen.getByText("REJECTED")).toBeInTheDocument();
  });

  it("calls verifySubscriptionClaim on Confirm click", async () => {
    mockVerifySubscriptionClaim.mockResolvedValue({ claim: { ...mockClaim, status: "VERIFIED" } });
    const user = await renderWithClaim();
    await user.click(screen.getByRole("button", { name: /Confirm Payment/i }));
    await waitFor(() => {
      expect(mockVerifySubscriptionClaim).toHaveBeenCalledWith("claim-1");
      expect(toast.success).toHaveBeenCalledWith("Subscription payment verified");
    });
  });

  it("shows error toast when verify fails", async () => {
    mockVerifySubscriptionClaim.mockRejectedValue(new Error("Verify failed"));
    const user = await renderWithClaim();
    await user.click(screen.getByRole("button", { name: /Confirm Payment/i }));
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Verify failed");
    });
  });

  it("opens reject mode with reason textarea on Reject click", async () => {
    const user = await renderWithClaim();
    await user.click(screen.getByRole("button", { name: "Reject" }));
    expect(screen.getByLabelText(/Rejection Reason/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Confirm Reject/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Cancel/i })).toBeInTheDocument();
  });

  it("disables Confirm Reject when reason is too short", async () => {
    const user = await renderWithClaim();
    await user.click(screen.getByRole("button", { name: "Reject" }));
    expect(screen.getByRole("button", { name: /Confirm Reject/i })).toBeDisabled();
    await user.type(screen.getByLabelText(/Rejection Reason/i), "short");
    expect(screen.getByRole("button", { name: /Confirm Reject/i })).toBeDisabled();
  });

  it("enables Confirm Reject when reason >= 10 chars", async () => {
    const user = await renderWithClaim();
    await user.click(screen.getByRole("button", { name: "Reject" }));
    await user.type(
      screen.getByLabelText(/Rejection Reason/i),
      "UTR does not match our bank records",
    );
    expect(screen.getByRole("button", { name: /Confirm Reject/i })).toBeEnabled();
  });

  it("calls rejectSubscriptionClaim with reason on Confirm Reject click", async () => {
    mockRejectSubscriptionClaim.mockResolvedValue({ claim: { ...mockClaim, status: "REJECTED" } });
    const user = await renderWithClaim();
    await user.click(screen.getByRole("button", { name: "Reject" }));
    await user.type(
      screen.getByLabelText(/Rejection Reason/i),
      "UTR does not match our bank records",
    );
    await user.click(screen.getByRole("button", { name: /Confirm Reject/i }));
    await waitFor(() => {
      expect(mockRejectSubscriptionClaim).toHaveBeenCalledWith(
        "claim-1",
        "UTR does not match our bank records",
      );
      expect(toast.success).toHaveBeenCalledWith("Subscription payment claim rejected");
    });
  });

  it("shows error toast when reject fails", async () => {
    mockRejectSubscriptionClaim.mockRejectedValue(new Error("Reject failed"));
    const user = await renderWithClaim();
    await user.click(screen.getByRole("button", { name: "Reject" }));
    await user.type(
      screen.getByLabelText(/Rejection Reason/i),
      "UTR does not match our bank records",
    );
    await user.click(screen.getByRole("button", { name: /Confirm Reject/i }));
    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith("Reject failed");
    });
  });

  it("closes reject mode on Cancel click", async () => {
    const user = await renderWithClaim();
    await user.click(screen.getByRole("button", { name: "Reject" }));
    expect(screen.getByLabelText(/Rejection Reason/i)).toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: /Cancel/i }));
    expect(screen.queryByLabelText(/Rejection Reason/i)).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Confirm Payment/i })).toBeInTheDocument();
  });

  it("shows fallback society name when null", async () => {
    const claimNoSociety = { ...mockClaim, society: undefined };
    mockGetSaSubscriptionClaims.mockResolvedValue({
      claims: [claimNoSociety],
      total: 1,
      page: 1,
      pageSize: 20,
    });
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByRole("tab", { name: /Pending Claims/i }));
    await waitFor(() => expect(screen.getByText("Unknown Society")).toBeInTheDocument());
  });

  it("hides period when periodStart/periodEnd are null", async () => {
    await renderWithClaim({ ...mockClaim, periodStart: null, periodEnd: null });
    expect(screen.queryByText(/Period/)).not.toBeInTheDocument();
  });
});
