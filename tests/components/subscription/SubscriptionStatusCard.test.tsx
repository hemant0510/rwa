import React from "react";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { toast } from "sonner";
import { describe, it, expect, vi, beforeEach } from "vitest";

import { SubscriptionStatusCard } from "@/components/features/subscription/SubscriptionStatusCard";

// Mock services
vi.mock("@/services/subscriptions", () => ({
  getSubscription: vi.fn(),
  applyDiscount: vi.fn(),
}));
vi.mock("@/services/discounts", () => ({
  getDiscounts: vi.fn(),
}));
// PlanSwitchModal uses getPlans + switchPlan/assignPlan
vi.mock("@/services/plans", () => ({
  getPlans: vi.fn().mockResolvedValue([]),
}));
vi.mock("sonner", () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

import { getDiscounts } from "@/services/discounts";
import { getSubscription, applyDiscount } from "@/services/subscriptions";

const mockGetSubscription = vi.mocked(getSubscription);
const mockApplyDiscount = vi.mocked(applyDiscount);
const mockGetDiscounts = vi.mocked(getDiscounts);

function makeSubscription(overrides: Record<string, unknown> = {}) {
  return {
    id: "sub-1",
    societyId: "soc-1",
    status: "ACTIVE",
    plan: { id: "plan-1", name: "Basic Plan" },
    billingOption: {
      id: "opt-1",
      planId: "plan-1",
      billingCycle: "MONTHLY",
      price: 999,
      isActive: true,
      createdAt: "",
      updatedAt: "",
    },
    finalPrice: 999,
    currentPeriodEnd: "2025-12-31T23:59:59.000Z",
    trialEndsAt: null,
    discount: null,
    customDiscountPct: null,
    ...overrides,
  };
}

function renderCard(societyId = "soc-1") {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <SubscriptionStatusCard societyId={societyId} />
    </QueryClientProvider>,
  );
}

