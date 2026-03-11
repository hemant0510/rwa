import React from "react";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";

import { BillingCycleSelector } from "@/components/features/plans/BillingCycleSelector";
import type { PlatformPlan } from "@/types/plan";

function makePlan(overrides: Partial<PlatformPlan> = {}): PlatformPlan {
  return {
    id: "plan-1",
    name: "Basic Plan",
    slug: "basic-plan",
    description: null,
    planType: "FLAT_FEE",
    residentLimit: 150,
    pricePerUnit: null,
    featuresJson: {
      resident_management: true,
      fee_collection: true,
      expense_tracking: true,
      basic_reports: true,
      advanced_reports: false,
      whatsapp: false,
      elections: false,
      ai_insights: false,
      api_access: false,
      multi_admin: false,
    },
    isActive: true,
    isPublic: true,
    displayOrder: 1,
    badgeText: null,
    trialAccessLevel: false,
    createdAt: "2025-01-01T00:00:00.000Z",
    updatedAt: "2025-01-01T00:00:00.000Z",
    billingOptions: [
      {
        id: "opt-1",
        planId: "plan-1",
        billingCycle: "MONTHLY",
        price: 999,
        isActive: true,
        createdAt: "",
        updatedAt: "",
      },
      {
        id: "opt-2",
        planId: "plan-1",
        billingCycle: "ANNUAL",
        price: 9990,
        isActive: true,
        createdAt: "",
        updatedAt: "",
      },
      {
        id: "opt-3",
        planId: "plan-1",
        billingCycle: "TWO_YEAR",
        price: 19980,
        isActive: true,
        createdAt: "",
        updatedAt: "",
      },
      {
        id: "opt-4",
        planId: "plan-1",
        billingCycle: "THREE_YEAR",
        price: 26973,
        isActive: true,
        createdAt: "",
        updatedAt: "",
      },
    ],
    ...overrides,
  };
}

