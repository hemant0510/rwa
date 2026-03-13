import React from "react";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { InvoiceTable } from "@/components/features/billing/InvoiceTable";

vi.mock("@/services/billing", () => ({
  getInvoices: vi.fn(),
}));

import { getInvoices } from "@/services/billing";

const mockGetInvoices = vi.mocked(getInvoices);

function renderWithClient(ui: React.ReactElement) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

describe("InvoiceTable", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows loading state", () => {
    mockGetInvoices.mockReturnValue(new Promise(() => {})); // never resolves
    renderWithClient(<InvoiceTable societyId="soc-1" />);
    expect(screen.getByText("Loading invoices...")).toBeInTheDocument();
  });

  it("renders invoice rows when data loads", async () => {
    mockGetInvoices.mockResolvedValue([
      {
        id: "inv-1",
        invoiceNo: "INV-2026-000001",
        periodStart: "2026-04-01",
        periodEnd: "2027-04-01",
        finalAmount: 25000,
        paidAmount: 10000,
        status: "PARTIALLY_PAID",
      },
    ]);
    renderWithClient(<InvoiceTable societyId="soc-1" />);
    expect(await screen.findByText("INV-2026-000001")).toBeInTheDocument();
    expect(screen.getByText("PARTIALLY_PAID")).toBeInTheDocument();
  });
});
