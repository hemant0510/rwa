import React from "react";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import PayFeePage from "@/app/r/payments/pay/page";

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

const { mockFetch } = vi.hoisted(() => ({ mockFetch: vi.fn() }));
globalThis.fetch = mockFetch;

vi.mock("next/navigation", () => ({
  useSearchParams: vi.fn(() => ({
    get: vi.fn((key: string) => (key === "feeId" ? "fee-1" : null)),
  })),
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: vi.fn(() => ({ user: { societyId: "soc-1" } })),
}));

vi.mock("@/services/payment-setup", () => ({
  getPaymentSetup: vi.fn(),
}));

vi.mock("@/components/features/payments/UpiQrDisplay", () => ({
  UpiQrDisplay: ({ amount }: { amount: number }) => (
    <div data-testid="upi-qr-display">UpiQrDisplay amount={amount}</div>
  ),
}));

vi.mock("@/components/ui/LoadingSkeleton", () => ({
  PageSkeleton: () => <div data-testid="page-skeleton" />,
}));

// ---------------------------------------------------------------------------
// Imports after mocks
// ---------------------------------------------------------------------------

import { useSearchParams } from "next/navigation";

import { getPaymentSetup } from "@/services/payment-setup";

const mockGetPaymentSetup = vi.mocked(getPaymentSetup);
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
      <PayFeePage />
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

const mockUpiSettings = {
  upiId: "society@sbi",
  upiQrUrl: "https://example.com/qr.png",
  upiAccountName: "Eden Estate RWA",
};

function setupDefaultMocks() {
  mockFetch.mockResolvedValue({
    ok: true,
    json: () => Promise.resolve({ fees: [mockFee] }),
  });
  mockGetPaymentSetup.mockResolvedValue(mockUpiSettings);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("PayFeePage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUseSearchParams.mockReturnValue({
      get: (key: string) => (key === "feeId" ? "fee-1" : null),
    } as ReturnType<typeof useSearchParams>);
  });

  // ── Loading ──────────────────────────────────────────────────────────────

  it("shows loading skeleton while fetching", () => {
    mockFetch.mockReturnValue(new Promise(() => {}));
    mockGetPaymentSetup.mockReturnValue(new Promise(() => {}));
    renderPage();
    expect(screen.getByTestId("page-skeleton")).toBeInTheDocument();
  });

  // ── Fee not found / missing feeId ────────────────────────────────────────

  it("shows 'Fee not found' when feeId is null", async () => {
    mockUseSearchParams.mockReturnValue({
      get: () => null,
    } as ReturnType<typeof useSearchParams>);
    mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve({ fees: [] }) });
    mockGetPaymentSetup.mockResolvedValue(mockUpiSettings);
    renderPage();
    await waitFor(() => {
      expect(screen.getByText(/Fee not found/i)).toBeInTheDocument();
    });
  });

  it("shows 'Fee not found' when fee id does not match any fee", async () => {
    mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve({ fees: [] }) });
    mockGetPaymentSetup.mockResolvedValue(mockUpiSettings);
    renderPage();
    await waitFor(() => {
      expect(screen.getByText(/Fee not found/i)).toBeInTheDocument();
    });
  });

  // ── UPI configured ────────────────────────────────────────────────────────

  it("renders fee details card", async () => {
    setupDefaultMocks();
    renderPage();
    await waitFor(() => {
      expect(screen.getByText(/Session:/i)).toBeInTheDocument();
      expect(screen.getByText(/2025-26/)).toBeInTheDocument();
    });
  });

  it("renders UpiQrDisplay when UPI is configured", async () => {
    setupDefaultMocks();
    renderPage();
    await waitFor(() => {
      expect(screen.getByTestId("upi-qr-display")).toBeInTheDocument();
    });
  });

  it("renders confirm payment button linking to confirm page", async () => {
    setupDefaultMocks();
    renderPage();
    await waitFor(() => {
      const link = screen.getByRole("link", { name: /I've paid/i });
      expect(link).toBeInTheDocument();
      expect(link).toHaveAttribute("href", expect.stringContaining("feeId=fee-1"));
    });
  });

  it("renders 'Pay later' button", async () => {
    setupDefaultMocks();
    renderPage();
    await waitFor(() => {
      expect(screen.getByRole("link", { name: /Pay later/i })).toBeInTheDocument();
    });
  });

  // ── UPI not configured ────────────────────────────────────────────────────

  it("shows 'not set up' message when society has no UPI", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ fees: [mockFee] }),
    });
    mockGetPaymentSetup.mockResolvedValue({ upiId: null, upiQrUrl: null, upiAccountName: null });
    renderPage();
    await waitFor(() => {
      expect(screen.getByText(/hasn't set up online payments/i)).toBeInTheDocument();
    });
  });

  it("does not render UpiQrDisplay when UPI not configured", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ fees: [mockFee] }),
    });
    mockGetPaymentSetup.mockResolvedValue({ upiId: null, upiQrUrl: null, upiAccountName: null });
    renderPage();
    await waitFor(() => {
      expect(screen.queryByTestId("upi-qr-display")).not.toBeInTheDocument();
    });
  });

  // ── Amount calculation ────────────────────────────────────────────────────

  it("passes amountDue minus amountPaid to UpiQrDisplay", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ fees: [{ ...mockFee, amountDue: 2000, amountPaid: 500 }] }),
    });
    mockGetPaymentSetup.mockResolvedValue(mockUpiSettings);
    renderPage();
    await waitFor(() => {
      expect(screen.getByText(/amount=1500/)).toBeInTheDocument();
    });
  });
});
