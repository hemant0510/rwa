import React from "react";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import ConfirmPaymentPage from "@/app/r/payments/confirm/page";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const { mockFetch } = vi.hoisted(() => ({ mockFetch: vi.fn() }));
globalThis.fetch = mockFetch;

const mockPush = vi.fn();

vi.mock("next/navigation", () => ({
  useSearchParams: vi.fn(() => ({
    get: vi.fn((key: string) => (key === "feeId" ? "fee-1" : null)),
  })),
  useRouter: vi.fn(() => ({ push: mockPush })),
}));

vi.mock("@/components/features/payments/PaymentClaimForm", () => ({
  PaymentClaimForm: ({
    membershipFeeId,
    onSuccess,
  }: {
    membershipFeeId: string;
    onSuccess: () => void;
  }) => (
    <div data-testid="payment-claim-form">
      <span>form-fee-{membershipFeeId}</span>
      <button onClick={onSuccess}>simulate-success</button>
    </div>
  ),
}));

vi.mock("@/components/ui/LoadingSkeleton", () => ({
  PageSkeleton: () => <div data-testid="page-skeleton" />,
}));

// ---------------------------------------------------------------------------
// Imports after mocks
// ---------------------------------------------------------------------------

import { useSearchParams } from "next/navigation";

const mockUseSearchParams = vi.mocked(useSearchParams);

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
      <ConfirmPaymentPage />
    </QueryClientProvider>,
  );
}

const mockFee = {
  id: "fee-1",
  sessionYear: "2025-26",
  amountDue: 2000,
  amountPaid: 0,
  status: "PENDING",
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("ConfirmPaymentPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseSearchParams.mockReturnValue({
      get: (key: string) => (key === "feeId" ? "fee-1" : null),
    } as ReturnType<typeof useSearchParams>);
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ fees: [mockFee] }),
    });
  });

  // ── Loading ──────────────────────────────────────────────────────────────

  it("shows loading skeleton while fetching", () => {
    mockFetch.mockReturnValue(new Promise(() => {}));
    renderPage();
    expect(screen.getByTestId("page-skeleton")).toBeInTheDocument();
  });

  // ── Fee not found ─────────────────────────────────────────────────────────

  it("shows 'Fee not found' when feeId is null", async () => {
    mockUseSearchParams.mockReturnValue({
      get: () => null,
    } as ReturnType<typeof useSearchParams>);
    mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve({ fees: [] }) });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText(/Fee not found/i)).toBeInTheDocument();
    });
  });

  it("shows 'Fee not found' when fee id does not match any fee", async () => {
    mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve({ fees: [] }) });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText(/Fee not found/i)).toBeInTheDocument();
    });
  });

  // ── Confirmed state ───────────────────────────────────────────────────────

  it("renders 'Confirm payment' heading", async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("Confirm payment")).toBeInTheDocument();
    });
  });

  it("renders amount and session year", async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText(/2,000/)).toBeInTheDocument();
      expect(screen.getByText(/2025-26/)).toBeInTheDocument();
    });
  });

  it("renders PaymentClaimForm with correct membershipFeeId", async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByText("form-fee-fee-1")).toBeInTheDocument();
    });
  });

  it("navigates to /r/payments on form success", async () => {
    renderPage();
    await waitFor(() => {
      expect(screen.getByRole("button", { name: "simulate-success" })).toBeInTheDocument();
    });
    screen.getByRole("button", { name: "simulate-success" }).click();
    expect(mockPush).toHaveBeenCalledWith("/r/payments");
  });

  // ── Amount calculation ─────────────────────────────────────────────────────

  it("shows amount as amountDue minus amountPaid", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ fees: [{ ...mockFee, amountDue: 2000, amountPaid: 500 }] }),
    });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText(/1,500/)).toBeInTheDocument();
    });
  });
});
