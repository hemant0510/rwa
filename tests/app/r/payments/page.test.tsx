import React from "react";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import ResidentPaymentsPage from "@/app/r/payments/page";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const { mockFetch, mockGetMyPaymentClaims } = vi.hoisted(() => ({
  mockFetch: vi.fn(),
  mockGetMyPaymentClaims: vi.fn(),
}));
globalThis.fetch = mockFetch;

vi.mock("@/services/payment-claims", () => ({
  getMyPaymentClaims: mockGetMyPaymentClaims,
}));

vi.mock("@/components/ui/LoadingSkeleton", () => ({
  PageSkeleton: () => <div data-testid="page-skeleton" />,
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeQueryClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

function renderPage(queryClient?: QueryClient) {
  const client = queryClient ?? makeQueryClient();
  return render(
    <QueryClientProvider client={client}>
      <ResidentPaymentsPage />
    </QueryClientProvider>,
  );
}

function mockFetchSuccess(fees: unknown[]) {
  mockFetch.mockResolvedValue({
    ok: true,
    json: () => Promise.resolve({ fees }),
  });
}

function mockFetchFailure() {
  mockFetch.mockResolvedValue({ ok: false });
}

function makeFee(overrides: Record<string, unknown> = {}) {
  return {
    id: "fee-1",
    sessionYear: "2025-26",
    amountDue: 1200,
    amountPaid: 1200,
    status: "PAID",
    isProrata: false,
    joiningFeeIncluded: false,
    gracePeriodEnd: null,
    payments: [],
    ...overrides,
  };
}

function makePayment(overrides: Record<string, unknown> = {}) {
  return {
    id: "pay-1",
    amount: 1200,
    paymentMode: "UPI",
    referenceNo: "UPI123",
    receiptNo: "EDEN-2025-R001",
    receiptUrl: null,
    paymentDate: "2025-04-15T00:00:00.000Z",
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("ResidentPaymentsPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetMyPaymentClaims.mockResolvedValue({ claims: [] });
  });

  function makeClaim(overrides: Record<string, unknown> = {}) {
    return {
      id: "claim-1",
      membershipFeeId: "fee-1",
      claimedAmount: 1200,
      utrNumber: "UTR123",
      paymentDate: "2025-04-10T00:00:00.000Z",
      screenshotUrl: null,
      status: "PENDING",
      rejectionReason: null,
      ...overrides,
    };
  }

  // --- Loading state ---

  it("shows loading skeleton while fees are fetching", () => {
    mockFetch.mockReturnValue(new Promise(() => {})); // never resolves
    mockGetMyPaymentClaims.mockReturnValue(new Promise(() => {}));
    renderPage();
    expect(screen.getByTestId("page-skeleton")).toBeInTheDocument();
  });

  it("shows loading skeleton while claims are fetching", () => {
    mockFetchSuccess([]);
    mockGetMyPaymentClaims.mockReturnValue(new Promise(() => {})); // never resolves
    renderPage();
    expect(screen.getByTestId("page-skeleton")).toBeInTheDocument();
  });

  // --- Error state ---

  it("shows error message when fetch fails", async () => {
    mockFetchFailure();
    renderPage();

    await waitFor(() => {
      expect(screen.getByText("Payment History")).toBeInTheDocument();
      expect(screen.getByText(/Failed to load/i)).toBeInTheDocument();
    });
  });

  // --- Empty state ---

  it("shows empty state when no fees", async () => {
    mockFetchSuccess([]);
    renderPage();

    await waitFor(() => {
      expect(screen.getByText("No payments yet")).toBeInTheDocument();
    });
  });

  it("shows empty state description text", async () => {
    mockFetchSuccess([]);
    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/payment history will appear/i)).toBeInTheDocument();
    });
  });

  // --- Page heading ---

  it("renders Payment History heading", async () => {
    mockFetchSuccess([]);
    renderPage();

    await waitFor(() => {
      expect(screen.getByText("Payment History")).toBeInTheDocument();
    });
  });

  // --- Fee cards ---

  it("renders session year in card header", async () => {
    mockFetchSuccess([makeFee()]);
    renderPage();

    await waitFor(() => {
      expect(screen.getByText("Session 2025-26")).toBeInTheDocument();
    });
  });

  it("renders fee status badge", async () => {
    mockFetchSuccess([makeFee({ status: "PAID" })]);
    renderPage();

    await waitFor(() => {
      expect(screen.getByText("PAID")).toBeInTheDocument();
    });
  });

  it("renders status with underscores replaced by spaces", async () => {
    mockFetchSuccess([makeFee({ status: "NOT_YET_DUE" })]);
    renderPage();

    await waitFor(() => {
      expect(screen.getByText("NOT YET DUE")).toBeInTheDocument();
    });
  });

  it("renders amount due in INR format", async () => {
    mockFetchSuccess([makeFee({ amountDue: 1200, amountPaid: 0 })]);
    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/Amount Due/i)).toBeInTheDocument();
      expect(screen.getByText(/1,200/)).toBeInTheDocument();
    });
  });

  it("renders amount paid in INR format", async () => {
    mockFetchSuccess([makeFee({ amountPaid: 600 })]);
    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/Amount Paid/i)).toBeInTheDocument();
      expect(screen.getByText(/600/)).toBeInTheDocument();
    });
  });

  it("shows pro-rata label when isProrata is true", async () => {
    mockFetchSuccess([makeFee({ isProrata: true })]);
    renderPage();

    await waitFor(() => {
      expect(screen.getByText("(pro-rata)")).toBeInTheDocument();
    });
  });

  it("does not show pro-rata label when isProrata is false", async () => {
    mockFetchSuccess([makeFee({ isProrata: false })]);
    renderPage();

    await waitFor(() => {
      expect(screen.queryByText("(pro-rata)")).not.toBeInTheDocument();
    });
  });

  it("shows grace period due date for unpaid non-exempted fees", async () => {
    mockFetchSuccess([makeFee({ status: "PENDING", gracePeriodEnd: "2025-05-31T00:00:00.000Z" })]);
    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/Due By/i)).toBeInTheDocument();
      expect(screen.getByText("31 May 2025")).toBeInTheDocument();
    });
  });

  it("hides grace period date when status is PAID", async () => {
    mockFetchSuccess([makeFee({ status: "PAID", gracePeriodEnd: "2025-05-31T00:00:00.000Z" })]);
    renderPage();

    await waitFor(() => {
      expect(screen.queryByText(/Due By/i)).not.toBeInTheDocument();
    });
  });

  it("hides grace period date when status is EXEMPTED", async () => {
    mockFetchSuccess([makeFee({ status: "EXEMPTED", gracePeriodEnd: "2025-05-31T00:00:00.000Z" })]);
    renderPage();

    await waitFor(() => {
      expect(screen.queryByText(/Due By/i)).not.toBeInTheDocument();
    });
  });

  // --- Payments nested in fees ---

  it("renders payment section label when payments exist", async () => {
    mockFetchSuccess([makeFee({ payments: [makePayment()] })]);
    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/Payments/i)).toBeInTheDocument();
    });
  });

  it("renders payment mode in payment row", async () => {
    mockFetchSuccess([makeFee({ payments: [makePayment({ paymentMode: "UPI" })] })]);
    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/UPI/i)).toBeInTheDocument();
    });
  });

  it("renders receipt number in payment row", async () => {
    mockFetchSuccess([makeFee({ payments: [makePayment()] })]);
    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/EDEN-2025-R001/)).toBeInTheDocument();
    });
  });

  it("renders payment date in payment row", async () => {
    mockFetchSuccess([
      makeFee({ payments: [makePayment({ paymentDate: "2025-04-15T00:00:00.000Z" })] }),
    ]);
    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/15 Apr 2025/)).toBeInTheDocument();
    });
  });

  it("renders cash payment mode", async () => {
    mockFetchSuccess([makeFee({ payments: [makePayment({ paymentMode: "CASH" })] })]);
    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/CASH/i)).toBeInTheDocument();
    });
  });

  // --- Receipt download ---

  it("renders a link to download receipt when receiptUrl exists", async () => {
    const receiptUrl = "https://storage.example.com/receipt.pdf";
    mockFetchSuccess([makeFee({ payments: [makePayment({ receiptUrl })] })]);
    renderPage();

    await waitFor(() => {
      const link = screen.getByRole("link");
      expect(link).toHaveAttribute("href", receiptUrl);
      expect(link).toHaveAttribute("target", "_blank");
    });
  });

  it("renders disabled download button when no receiptUrl", async () => {
    mockFetchSuccess([makeFee({ payments: [makePayment({ receiptUrl: null })] })]);
    renderPage();

    await waitFor(() => {
      const btn = screen.getByRole("button");
      expect(btn).toBeDisabled();
    });
  });

  // --- Multiple fees ---

  it("renders multiple fee cards", async () => {
    mockFetchSuccess([
      makeFee({ id: "fee-1", sessionYear: "2025-26" }),
      makeFee({ id: "fee-2", sessionYear: "2024-25" }),
    ]);
    renderPage();

    await waitFor(() => {
      expect(screen.getByText("Session 2025-26")).toBeInTheDocument();
      expect(screen.getByText("Session 2024-25")).toBeInTheDocument();
    });
  });

  it("renders multiple payments within a single fee", async () => {
    mockFetchSuccess([
      makeFee({
        payments: [
          makePayment({ id: "p1", receiptNo: "EDEN-2025-R001", paymentMode: "UPI" }),
          makePayment({ id: "p2", receiptNo: "EDEN-2025-R002", paymentMode: "CASH" }),
        ],
      }),
    ]);
    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/EDEN-2025-R001/)).toBeInTheDocument();
      expect(screen.getByText(/EDEN-2025-R002/)).toBeInTheDocument();
    });
  });

  // --- Unknown status ---

  it("renders fee card for unknown status without crashing", async () => {
    mockFetchSuccess([makeFee({ status: "UNKNOWN_STATUS" })]);
    renderPage();

    await waitFor(() => {
      expect(screen.getByText("UNKNOWN STATUS")).toBeInTheDocument();
    });
  });

  // --- Data shape edge cases ---

  it("treats missing fees key in response as empty list", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({}), // no fees key
    });
    renderPage();

    await waitFor(() => {
      expect(screen.getByText("No payments yet")).toBeInTheDocument();
    });
  });

  // --- API call ---

  it("calls the correct fees API endpoint", async () => {
    mockFetchSuccess([]);
    renderPage();

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith("/api/v1/residents/me/fees");
    });
  });

  // --- Claim status badges ---

  it("shows PENDING claim status badge for a fee", async () => {
    mockFetchSuccess([makeFee({ id: "fee-1" })]);
    mockGetMyPaymentClaims.mockResolvedValue({ claims: [makeClaim({ status: "PENDING" })] });
    renderPage();

    await waitFor(() => {
      expect(screen.getByText("PENDING")).toBeInTheDocument();
    });
  });

  it("shows VERIFIED claim status badge for a fee", async () => {
    mockFetchSuccess([makeFee({ id: "fee-1" })]);
    mockGetMyPaymentClaims.mockResolvedValue({ claims: [makeClaim({ status: "VERIFIED" })] });
    renderPage();

    await waitFor(() => {
      expect(screen.getByText("VERIFIED")).toBeInTheDocument();
    });
  });

  it("shows REJECTED claim status badge for a fee", async () => {
    mockFetchSuccess([makeFee({ id: "fee-1" })]);
    mockGetMyPaymentClaims.mockResolvedValue({ claims: [makeClaim({ status: "REJECTED" })] });
    renderPage();

    await waitFor(() => {
      expect(screen.getByText("REJECTED")).toBeInTheDocument();
    });
  });

  it("shows Re-submit button for REJECTED claim", async () => {
    mockFetchSuccess([makeFee({ id: "fee-1" })]);
    mockGetMyPaymentClaims.mockResolvedValue({ claims: [makeClaim({ status: "REJECTED" })] });
    renderPage();

    await waitFor(() => {
      expect(screen.getByRole("link", { name: "Re-submit" })).toBeInTheDocument();
    });
  });

  it("Re-submit button links to confirm page with correct feeId", async () => {
    mockFetchSuccess([makeFee({ id: "fee-1" })]);
    mockGetMyPaymentClaims.mockResolvedValue({ claims: [makeClaim({ status: "REJECTED" })] });
    renderPage();

    await waitFor(() => {
      const link = screen.getByRole("link", { name: "Re-submit" });
      expect(link).toHaveAttribute("href", "/r/payments/confirm?feeId=fee-1");
    });
  });

  it("does not show Re-submit button for PENDING claim", async () => {
    mockFetchSuccess([makeFee({ id: "fee-1" })]);
    mockGetMyPaymentClaims.mockResolvedValue({ claims: [makeClaim({ status: "PENDING" })] });
    renderPage();

    await waitFor(() => {
      expect(screen.queryByRole("link", { name: "Re-submit" })).not.toBeInTheDocument();
    });
  });

  it("does not show Re-submit button for VERIFIED claim", async () => {
    mockFetchSuccess([makeFee({ id: "fee-1" })]);
    mockGetMyPaymentClaims.mockResolvedValue({ claims: [makeClaim({ status: "VERIFIED" })] });
    renderPage();

    await waitFor(() => {
      expect(screen.queryByRole("link", { name: "Re-submit" })).not.toBeInTheDocument();
    });
  });

  it("shows rejection reason text for REJECTED claim with reason", async () => {
    mockFetchSuccess([makeFee({ id: "fee-1" })]);
    mockGetMyPaymentClaims.mockResolvedValue({
      claims: [makeClaim({ status: "REJECTED", rejectionReason: "UTR does not match" })],
    });
    renderPage();

    await waitFor(() => {
      expect(screen.getByText("UTR does not match")).toBeInTheDocument();
    });
  });

  it("does not show rejection reason when claim is PENDING", async () => {
    mockFetchSuccess([makeFee({ id: "fee-1" })]);
    mockGetMyPaymentClaims.mockResolvedValue({
      claims: [makeClaim({ status: "PENDING", rejectionReason: "should not show" })],
    });
    renderPage();

    await waitFor(() => {
      expect(screen.queryByText("should not show")).not.toBeInTheDocument();
    });
  });

  it("shows Payment Claims section label when claims exist", async () => {
    mockFetchSuccess([makeFee({ id: "fee-1" })]);
    mockGetMyPaymentClaims.mockResolvedValue({ claims: [makeClaim()] });
    renderPage();

    await waitFor(() => {
      expect(screen.getByText(/Payment Claims/i)).toBeInTheDocument();
    });
  });

  it("does not show Payment Claims section when no claims", async () => {
    mockFetchSuccess([makeFee({ id: "fee-1" })]);
    mockGetMyPaymentClaims.mockResolvedValue({ claims: [] });
    renderPage();

    await waitFor(() => {
      expect(screen.queryByText(/Payment Claims/i)).not.toBeInTheDocument();
    });
  });

  it("only shows claims for the matching fee", async () => {
    mockFetchSuccess([
      makeFee({ id: "fee-1", sessionYear: "2025-26" }),
      makeFee({ id: "fee-2", sessionYear: "2024-25" }),
    ]);
    mockGetMyPaymentClaims.mockResolvedValue({
      claims: [makeClaim({ id: "claim-1", membershipFeeId: "fee-1", status: "VERIFIED" })],
    });
    renderPage();

    await waitFor(() => {
      // VERIFIED badge present (for fee-1)
      expect(screen.getByText("VERIFIED")).toBeInTheDocument();
      // Only one Payment Claims section (fee-2 has none)
      expect(screen.getAllByText(/Payment Claims/i)).toHaveLength(1);
    });
  });

  it("shows multiple claims for the same fee", async () => {
    mockFetchSuccess([makeFee({ id: "fee-1" })]);
    mockGetMyPaymentClaims.mockResolvedValue({
      claims: [
        makeClaim({ id: "claim-1", membershipFeeId: "fee-1", status: "REJECTED" }),
        makeClaim({ id: "claim-2", membershipFeeId: "fee-1", status: "PENDING" }),
      ],
    });
    renderPage();

    await waitFor(() => {
      expect(screen.getByText("REJECTED")).toBeInTheDocument();
      expect(screen.getByText("PENDING")).toBeInTheDocument();
    });
  });

  it("treats missing claims key in response as empty list", async () => {
    mockFetchSuccess([makeFee({ id: "fee-1" })]);
    mockGetMyPaymentClaims.mockResolvedValue({} as { claims: never[] });
    renderPage();

    await waitFor(() => {
      expect(screen.queryByText(/Payment Claims/i)).not.toBeInTheDocument();
    });
  });

  it("renders claim badge without crashing for unknown claim status", async () => {
    mockFetchSuccess([makeFee({ id: "fee-1" })]);
    mockGetMyPaymentClaims.mockResolvedValue({
      claims: [makeClaim({ status: "UNKNOWN_STATUS" })],
    });
    renderPage();

    await waitFor(() => {
      expect(screen.getByText("UNKNOWN_STATUS")).toBeInTheDocument();
    });
  });
});
