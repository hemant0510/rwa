import type { BillingCycle } from "./plan";

export type DiscountType = "PERCENTAGE" | "FLAT_AMOUNT";
export type DiscountTriggerType =
  | "COUPON_CODE"
  | "AUTO_TIME_LIMITED"
  | "PLAN_SPECIFIC"
  | "MANUAL_OVERRIDE";

export interface PlanDiscount {
  id: string;
  name: string;
  description: string | null;
  discountType: DiscountType;
  discountValue: number;
  appliesToAll: boolean;
  applicablePlanIds: string[];
  triggerType: DiscountTriggerType;
  couponCode: string | null;
  startsAt: string | null;
  endsAt: string | null;
  maxUsageCount: number | null;
  usageCount: number;
  allowedCycles: BillingCycle[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  usedCount?: number;
}

export const TRIGGER_TYPE_LABELS: Record<DiscountTriggerType, string> = {
  COUPON_CODE: "Coupon Code",
  AUTO_TIME_LIMITED: "Time-Limited (Auto)",
  PLAN_SPECIFIC: "Plan-Specific",
  MANUAL_OVERRIDE: "Manual Override",
};

export const TRIGGER_TYPE_DESCRIPTIONS: Record<DiscountTriggerType, string> = {
  COUPON_CODE: "Society enters a promo code to unlock the discount",
  AUTO_TIME_LIMITED: "Automatically applies to all eligible plans within a date range",
  PLAN_SPECIFIC: "Applies to specific plans automatically (no code needed)",
  MANUAL_OVERRIDE: "Super Admin manually applies to a specific society",
};
