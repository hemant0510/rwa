import React from "react";

import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";

import { BillingDashboardStats } from "@/components/features/billing/DashboardStats";

const data = {
  totalActive: 42,
  expiringSoon: 5,
  expired: 2,
  trialEnding: 3,
  revenueThisMonth: 125000,
  pendingInvoices: 8,
};

describe("BillingDashboardStats", () => {
  it("renders all stat cards", () => {
    render(<BillingDashboardStats data={data} />);
    expect(screen.getByText("Total Active")).toBeInTheDocument();
    expect(screen.getByText("42")).toBeInTheDocument();
    expect(screen.getByText("Expiring Soon (30d)")).toBeInTheDocument();
    expect(screen.getByText("5")).toBeInTheDocument();
    expect(screen.getByText("Expired")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("Trial Ending (7d)")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
    expect(screen.getByText("Pending Invoices")).toBeInTheDocument();
    expect(screen.getByText("8")).toBeInTheDocument();
  });

  it("formats revenue in INR", () => {
    render(<BillingDashboardStats data={data} />);
    expect(screen.getByText("Revenue This Month")).toBeInTheDocument();
    expect(screen.getByText(/₹1,25,000/)).toBeInTheDocument();
  });
});