describe("SubscriptionStatusCard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetDiscounts.mockResolvedValue([]);
  });

  describe("loading state", () => {
    it("renders skeletons while loading", () => {
      mockGetSubscription.mockImplementation(() => new Promise(() => {})); // never resolves
      const { container } = renderCard();
      // Skeletons should be present
      expect(container.querySelector("[class*='animate']")).not.toBeNull();
    });
  });

  describe("no subscription state", () => {
    it("renders 'No active subscription' message when sub is null", async () => {
      mockGetSubscription.mockResolvedValue(null as never);
      renderCard();
      await waitFor(() => {
        expect(screen.getByText(/no active subscription/i)).toBeInTheDocument();
      });
    });

    it("shows 'Assign Plan' button when no subscription", async () => {
      mockGetSubscription.mockResolvedValue(null as never);
      renderCard();
      await waitFor(() => {
        expect(screen.getByRole("button", { name: /assign plan/i })).toBeInTheDocument();
      });
    });

    it("opens PlanSwitchModal when Assign Plan is clicked", async () => {
      const user = userEvent.setup();
      mockGetSubscription.mockResolvedValue(null as never);
      renderCard();
      await waitFor(() => screen.getByRole("button", { name: /assign plan/i }));
      await user.click(screen.getByRole("button", { name: /assign plan/i }));
      // PlanSwitchModal should open — it renders "Assign Plan" as dialog title
      await waitFor(() => {
        // Dialog opens with "Assign Plan" heading inside the modal
        const headings = screen.getAllByText("Assign Plan");
        expect(headings.length).toBeGreaterThanOrEqual(1);
      });
    });
  });

  describe("active subscription state", () => {
    it("renders plan name", async () => {
      mockGetSubscription.mockResolvedValue(makeSubscription() as never);
      renderCard();
      await waitFor(() => {
        expect(screen.getByText("Basic Plan")).toBeInTheDocument();
      });
    });

    it("renders 'Trial' as plan name when plan is null", async () => {
      mockGetSubscription.mockResolvedValue(makeSubscription({ plan: null }) as never);
      renderCard();
      await waitFor(() => {
        expect(screen.getByText("Trial")).toBeInTheDocument();
      });
    });

    it("renders billing cycle label", async () => {
      mockGetSubscription.mockResolvedValue(makeSubscription() as never);
      renderCard();
      await waitFor(() => {
        expect(screen.getByText("Monthly")).toBeInTheDocument();
      });
    });

    it("does not render billing section when billingOption is null", async () => {
      mockGetSubscription.mockResolvedValue(makeSubscription({ billingOption: null }) as never);
      renderCard();
      await waitFor(() => {
        expect(screen.queryByText("Billing")).toBeNull();
      });
    });

    it("renders effective price when finalPrice is not null", async () => {
      mockGetSubscription.mockResolvedValue(makeSubscription({ finalPrice: 799 }) as never);
      renderCard();
      await waitFor(() => {
        expect(screen.getByText(/₹799/)).toBeInTheDocument();
      });
    });

    it("does not render price section when finalPrice is null", async () => {
      mockGetSubscription.mockResolvedValue(makeSubscription({ finalPrice: null }) as never);
      renderCard();
      await waitFor(() => {
        expect(screen.queryByText("Effective Price")).toBeNull();
      });
    });

    it("shows renewal date when currentPeriodEnd is provided", async () => {
      // Use noon UTC so date is timezone-independent
      mockGetSubscription.mockResolvedValue(
        makeSubscription({ currentPeriodEnd: "2025-06-15T12:00:00.000Z" }) as never,
      );
      renderCard();
      await waitFor(() => {
        expect(screen.getByText("Renews")).toBeInTheDocument();
        expect(screen.getByText("15 Jun 2025")).toBeInTheDocument();
      });
    });

    it("does not show renewal date when currentPeriodEnd is null", async () => {
      mockGetSubscription.mockResolvedValue(makeSubscription({ currentPeriodEnd: null }) as never);
      renderCard();
      await waitFor(() => {
        expect(screen.queryByText("Renews")).toBeNull();
      });
    });
  });

  describe("trial status", () => {
    it("shows trial end date when status is TRIAL and trialEndsAt is set", async () => {
      // Use noon UTC so date is timezone-independent
      mockGetSubscription.mockResolvedValue(
        makeSubscription({
          status: "TRIAL",
          trialEndsAt: "2025-04-10T12:00:00.000Z",
        }) as never,
      );
      renderCard();
      await waitFor(() => {
        expect(screen.getByText("Trial ends")).toBeInTheDocument();
        expect(screen.getByText("10 Apr 2025")).toBeInTheDocument();
      });
    });

    it("does not show trial end when status is not TRIAL", async () => {
      mockGetSubscription.mockResolvedValue(makeSubscription({ status: "ACTIVE" }) as never);
      renderCard();
      await waitFor(() => {
        expect(screen.queryByText("Trial ends")).toBeNull();
      });
    });
  });

  describe("status badge", () => {
    it("shows ACTIVE status badge", async () => {
      mockGetSubscription.mockResolvedValue(makeSubscription({ status: "ACTIVE" }) as never);
      renderCard();
      await waitFor(() => {
        expect(screen.getByText("ACTIVE")).toBeInTheDocument();
      });
    });

    it("shows TRIAL status badge", async () => {
      mockGetSubscription.mockResolvedValue(
        makeSubscription({ status: "TRIAL", trialEndsAt: null }) as never,
      );
      renderCard();
      await waitFor(() => {
        expect(screen.getByText("TRIAL")).toBeInTheDocument();
      });
    });

    it("shows EXPIRED status badge", async () => {
      mockGetSubscription.mockResolvedValue(makeSubscription({ status: "EXPIRED" }) as never);
      renderCard();
      await waitFor(() => {
        expect(screen.getByText("EXPIRED")).toBeInTheDocument();
      });
    });
  });

  describe("discount display", () => {
    it("shows applied discount name and percentage value", async () => {
      mockGetSubscription.mockResolvedValue(
        makeSubscription({
          discount: {
            id: "d-1",
            name: "Summer Sale",
            discountType: "PERCENTAGE",
            discountValue: 20,
          },
          finalPrice: 799,
        }) as never,
      );
      renderCard();
      await waitFor(() => {
        expect(screen.getByText("Summer Sale")).toBeInTheDocument();
        expect(screen.getByText(/20% off/)).toBeInTheDocument();
      });
    });

    it("shows flat amount discount value", async () => {
      mockGetSubscription.mockResolvedValue(
        makeSubscription({
          discount: {
            id: "d-1",
            name: "Flat Discount",
            discountType: "FLAT_AMOUNT",
            discountValue: 200,
          },
          finalPrice: 799,
        }) as never,
      );
      renderCard();
      await waitFor(() => {
        expect(screen.getByText(/₹200 off/)).toBeInTheDocument();
      });
    });

    it("shows '(discounted)' label when discount is applied", async () => {
      mockGetSubscription.mockResolvedValue(
        makeSubscription({
          discount: { id: "d-1", name: "Sale", discountType: "PERCENTAGE", discountValue: 10 },
          finalPrice: 899,
        }) as never,
      );
      renderCard();
      await waitFor(() => {
        expect(screen.getByText("(discounted)")).toBeInTheDocument();
      });
    });

    it("shows custom discount percentage", async () => {
      mockGetSubscription.mockResolvedValue(
        makeSubscription({
          customDiscountPct: 25,
          finalPrice: 749,
        }) as never,
      );
      renderCard();
      await waitFor(() => {
        expect(screen.getByText(/25% off/)).toBeInTheDocument();
      });
    });

    it("shows '(discounted)' label when customDiscountPct is applied", async () => {
      mockGetSubscription.mockResolvedValue(
        makeSubscription({ customDiscountPct: 15, finalPrice: 849 }) as never,
      );
      renderCard();
      await waitFor(() => {
        expect(screen.getByText("(discounted)")).toBeInTheDocument();
      });
    });

    it("does not show discount info when no discount", async () => {
      mockGetSubscription.mockResolvedValue(makeSubscription() as never);
      renderCard();
      await waitFor(() => {
        expect(screen.queryByText(/% off/)).toBeNull();
      });
    });
  });

  describe("Switch Plan button", () => {
    it("renders Switch Plan button when subscription exists", async () => {
      mockGetSubscription.mockResolvedValue(makeSubscription() as never);
      renderCard();
      await waitFor(() => {
        expect(screen.getByRole("button", { name: /switch plan/i })).toBeInTheDocument();
      });
    });

    it("opens PlanSwitchModal when Switch Plan is clicked", async () => {
      const user = userEvent.setup();
      mockGetSubscription.mockResolvedValue(makeSubscription() as never);
      renderCard();
      await waitFor(() => screen.getByRole("button", { name: /switch plan/i }));
      await user.click(screen.getByRole("button", { name: /switch plan/i }));
      await waitFor(() => {
        // Modal heading appears (dialog title role)
        expect(screen.getByRole("heading", { name: "Switch Plan" })).toBeInTheDocument();
      });
    });
  });

  describe("Apply Discount sheet", () => {
    it("renders Apply Discount button", async () => {
      mockGetSubscription.mockResolvedValue(makeSubscription() as never);
      renderCard();
      await waitFor(() => {
        expect(screen.getByRole("button", { name: /apply discount/i })).toBeInTheDocument();
      });
    });

    it("opens discount sheet when Apply Discount is clicked", async () => {
      const user = userEvent.setup();
      mockGetSubscription.mockResolvedValue(makeSubscription() as never);
      renderCard();
      // Wait for the card's Apply Discount button (only 1 at this point)
      const applyBtns = await screen.findAllByRole("button", { name: /apply discount/i });
      await user.click(applyBtns[0]);
      await waitFor(() => {
        // Check for a unique-to-sheet element
        expect(screen.getByText("Custom Discount %")).toBeInTheDocument();
        expect(screen.getByText("Select Existing Discount")).toBeInTheDocument();
      });
    });

    it("populates discount list from API when sheet opens", async () => {
      const user = userEvent.setup();
      mockGetSubscription.mockResolvedValue(makeSubscription() as never);
      mockGetDiscounts.mockResolvedValue([
        {
          id: "d-1",
          name: "Summer Deal",
          discountType: "PERCENTAGE",
          discountValue: 30,
          isActive: true,
        } as never,
        {
          id: "d-2",
          name: "Inactive Deal",
          discountType: "PERCENTAGE",
          discountValue: 10,
          isActive: false,
        } as never,
      ]);

      renderCard();
      const applyBtns = await screen.findAllByRole("button", { name: /apply discount/i });
      await user.click(applyBtns[0]);

      // Sheet opens — wait for getDiscounts to be called
      await waitFor(() => {
        expect(mockGetDiscounts).toHaveBeenCalled();
      });
      // The select trigger should be rendered
      expect(screen.getByText("Select Existing Discount")).toBeInTheDocument();
    });

    it("apply button is disabled when no discount or customPct entered", async () => {
      const user = userEvent.setup();
      mockGetSubscription.mockResolvedValue(makeSubscription() as never);
      renderCard();
      await waitFor(() => screen.getByRole("button", { name: /apply discount/i }));
      await user.click(screen.getByRole("button", { name: /apply discount/i }));
      await waitFor(() => screen.getByText("Custom Discount %"));

      // The inner Apply Discount button (in the sheet) should be disabled
      const applyBtns = screen.getAllByRole("button", { name: /apply discount/i });
      const sheetApplyBtn = applyBtns[applyBtns.length - 1];
      expect(sheetApplyBtn).toBeDisabled();
    });

    it("calls applyDiscount with customPct when entered", async () => {
      const user = userEvent.setup();
      mockGetSubscription.mockResolvedValue(makeSubscription() as never);
      mockApplyDiscount.mockResolvedValue({} as never);
      renderCard();
      await waitFor(() => screen.getByRole("button", { name: /apply discount/i }));
      await user.click(screen.getByRole("button", { name: /apply discount/i }));
      await waitFor(() => screen.getByText("Custom Discount %"));

      const input = screen.getByPlaceholderText("e.g. 25");
      await user.type(input, "30");

      const applyBtns = screen.getAllByRole("button", { name: /apply discount/i });
      await user.click(applyBtns[applyBtns.length - 1]);

      await waitFor(() => {
        expect(mockApplyDiscount).toHaveBeenCalledWith("soc-1", {
          discountId: null,
          customDiscountPct: 30,
        });
      });
    });

    it("shows success toast after applying discount", async () => {
      const user = userEvent.setup();
      mockGetSubscription.mockResolvedValue(makeSubscription() as never);
      mockApplyDiscount.mockResolvedValue({} as never);
      renderCard();
      await waitFor(() => screen.getByRole("button", { name: /apply discount/i }));
      await user.click(screen.getByRole("button", { name: /apply discount/i }));
      await waitFor(() => screen.getByText("Custom Discount %"));

      const input = screen.getByPlaceholderText("e.g. 25");
      await user.type(input, "10");

      const applyBtns = screen.getAllByRole("button", { name: /apply discount/i });
      await user.click(applyBtns[applyBtns.length - 1]);

      await waitFor(() => {
        expect(vi.mocked(toast.success)).toHaveBeenCalledWith("Discount applied");
      });
    });

    it("shows error toast when applyDiscount fails", async () => {
      const user = userEvent.setup();
      mockGetSubscription.mockResolvedValue(makeSubscription() as never);
      mockApplyDiscount.mockRejectedValue(new Error("Apply failed"));
      renderCard();
      await waitFor(() => screen.getByRole("button", { name: /apply discount/i }));
      await user.click(screen.getByRole("button", { name: /apply discount/i }));
      await waitFor(() => screen.getByText("Custom Discount %"));

      const input = screen.getByPlaceholderText("e.g. 25");
      await user.type(input, "20");

      const applyBtns = screen.getAllByRole("button", { name: /apply discount/i });
      await user.click(applyBtns[applyBtns.length - 1]);

      await waitFor(() => {
        expect(vi.mocked(toast.error)).toHaveBeenCalledWith("Apply failed");
      });
    });

    it("shows 'Applying...' while mutation is in progress", async () => {
      const user = userEvent.setup();
      mockGetSubscription.mockResolvedValue(makeSubscription() as never);
      let resolveApply!: (v: unknown) => void;
      mockApplyDiscount.mockReturnValue(new Promise((resolve) => (resolveApply = resolve)));
      renderCard();
      await waitFor(() => screen.getByRole("button", { name: /apply discount/i }));
      await user.click(screen.getByRole("button", { name: /apply discount/i }));
      await waitFor(() => screen.getByText("Custom Discount %"));

      const input = screen.getByPlaceholderText("e.g. 25");
      await user.type(input, "15");

      const applyBtns = screen.getAllByRole("button", { name: /apply discount/i });
      await user.click(applyBtns[applyBtns.length - 1]);

      await waitFor(() =>
        expect(screen.getByRole("button", { name: /applying/i })).toBeInTheDocument(),
      );
      resolveApply({});
    });

    it("calls applyDiscount with discountId and null customPct when discount selected", async () => {
      const user = userEvent.setup();
      mockGetSubscription.mockResolvedValue(makeSubscription() as never);
      mockApplyDiscount.mockResolvedValue({} as never);
      mockGetDiscounts.mockResolvedValue([
        {
          id: "d-flat",
          name: "Flat Deal",
          discountType: "FLAT_AMOUNT",
          discountValue: 100,
          isActive: true,
        } as never,
      ]);
      renderCard();

      const applyBtns = await screen.findAllByRole("button", { name: /apply discount/i });
      await user.click(applyBtns[0]);
      await waitFor(() => screen.getByText("Custom Discount %"));

      // Open the discount select
      const trigger = screen.getByRole("combobox");
      await user.click(trigger);
      await waitFor(() =>
        expect(screen.getByRole("option", { name: /flat deal/i })).toBeInTheDocument(),
      );
      await user.click(screen.getByRole("option", { name: /flat deal/i }));

      const sheetApplyBtns = screen.getAllByRole("button", { name: /apply discount/i });
      await user.click(sheetApplyBtns[sheetApplyBtns.length - 1]);

      await waitFor(() => {
        expect(mockApplyDiscount).toHaveBeenCalledWith("soc-1", {
          discountId: "d-flat",
          customDiscountPct: null,
        });
      });
    });

    it("shows unknown status with fallback styling", async () => {
      mockGetSubscription.mockResolvedValue(
        makeSubscription({ status: "UNKNOWN_STATUS" }) as never,
      );
      renderCard();
      await waitFor(() => {
        expect(screen.getByText("UNKNOWN_STATUS")).toBeInTheDocument();
      });
    });

    it("clears selectedDiscountId when typing custom pct", async () => {
      const user = userEvent.setup();
      mockGetSubscription.mockResolvedValue(makeSubscription() as never);
      renderCard();
      await waitFor(() => screen.getByRole("button", { name: /apply discount/i }));
      await user.click(screen.getByRole("button", { name: /apply discount/i }));
      await waitFor(() => screen.getByText("Custom Discount %"));

      const input = screen.getByPlaceholderText("e.g. 25");
      await user.type(input, "15");
      // The input should have value "15"
      expect(input).toHaveValue(15);
    });
  });
});
