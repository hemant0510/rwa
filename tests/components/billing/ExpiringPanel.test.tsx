import React from "react";

import { render, screen } from "@testing-library/react";
import { describe, it, expect } from "vitest";

import { ExpiringSubscriptionsPanel } from "@/components/features/billing/ExpiringPanel";

describe("ExpiringSubscriptionsPanel", () => {
  it("shows empty message when no items", () => {
    render(<ExpiringSubscriptionsPanel items={[]} />);
    expect(screen.getByText("No subscriptions expiring in this range.")).toBeInTheDocument();
  });

  it("renders society names and dates", () => {
    const items = [
      { societyId: "s1", societyName: "Green Park", currentPeriodEnd: "2026-04-01" },
      { societyId: "s2", societyName: "Blue Valley", currentPeriodEnd: "2026-04-15" },
    ];
    render(<ExpiringSubscriptionsPanel items={items} />);
    expect(screen.getByText("Green Park")).toBeInTheDocument();
    expect(screen.getByText("Blue Valley")).toBeInTheDocument();
  });

  it("renders Review buttons linking to billing page", () => {
    const items = [{ societyId: "s1", societyName: "Green Park", currentPeriodEnd: "2026-04-01" }];
    render(<ExpiringSubscriptionsPanel items={items} />);
    const reviewLink = screen.getByRole("link");
    expect(reviewLink).toHaveAttribute("href", "/sa/societies/s1/billing");
  });

  it("limits display to 10 items", () => {
    const items = Array.from({ length: 15 }, (_, i) => ({
      societyId: `s${i}`,
      societyName: `Society ${i}`,
      currentPeriodEnd: "2026-04-01",
    }));
    render(<ExpiringSubscriptionsPanel items={items} />);
    const buttons = screen.getAllByText("Review");
    expect(buttons).toHaveLength(10);
  });
});