describe("BillingCycleSelector", () => {
  it("renders only active billing options", () => {
    const plan = makePlan({
      billingOptions: [
        {
          id: "opt-1",
          planId: "plan-1",
          billingCycle: "MONTHLY",
          price: 999,
          isActive: true,
          createdAt: "",
          updatedAt: "",
        },
        {
          id: "opt-2",
          planId: "plan-1",
          billingCycle: "ANNUAL",
          price: 9990,
          isActive: false,
          createdAt: "",
          updatedAt: "",
        },
      ],
    });
    render(<BillingCycleSelector plan={plan} selected="MONTHLY" onChange={vi.fn()} />);
    expect(screen.getByText("Monthly")).toBeInTheDocument();
    expect(screen.queryByText("Annual")).toBeNull();
  });

  it("renders all 4 cycle labels when all options are active", () => {
    const plan = makePlan();
    render(<BillingCycleSelector plan={plan} selected="MONTHLY" onChange={vi.fn()} />);
    expect(screen.getByText("Monthly")).toBeInTheDocument();
    expect(screen.getByText("Annual")).toBeInTheDocument();
    expect(screen.getByText("2 Years")).toBeInTheDocument();
    expect(screen.getByText("3 Years")).toBeInTheDocument();
  });

  it("calls onChange when a billing cycle button is clicked", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const plan = makePlan();
    render(<BillingCycleSelector plan={plan} selected="MONTHLY" onChange={onChange} />);

    await user.click(screen.getByText("Annual"));
    expect(onChange).toHaveBeenCalledWith("ANNUAL");
  });

  it("shows savings badge for ANNUAL when savings > 1 month", () => {
    // Annual: 9990, Monthly*12 = 11988, savings = 1998, savingMonths ≈ 2
    const plan = makePlan();
    render(<BillingCycleSelector plan={plan} selected="MONTHLY" onChange={vi.fn()} />);
    // Should show "2 months free" for annual
    expect(screen.getByText("2 months free")).toBeInTheDocument();
  });

  it("shows savings badge for TWO_YEAR when savings >= 1 month", () => {
    // TWO_YEAR: 19980, Monthly*24 = 23976, savings = 3996, savingMonths ≈ 4
    const plan = makePlan();
    render(<BillingCycleSelector plan={plan} selected="MONTHLY" onChange={vi.fn()} />);
    expect(screen.getByText("4 months free")).toBeInTheDocument();
  });

  it("shows savings badge for THREE_YEAR when savings >= 1 month", () => {
    // THREE_YEAR: 26973, Monthly*36 = 35964, savings = 8991, savingMonths ≈ 9
    const plan = makePlan();
    render(<BillingCycleSelector plan={plan} selected="MONTHLY" onChange={vi.fn()} />);
    expect(screen.getByText("9 months free")).toBeInTheDocument();
  });

  it("does not show savings badge for MONTHLY", () => {
    const plan = makePlan();
    render(<BillingCycleSelector plan={plan} selected="MONTHLY" onChange={vi.fn()} />);
    // "months free" badges should not appear for monthly
    const monthlyBtn = screen.getByText("Monthly").closest("button");
    expect(monthlyBtn?.querySelector("[class*='bg-green']")).toBeNull();
  });

  it("does not show savings badge when savings <= 0", () => {
    // Set annual price equal to monthly*12 (no savings)
    const plan = makePlan({
      billingOptions: [
        {
          id: "opt-1",
          planId: "plan-1",
          billingCycle: "MONTHLY",
          price: 999,
          isActive: true,
          createdAt: "",
          updatedAt: "",
        },
        {
          id: "opt-2",
          planId: "plan-1",
          billingCycle: "ANNUAL",
          price: 11988,
          isActive: true,
          createdAt: "",
          updatedAt: "",
        },
      ],
    });
    render(<BillingCycleSelector plan={plan} selected="MONTHLY" onChange={vi.fn()} />);
    expect(screen.queryByText(/months free/)).toBeNull();
  });

  it("returns null savings when monthly option is missing", () => {
    const plan = makePlan({
      billingOptions: [
        {
          id: "opt-2",
          planId: "plan-1",
          billingCycle: "ANNUAL",
          price: 9990,
          isActive: true,
          createdAt: "",
          updatedAt: "",
        },
      ],
    });
    render(<BillingCycleSelector plan={plan} selected="ANNUAL" onChange={vi.fn()} />);
    expect(screen.queryByText(/months free/)).toBeNull();
  });

  it("shows effective price when discountPct is provided", () => {
    const plan = makePlan({
      billingOptions: [
        {
          id: "opt-1",
          planId: "plan-1",
          billingCycle: "MONTHLY",
          price: 1000,
          isActive: true,
          createdAt: "",
          updatedAt: "",
        },
      ],
    });
    render(
      <BillingCycleSelector plan={plan} selected="MONTHLY" onChange={vi.fn()} discountPct={20} />,
    );
    // 1000 * 0.8 = 800
    expect(screen.getByText("₹800")).toBeInTheDocument();
  });

  it("shows original strikethrough price when discountPct is provided", () => {
    const plan = makePlan({
      billingOptions: [
        {
          id: "opt-1",
          planId: "plan-1",
          billingCycle: "MONTHLY",
          price: 1000,
          isActive: true,
          createdAt: "",
          updatedAt: "",
        },
      ],
    });
    render(
      <BillingCycleSelector plan={plan} selected="MONTHLY" onChange={vi.fn()} discountPct={20} />,
    );
    // Original price should appear (with line-through style)
    expect(screen.getByText("₹1,000")).toBeInTheDocument();
  });

  it("shows /month label for FLAT_FEE monthly option", () => {
    const plan = makePlan({
      billingOptions: [
        {
          id: "opt-1",
          planId: "plan-1",
          billingCycle: "MONTHLY",
          price: 999,
          isActive: true,
          createdAt: "",
          updatedAt: "",
        },
      ],
    });
    render(<BillingCycleSelector plan={plan} selected="MONTHLY" onChange={vi.fn()} />);
    expect(screen.getByText("/month")).toBeInTheDocument();
  });

  it("shows /year label for FLAT_FEE annual option", () => {
    const plan = makePlan({
      billingOptions: [
        {
          id: "opt-1",
          planId: "plan-1",
          billingCycle: "MONTHLY",
          price: 999,
          isActive: true,
          createdAt: "",
          updatedAt: "",
        },
        {
          id: "opt-2",
          planId: "plan-1",
          billingCycle: "ANNUAL",
          price: 9990,
          isActive: true,
          createdAt: "",
          updatedAt: "",
        },
      ],
    });
    render(<BillingCycleSelector plan={plan} selected="MONTHLY" onChange={vi.fn()} />);
    expect(screen.getByText("/year")).toBeInTheDocument();
  });

  it("shows 'for 2 years' label for TWO_YEAR FLAT_FEE option", () => {
    const plan = makePlan({
      billingOptions: [
        {
          id: "opt-1",
          planId: "plan-1",
          billingCycle: "MONTHLY",
          price: 999,
          isActive: true,
          createdAt: "",
          updatedAt: "",
        },
        {
          id: "opt-3",
          planId: "plan-1",
          billingCycle: "TWO_YEAR",
          price: 19980,
          isActive: true,
          createdAt: "",
          updatedAt: "",
        },
      ],
    });
    render(<BillingCycleSelector plan={plan} selected="MONTHLY" onChange={vi.fn()} />);
    expect(screen.getByText("for 2 years")).toBeInTheDocument();
  });

  it("shows 'for 3 years' label for THREE_YEAR FLAT_FEE option", () => {
    const plan = makePlan({
      billingOptions: [
        {
          id: "opt-1",
          planId: "plan-1",
          billingCycle: "MONTHLY",
          price: 999,
          isActive: true,
          createdAt: "",
          updatedAt: "",
        },
        {
          id: "opt-4",
          planId: "plan-1",
          billingCycle: "THREE_YEAR",
          price: 26973,
          isActive: true,
          createdAt: "",
          updatedAt: "",
        },
      ],
    });
    render(<BillingCycleSelector plan={plan} selected="MONTHLY" onChange={vi.fn()} />);
    expect(screen.getByText("for 3 years")).toBeInTheDocument();
  });

  it("shows /unit/month label for PER_UNIT plans", () => {
    const plan = makePlan({
      planType: "PER_UNIT",
      pricePerUnit: 8,
      billingOptions: [
        {
          id: "opt-1",
          planId: "plan-1",
          billingCycle: "MONTHLY",
          price: 80,
          isActive: true,
          createdAt: "",
          updatedAt: "",
        },
      ],
    });
    render(<BillingCycleSelector plan={plan} selected="MONTHLY" onChange={vi.fn()} />);
    expect(screen.getByText("/unit/month")).toBeInTheDocument();
  });

  it("highlights selected cycle with ring class", () => {
    const plan = makePlan({
      billingOptions: [
        {
          id: "opt-1",
          planId: "plan-1",
          billingCycle: "MONTHLY",
          price: 999,
          isActive: true,
          createdAt: "",
          updatedAt: "",
        },
        {
          id: "opt-2",
          planId: "plan-1",
          billingCycle: "ANNUAL",
          price: 9990,
          isActive: true,
          createdAt: "",
          updatedAt: "",
        },
      ],
    });
    const { container } = render(
      <BillingCycleSelector plan={plan} selected="ANNUAL" onChange={vi.fn()} />,
    );
    const selectedBtn = container.querySelector("[class*='ring-2']");
    expect(selectedBtn).not.toBeNull();
    expect(selectedBtn?.textContent).toContain("Annual");
  });
});
