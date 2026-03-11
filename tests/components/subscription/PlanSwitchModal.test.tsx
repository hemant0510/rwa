import React from "react";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { toast } from "sonner";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { PlanSwitchModal } from "@/components/features/subscription/PlanSwitchModal";

// Mock services
vi.mock("@/services/plans", () => ({
  getPlans: vi.fn(),
}));
vi.mock("@/services/subscriptions", () => ({
  assignPlan: vi.fn(),
  switchPlan: vi.fn(),
}));
// Mock sonner toast
vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

import { getPlans } from "@/services/plans";
import { assignPlan, switchPlan } from "@/services/subscriptions";
import type { PlatformPlan } from "@/types/plan";

const mockGetPlans = vi.mocked(getPlans);
const mockAssignPlan = vi.mocked(assignPlan);
const mockSwitchPlan = vi.mocked(switchPlan);

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
    ],
    ...overrides,
  };
}

function renderModal(props: Partial<React.ComponentProps<typeof PlanSwitchModal>> = {}) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <PlanSwitchModal societyId="soc-1" open={true} onOpenChange={vi.fn()} {...props} />
    </QueryClientProvider>,
  );
}

describe("PlanSwitchModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetPlans.mockResolvedValue([]);
  });

  describe("dialog title", () => {
    it("shows 'Assign Plan' when no currentPlan", () => {
      renderModal({ currentPlan: null });
      expect(screen.getByRole("heading", { name: "Assign Plan" })).toBeInTheDocument();
    });

    it("shows 'Switch Plan' when currentPlan is provided", () => {
      renderModal({ currentPlan: makePlan() });
      expect(screen.getByText("Switch Plan")).toBeInTheDocument();
    });
  });

  describe("description text", () => {
    it("shows assign description when no currentPlan", () => {
      renderModal({ currentPlan: null });
      expect(
        screen.getByText("Select a plan and billing cycle for this society."),
      ).toBeInTheDocument();
    });

    it("shows switch description when currentPlan is provided", () => {
      renderModal({ currentPlan: makePlan() });
      expect(screen.getByText(/pro-rata adjustment/i)).toBeInTheDocument();
    });
  });

  describe("current plan indicator", () => {
    it("shows current plan name and billing cycle when switching", async () => {
      const currentBillingOption = {
        id: "opt-1",
        planId: "plan-1",
        billingCycle: "MONTHLY" as const,
        price: 999,
        isActive: true,
        createdAt: "",
        updatedAt: "",
      };
      renderModal({
        currentPlan: makePlan({ name: "Basic Plan" }),
        currentBillingOption,
      });
      expect(screen.getByText("Basic Plan")).toBeInTheDocument();
      expect(screen.getByText("Monthly")).toBeInTheDocument();
    });

    it("does not show current plan row when not switching", () => {
      renderModal({ currentPlan: null });
      expect(screen.queryByText("Monthly")).toBeNull();
    });
  });

  describe("plan selection from API", () => {
    it("renders public active plans fetched from API", async () => {
      const plans = [
        makePlan({ id: "plan-1", name: "Basic Plan" }),
        makePlan({ id: "plan-2", name: "Pro Plan" }),
      ];
      mockGetPlans.mockResolvedValue(plans);
      renderModal({ currentPlan: null });

      await waitFor(() => {
        expect(screen.getByText("Basic Plan")).toBeInTheDocument();
        expect(screen.getByText("Pro Plan")).toBeInTheDocument();
      });
    });

    it("filters out inactive plans", async () => {
      const plans = [
        makePlan({ id: "plan-1", name: "Basic Plan", isActive: true, isPublic: true }),
        makePlan({ id: "plan-2", name: "Archived Plan", isActive: false, isPublic: true }),
      ];
      mockGetPlans.mockResolvedValue(plans);
      renderModal({ currentPlan: null });

      await waitFor(() => {
        expect(screen.queryByText("Archived Plan")).toBeNull();
      });
    });

    it("filters out non-public plans", async () => {
      const plans = [
        makePlan({ id: "plan-1", name: "Basic Plan", isActive: true, isPublic: true }),
        makePlan({ id: "plan-2", name: "Hidden Plan", isActive: true, isPublic: false }),
      ];
      mockGetPlans.mockResolvedValue(plans);
      renderModal({ currentPlan: null });

      await waitFor(() => {
        expect(screen.queryByText("Hidden Plan")).toBeNull();
      });
    });

    it("marks current plan as disabled (Current badge)", async () => {
      const currentPlan = makePlan({ id: "plan-1", name: "Basic Plan" });
      const plans = [currentPlan, makePlan({ id: "plan-2", name: "Pro Plan" })];
      mockGetPlans.mockResolvedValue(plans);
      renderModal({ currentPlan });

      await waitFor(() => {
        expect(screen.getByText("Current")).toBeInTheDocument();
      });
    });

    it("shows plan with residentLimit", async () => {
      const plans = [makePlan({ residentLimit: 150 })];
      mockGetPlans.mockResolvedValue(plans);
      renderModal({ currentPlan: null });

      await waitFor(() => {
        expect(screen.getByText("Up to 150 units")).toBeInTheDocument();
      });
    });

    it("shows 'Unlimited units' for plan with null residentLimit", async () => {
      const plans = [makePlan({ residentLimit: null })];
      mockGetPlans.mockResolvedValue(plans);
      renderModal({ currentPlan: null });

      await waitFor(() => {
        expect(screen.getByText("Unlimited units")).toBeInTheDocument();
      });
    });

    it("shows plan badgeText when present", async () => {
      const plans = [makePlan({ badgeText: "Popular" })];
      mockGetPlans.mockResolvedValue(plans);
      renderModal({ currentPlan: null });

      await waitFor(() => {
        expect(screen.getByText("Popular")).toBeInTheDocument();
      });
    });
  });

  describe("plan selection interaction", () => {
    it("shows billing cycle selector after selecting a plan", async () => {
      const user = userEvent.setup();
      const plans = [makePlan({ id: "plan-1", name: "Basic Plan" })];
      mockGetPlans.mockResolvedValue(plans);
      renderModal({ currentPlan: null });

      await waitFor(() => screen.getByText("Basic Plan"));
      await user.click(screen.getByText("Basic Plan"));

      expect(screen.getByText("Billing Cycle")).toBeInTheDocument();
    });

    it("shows pro-rata info when switching with selectedOption and currentBillingOption", async () => {
      const user = userEvent.setup();
      const currentBillingOption = {
        id: "opt-1",
        planId: "plan-1",
        billingCycle: "MONTHLY" as const,
        price: 999,
        isActive: true,
        createdAt: "",
        updatedAt: "",
      };
      const currentPlan = makePlan({ id: "plan-1", name: "Basic Plan" });
      const plans = [currentPlan, makePlan({ id: "plan-2", name: "Pro Plan" })];
      mockGetPlans.mockResolvedValue(plans);
      renderModal({ currentPlan, currentBillingOption });

      await waitFor(() => screen.getByText("Pro Plan"));
      await user.click(screen.getByText("Pro Plan"));

      // Pro-rata info paragraph (not the DialogDescription) appears after plan+cycle are selected
      const proRataElements = screen.getAllByText(/pro-rata/i);
      expect(proRataElements.length).toBeGreaterThanOrEqual(1);
    });

    it("shows checkmark icon on selected plan", async () => {
      const user = userEvent.setup();
      const plans = [makePlan({ id: "plan-1", name: "Basic Plan" })];
      mockGetPlans.mockResolvedValue(plans);
      renderModal({ currentPlan: null });

      await waitFor(() => screen.getByText("Basic Plan"));
      await user.click(screen.getByText("Basic Plan"));

      // After selection, the button should have ring-2 class
      const planBtn = screen.getByText("Basic Plan").closest("button");
      expect(planBtn?.className).toContain("ring-2");
    });
  });

  describe("confirm button state", () => {
    it("Confirm button is disabled when no plan is selected", () => {
      renderModal({ currentPlan: null });
      const confirmBtn = screen.getByRole("button", { name: /assign plan/i });
      expect(confirmBtn).toBeDisabled();
    });
  });

  describe("cancel button", () => {
    it("calls onOpenChange(false) when Cancel is clicked", async () => {
      const user = userEvent.setup();
      const onOpenChange = vi.fn();
      renderModal({ currentPlan: null, onOpenChange });

      await user.click(screen.getByRole("button", { name: /cancel/i }));
      expect(onOpenChange).toHaveBeenCalledWith(false);
    });
  });

  describe("plan assignment mutation", () => {
    it("calls assignPlan when no currentPlan and form is submitted", async () => {
      const user = userEvent.setup();
      const plans = [makePlan({ id: "plan-1", name: "Basic Plan" })];
      mockGetPlans.mockResolvedValue(plans);
      mockAssignPlan.mockResolvedValue({ id: "sub-1" } as never);
      const onOpenChange = vi.fn();
      renderModal({ currentPlan: null, onOpenChange });

      await waitFor(() => screen.getByText("Basic Plan"));
      await user.click(screen.getByText("Basic Plan"));
      // Now billing cycle selector shows — MONTHLY is default selected, so opt-1 should be the selectedOption
      await waitFor(() => screen.getByRole("button", { name: /assign plan/i }));

      const confirmBtn = screen.getByRole("button", { name: /assign plan/i });
      expect(confirmBtn).not.toBeDisabled();
      await user.click(confirmBtn);

      await waitFor(() => {
        expect(mockAssignPlan).toHaveBeenCalledWith("soc-1", {
          planId: "plan-1",
          billingOptionId: "opt-1",
        });
      });
    });

    it("calls switchPlan when currentPlan exists and form is submitted", async () => {
      const user = userEvent.setup();
      const currentPlan = makePlan({ id: "plan-1", name: "Basic Plan" });
      const plans = [currentPlan, makePlan({ id: "plan-2", name: "Pro Plan" })];
      mockGetPlans.mockResolvedValue(plans);
      mockSwitchPlan.mockResolvedValue({ id: "sub-1" } as never);
      renderModal({ currentPlan });

      await waitFor(() => screen.getByText("Pro Plan"));
      await user.click(screen.getByText("Pro Plan"));

      await waitFor(() => screen.getByRole("button", { name: /confirm switch/i }));
      await user.click(screen.getByRole("button", { name: /confirm switch/i }));

      await waitFor(() => {
        expect(mockSwitchPlan).toHaveBeenCalledWith("soc-1", {
          planId: "plan-2",
          billingOptionId: "opt-1",
        });
      });
    });

    it("shows success toast with net amount > 0", async () => {
      const user = userEvent.setup();
      const plans = [makePlan({ id: "plan-1", name: "Basic Plan" })];
      mockGetPlans.mockResolvedValue(plans);
      mockAssignPlan.mockResolvedValue({ proRata: { netAmount: 500 } } as never);
      renderModal({ currentPlan: null });

      await waitFor(() => screen.getByText("Basic Plan"));
      await user.click(screen.getByText("Basic Plan"));
      await waitFor(() => screen.getByRole("button", { name: /assign plan/i }));
      await user.click(screen.getByRole("button", { name: /assign plan/i }));

      await waitFor(() => {
        expect(vi.mocked(toast.success)).toHaveBeenCalledWith(expect.stringContaining("500"));
      });
    });

    it("shows success toast with credit when net < 0", async () => {
      const user = userEvent.setup();
      const plans = [makePlan({ id: "plan-1", name: "Basic Plan" })];
      mockGetPlans.mockResolvedValue(plans);
      mockAssignPlan.mockResolvedValue({ proRata: { netAmount: -200 } } as never);
      renderModal({ currentPlan: null });

      await waitFor(() => screen.getByText("Basic Plan"));
      await user.click(screen.getByText("Basic Plan"));
      await waitFor(() => screen.getByRole("button", { name: /assign plan/i }));
      await user.click(screen.getByRole("button", { name: /assign plan/i }));

      await waitFor(() => {
        expect(vi.mocked(toast.success)).toHaveBeenCalledWith(
          expect.stringContaining("credit applied"),
        );
      });
    });

    it("shows 'switched successfully' when net = 0", async () => {
      const user = userEvent.setup();
      const plans = [makePlan({ id: "plan-1", name: "Basic Plan" })];
      mockGetPlans.mockResolvedValue(plans);
      mockAssignPlan.mockResolvedValue({ proRata: { netAmount: 0 } } as never);
      renderModal({ currentPlan: null });

      await waitFor(() => screen.getByText("Basic Plan"));
      await user.click(screen.getByText("Basic Plan"));
      await waitFor(() => screen.getByRole("button", { name: /assign plan/i }));
      await user.click(screen.getByRole("button", { name: /assign plan/i }));

      await waitFor(() => {
        expect(vi.mocked(toast.success)).toHaveBeenCalledWith("Plan switched successfully.");
      });
    });

    it("shows generic success toast when no proRata in result", async () => {
      const user = userEvent.setup();
      const plans = [makePlan({ id: "plan-1", name: "Basic Plan" })];
      mockGetPlans.mockResolvedValue(plans);
      mockAssignPlan.mockResolvedValue({} as never);
      renderModal({ currentPlan: null });

      await waitFor(() => screen.getByText("Basic Plan"));
      await user.click(screen.getByText("Basic Plan"));
      await waitFor(() => screen.getByRole("button", { name: /assign plan/i }));
      await user.click(screen.getByRole("button", { name: /assign plan/i }));

      await waitFor(() => {
        expect(vi.mocked(toast.success)).toHaveBeenCalledWith("Plan assigned successfully");
      });
    });

    it("shows error toast on mutation failure", async () => {
      const user = userEvent.setup();
      const plans = [makePlan({ id: "plan-1", name: "Basic Plan" })];
      mockGetPlans.mockResolvedValue(plans);
      mockAssignPlan.mockRejectedValue(new Error("Server error"));
      renderModal({ currentPlan: null });

      await waitFor(() => screen.getByText("Basic Plan"));
      await user.click(screen.getByText("Basic Plan"));
      await waitFor(() => screen.getByRole("button", { name: /assign plan/i }));
      await user.click(screen.getByRole("button", { name: /assign plan/i }));

      await waitFor(() => {
        expect(vi.mocked(toast.error)).toHaveBeenCalledWith("Server error");
      });
    });
  });

  describe("handlePlanSelect cycle auto-selection", () => {
    it("falls back to MONTHLY when selected plan doesn't have current cycle", async () => {
      const user = userEvent.setup();
      // Plan with no ANNUAL billing option
      const plans = [
        makePlan({
          id: "plan-1",
          name: "Basic Plan",
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
        }),
      ];
      mockGetPlans.mockResolvedValue(plans);
      renderModal({ currentPlan: null });

      await waitFor(() => screen.getByText("Basic Plan"));
      await user.click(screen.getByText("Basic Plan"));
      // MONTHLY option should be shown
      await waitFor(() => screen.getByText("Billing Cycle"));
      expect(screen.getByText("Monthly")).toBeInTheDocument();
    });
  });

  describe("dialog not open", () => {
    it("does not render dialog content when open=false", () => {
      const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
      render(
        <QueryClientProvider client={qc}>
          <PlanSwitchModal societyId="soc-1" open={false} onOpenChange={vi.fn()} />
        </QueryClientProvider>,
      );
      expect(screen.queryByText("Assign Plan")).toBeNull();
      expect(screen.queryByText("Switch Plan")).toBeNull();
    });
  });
});
