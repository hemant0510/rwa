import React from "react";

import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";

import { InvoicePDF } from "@/components/features/billing/InvoicePDF";

describe("InvoicePDF", () => {
  it("renders a download link with correct href", () => {
    render(<InvoicePDF societyId="soc-1" invoiceId="inv-1" />);
    const link = screen.getByRole("link");
    expect(link).toHaveAttribute("href", "/api/v1/societies/soc-1/subscription/invoices/inv-1/pdf");
    expect(link).toHaveAttribute("target", "_blank");
  });

  it("renders Download PDF button", () => {
    render(<InvoicePDF societyId="soc-1" invoiceId="inv-1" />);
    expect(screen.getByText("Download PDF")).toBeInTheDocument();
  });
});
