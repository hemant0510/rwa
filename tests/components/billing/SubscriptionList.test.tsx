import React from "react";

import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";

import { SubscriptionListTable } from "@/components/features/billing/SubscriptionList";

const rows = [
  {
    societyId: "s1",
    societyName: "Green Park",
    societyCode: "GP-001",
    planName: "Premium",
    billingCycle: "ANNUAL",
    status: "ACTIVE",
    periodEndDate: "2027-03-01",
    amountDue: 15000,
    lastPaymentDate: "2026-03-01",
  },
  {
    societyId: "s2",
    societyName: "Blue Valley",
    societyCode: "BV-002",
    planName: "Basic",
    billingCycle: null,
    status: "TRIAL",
    periodEndDate: null,
    amountDue: 0,
    lastPaymentDate: null,
  },
];

describe("SubscriptionListTable", () => {
  it("renders table headers", () => {
    render(<SubscriptionListTable rows={rows} />);
    expect(screen.getByText("Society")).toBeInTheDocument();
    expect(screen.getByText("Plan")).toBeInTheDocument();
    expect(screen.getByText("Status")).toBeInTheDocument();
  });

  it("renders society names and codes", () => {
    render(<SubscriptionListTable rows={rows} />);
    expect(screen.getByText("Green Park")).toBeInTheDocument();
    expect(screen.getByText("GP-001")).toBeInTheDocument();
    expect(screen.getByText("Blue Valley")).toBeInTheDocument();
    expect(screen.getByText("BV-002")).toBeInTheDocument();
  });

  it("renders plan names", () => {
    render(<SubscriptionListTable rows={rows} />);
    expect(screen.getByText("Premium")).toBeInTheDocument();
    expect(screen.getByText("Basic")).toBeInTheDocument();
  });

  it("renders dash for null billing cycle", () => {
    render(<SubscriptionListTable rows={rows} />);
    const cells = screen.getAllByText("-");
    expect(cells.length).toBeGreaterThanOrEqual(1);
  });

  it("renders View and Billing action buttons per row", () => {
    render(<SubscriptionListTable rows={rows} />);
    const viewLinks = screen.getAllByRole("link", { name: "View" });
    const billingLinks = screen.getAllByRole("link", { name: "Billing" });
    expect(viewLinks).toHaveLength(2);
    expect(billingLinks).toHaveLength(2);
  });

  it("formats amount in INR", () => {
    render(<SubscriptionListTable rows={rows} />);
    expect(screen.getByText("₹15,000")).toBeInTheDocument();
  });
});
