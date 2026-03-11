import React from "react";

import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, it, expect, vi } from "vitest";

import { PlanCard } from "@/components/features/plans/PlanCard";
import type { PlatformPlan } from "@/types/plan";

// Mock next/link
vi.mock("next/link", () => ({
  default: ({
    href,
    children,
    className,
  }: {
    href: string;
    children: React.ReactNode;
    className?: string;
  }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));

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
    ],
    ...overrides,
  };
}

describe("PlanCard", () => {
  describe("plan name and type", () => {
    it("renders plan name", () => {
      render(<PlanCard plan={makePlan()} />);
      expect(screen.getByText("Basic Plan")).toBeInTheDocument();
    });

    it("shows 'Flat fee' for FLAT_FEE plan type", () => {
      render(<PlanCard plan={makePlan()} />);
      expect(screen.getByText("Flat fee")).toBeInTheDocument();
    });

    it("shows 'Per unit' for PER_UNIT plan type", () => {
      render(<PlanCard plan={makePlan({ planType: "PER_UNIT", pricePerUnit: 8 })} />);
      expect(screen.getByText("Per unit")).toBeInTheDocument();
    });
  });

  describe("badge text", () => {
    it("renders badgeText when provided", () => {
      render(<PlanCard plan={makePlan({ badgeText: "Most Popular" })} />);
      expect(screen.getByText("Most Popular")).toBeInTheDocument();
    });

    it("does not render badge area when badgeText is null", () => {
      render(<PlanCard plan={makePlan({ badgeText: null })} />);
      expect(screen.queryByText("Most Popular")).toBeNull();
    });
  });

  describe("archived state", () => {
    it("shows 'Archived' badge when plan is not active", () => {
      render(<PlanCard plan={makePlan({ isActive: false })} />);
      expect(screen.getByText("Archived")).toBeInTheDocument();
    });

    it("does not show 'Archived' badge when plan is active", () => {
      render(<PlanCard plan={makePlan({ isActive: true })} />);
      expect(screen.queryByText("Archived")).toBeNull();
    });
  });

  describe("pricing display", () => {
    it("shows monthly price for FLAT_FEE plan with monthly billing option", () => {
      render(<PlanCard plan={makePlan()} />);
      expect(screen.getByText("₹999")).toBeInTheDocument();
      expect(screen.getByText("/month")).toBeInTheDocument();
    });

    it("shows per-unit price for PER_UNIT plan", () => {
      const plan = makePlan({
        planType: "PER_UNIT",
        pricePerUnit: 8,
        billingOptions: [
          {
            id: "opt-1",
            planId: "plan-1",
            billingCycle: "MONTHLY",
            price: 8,
            isActive: true,
            createdAt: "",
            updatedAt: "",
          },
        ],
      });
      render(<PlanCard plan={plan} />);
      expect(screen.getByText("₹8")).toBeInTheDocument();
      expect(screen.getByText("/unit/month")).toBeInTheDocument();
    });

    it("renders no price section when no MONTHLY billing option exists", () => {
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
      render(<PlanCard plan={plan} />);
      // No price with /month or /unit/month
      expect(screen.queryByText("/month")).toBeNull();
      expect(screen.queryByText("/unit/month")).toBeNull();
    });
  });

  describe("resident limit badge", () => {
    it("shows resident limit when set", () => {
      render(<PlanCard plan={makePlan({ residentLimit: 150 })} />);
      expect(screen.getByText("Up to 150 units")).toBeInTheDocument();
    });

    it("shows 'Unlimited units' when residentLimit is null", () => {
      render(<PlanCard plan={makePlan({ residentLimit: null })} />);
      expect(screen.getByText("Unlimited units")).toBeInTheDocument();
    });
  });

  describe("billing options count badge", () => {
    it("shows correct billing cycles count with plural", () => {
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
      render(<PlanCard plan={plan} />);
      expect(screen.getByText("2 billing cycles")).toBeInTheDocument();
    });

    it("shows singular 'billing cycle' when only 1 option", () => {
      render(<PlanCard plan={makePlan()} />);
      expect(screen.getByText("1 billing cycle")).toBeInTheDocument();
    });
  });

  describe("trial tier badge", () => {
    it("shows 'Trial tier' badge when trialAccessLevel is true", () => {
      render(<PlanCard plan={makePlan({ trialAccessLevel: true })} />);
      expect(screen.getByText("Trial tier")).toBeInTheDocument();
    });

    it("does not show 'Trial tier' badge when trialAccessLevel is false", () => {
      render(<PlanCard plan={makePlan({ trialAccessLevel: false })} />);
      expect(screen.queryByText("Trial tier")).toBeNull();
    });
  });

  describe("description", () => {
    it("renders description when provided", () => {
      render(<PlanCard plan={makePlan({ description: "Best plan for small societies" })} />);
      expect(screen.getByText("Best plan for small societies")).toBeInTheDocument();
    });

    it("does not render description when null", () => {
      render(<PlanCard plan={makePlan({ description: null })} />);
      expect(screen.queryByText("Best plan for small societies")).toBeNull();
    });
  });

  describe("features list", () => {
    it("shows enabled features with check icons", () => {
      render(<PlanCard plan={makePlan()} />);
      expect(screen.getByText("Resident Management")).toBeInTheDocument();
      expect(screen.getByText("Fee Collection")).toBeInTheDocument();
    });

    it("shows up to 2 disabled features", () => {
      render(<PlanCard plan={makePlan()} />);
      // allDisabled features from mixed: advanced_reports, whatsapp first 2
      expect(screen.getByText("Advanced Reports & Analytics")).toBeInTheDocument();
      expect(screen.getByText("WhatsApp Notifications")).toBeInTheDocument();
    });

    it("shows overflow count when more than 5 enabled features", () => {
      const plan = makePlan({
        featuresJson: {
          resident_management: true,
          fee_collection: true,
          expense_tracking: true,
          basic_reports: true,
          advanced_reports: true,
          whatsapp: true,
          elections: true,
          ai_insights: false,
          api_access: false,
          multi_admin: false,
        },
      });
      render(<PlanCard plan={plan} />);
      expect(screen.getByText("+2 more features")).toBeInTheDocument();
    });

    it("does not show overflow when 5 or fewer enabled features", () => {
      render(<PlanCard plan={makePlan()} />);
      expect(screen.queryByText(/more features/)).toBeNull();
    });
  });

  describe("active subscribers", () => {
    it("shows active subscriber count when provided", () => {
      render(<PlanCard plan={makePlan({ activeSubscribers: 5 })} />);
      expect(screen.getByText("5 active subscribers")).toBeInTheDocument();
    });

    it("uses singular 'subscriber' when count is 1", () => {
      render(<PlanCard plan={makePlan({ activeSubscribers: 1 })} />);
      expect(screen.getByText("1 active subscriber")).toBeInTheDocument();
    });

    it("does not show subscriber section when activeSubscribers is undefined", () => {
      render(<PlanCard plan={makePlan({ activeSubscribers: undefined })} />);
      expect(screen.queryByText(/active subscriber/)).toBeNull();
    });

    it("shows '0 active subscribers' when count is 0", () => {
      render(<PlanCard plan={makePlan({ activeSubscribers: 0 })} />);
      expect(screen.getByText("0 active subscribers")).toBeInTheDocument();
    });
  });

  describe("visibility toggle", () => {
    it("shows visibility toggle for active plans with onTogglePublic", () => {
      render(
        <PlanCard plan={makePlan({ isActive: true, isPublic: true })} onTogglePublic={vi.fn()} />,
      );
      expect(screen.getByText("Visible to societies")).toBeInTheDocument();
    });

    it("shows 'Hidden' when plan is not public", () => {
      render(
        <PlanCard plan={makePlan({ isActive: true, isPublic: false })} onTogglePublic={vi.fn()} />,
      );
      expect(screen.getByText("Hidden")).toBeInTheDocument();
    });

    it("does not show visibility toggle for archived plans", () => {
      render(<PlanCard plan={makePlan({ isActive: false })} onTogglePublic={vi.fn()} />);
      expect(screen.queryByText("Visible to societies")).toBeNull();
      expect(screen.queryByText("Hidden")).toBeNull();
    });

    it("calls onTogglePublic when switch is clicked", async () => {
      const user = userEvent.setup();
      const onTogglePublic = vi.fn();
      const plan = makePlan({ isActive: true, isPublic: true });
      render(<PlanCard plan={plan} onTogglePublic={onTogglePublic} />);

      const toggle = screen.getByRole("switch", { name: /toggle plan visibility/i });
      await user.click(toggle);
      expect(onTogglePublic).toHaveBeenCalledWith(plan);
    });

    it("disables toggle switch when isTogglingPublic is true", () => {
      render(
        <PlanCard
          plan={makePlan({ isActive: true, isPublic: true })}
          onTogglePublic={vi.fn()}
          isTogglingPublic={true}
        />,
      );
      const toggle = screen.getByRole("switch", { name: /toggle plan visibility/i });
      expect(toggle).toBeDisabled();
    });
  });

  describe("archive button", () => {
    it("shows archive button for active plans with onArchive", () => {
      const plan = makePlan({ isActive: true, activeSubscribers: 0 });
      render(<PlanCard plan={plan} onArchive={vi.fn()} />);
      expect(screen.getByTitle("Archive plan")).toBeInTheDocument();
    });

    it("calls onArchive when archive button is clicked (no active subscribers)", async () => {
      const user = userEvent.setup();
      const onArchive = vi.fn();
      const plan = makePlan({ isActive: true, activeSubscribers: 0 });
      render(<PlanCard plan={plan} onArchive={onArchive} />);
      await user.click(screen.getByTitle("Archive plan"));
      expect(onArchive).toHaveBeenCalledWith(plan);
    });

    it("disables archive button when plan has active subscribers", () => {
      const plan = makePlan({ isActive: true, activeSubscribers: 3 });
      render(<PlanCard plan={plan} onArchive={vi.fn()} />);
      const archiveBtn = screen.getByTitle("Cannot archive: active subscribers");
      expect(archiveBtn).toBeDisabled();
    });

    it("does not show archive button for archived plans", () => {
      render(<PlanCard plan={makePlan({ isActive: false })} onArchive={vi.fn()} />);
      expect(screen.queryByTitle("Archive plan")).toBeNull();
    });

    it("does not show archive button when onArchive is not provided", () => {
      render(<PlanCard plan={makePlan({ isActive: true })} />);
      expect(screen.queryByTitle("Archive plan")).toBeNull();
    });
  });

  describe("edit link", () => {
    it("renders an Edit link pointing to the plan detail page", () => {
      render(<PlanCard plan={makePlan()} />);
      const link = screen.getByRole("link");
      expect(link).toHaveAttribute("href", "/sa/plans/plan-1");
      expect(screen.getByText("Edit")).toBeInTheDocument();
    });
  });
});
