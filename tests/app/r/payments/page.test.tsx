import React from "react";

import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";

import ResidentPaymentsPage from "@/app/r/payments/page";

describe("ResidentPaymentsPage", () => {
  it("renders payment history heading", () => {
    render(<ResidentPaymentsPage />);
    expect(screen.getByText("Payment History")).toBeInTheDocument();
  });

  it("renders session year cards", () => {
    render(<ResidentPaymentsPage />);
    expect(screen.getByText("Session 2025-26")).toBeInTheDocument();
    expect(screen.getByText("Session 2024-25")).toBeInTheDocument();
  });

  it("renders payment amounts and modes", () => {
    render(<ResidentPaymentsPage />);
    // Both UPI and CASH payments should be shown
    expect(screen.getByText(/UPI/)).toBeInTheDocument();
    expect(screen.getByText(/CASH/)).toBeInTheDocument();
  });

  it("renders receipt numbers", () => {
    render(<ResidentPaymentsPage />);
    expect(screen.getByText("EDEN-2025-R001")).toBeInTheDocument();
    expect(screen.getByText("EDEN-2024-R001")).toBeInTheDocument();
  });

  it("shows PAID status badges", () => {
    render(<ResidentPaymentsPage />);
    const badges = screen.getAllByText("PAID");
    expect(badges.length).toBeGreaterThanOrEqual(2);
  });
});
