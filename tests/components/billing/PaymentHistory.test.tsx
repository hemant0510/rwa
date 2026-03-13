import React from "react";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { SubscriptionPaymentHistory } from "@/components/features/billing/PaymentHistory";

vi.mock("@/services/billing", () => ({
  getSubscriptionPayments: vi.fn(),
}));

import { getSubscriptionPayments } from "@/services/billing";

const mockGetPayments = vi.mocked(getSubscriptionPayments);

function renderWithClient(ui: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

describe("SubscriptionPaymentHistory", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows loading state", () => {
    mockGetPayments.mockReturnValue(new Promise(() => {}));
    renderWithClient(<SubscriptionPaymentHistory societyId="soc-1" />);
    expect(screen.getByText("Loading payments...")).toBeInTheDocument();
  });

  it("renders payment rows when data loads", async () => {
    mockGetPayments.mockResolvedValue([
      {
        id: "p1",
        paymentDate: "2026-03-10",
        amount: 5000,
        paymentMode: "UPI",
        referenceNo: "REF-123",
        invoiceNo: "INV-2026-000001",
      },
    ]);
    renderWithClient(<SubscriptionPaymentHistory societyId="soc-1" />);
    expect(await screen.findByText("UPI")).toBeInTheDocument();
    expect(screen.getByText("REF-123")).toBeInTheDocument();
    expect(screen.getByText("INV-2026-000001")).toBeInTheDocument();
  });

  it("renders dash for null referenceNo", async () => {
    mockGetPayments.mockResolvedValue([
      {
        id: "p2",
        paymentDate: "2026-03-10",
        amount: 1000,
        paymentMode: "CASH",
        referenceNo: null,
        invoiceNo: "INV-2026-000002",
      },
    ]);
    renderWithClient(<SubscriptionPaymentHistory societyId="soc-1" />);
    await screen.findByText("CASH");
    expect(screen.getByText("-")).toBeInTheDocument();
  });
});
