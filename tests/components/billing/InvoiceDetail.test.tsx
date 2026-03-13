import React from "react";

import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";

import { InvoiceDetailCard } from "@/components/features/billing/InvoiceDetail";

const invoice = {
  invoiceNo: "INV-2026-000001",
  planName: "Premium",
  billingCycle: "ANNUAL",
  finalAmount: 25000,
  status: "UNPAID",
  dueDate: "2026-04-15",
};

describe("InvoiceDetailCard", () => {
  it("renders invoice number in header", () => {
    render(<InvoiceDetailCard invoice={invoice} />);
    expect(screen.getByText("Invoice INV-2026-000001")).toBeInTheDocument();
  });

  it("renders plan, cycle, amount, status", () => {
    render(<InvoiceDetailCard invoice={invoice} />);
    expect(screen.getByText("Plan: Premium")).toBeInTheDocument();
    expect(screen.getByText("Billing Cycle: ANNUAL")).toBeInTheDocument();
    expect(screen.getByText(/₹25,000/)).toBeInTheDocument();
    expect(screen.getByText("Status: UNPAID")).toBeInTheDocument();
  });
});
