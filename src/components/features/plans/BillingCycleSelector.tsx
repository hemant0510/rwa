"use client";

import { Badge } from "@/components/ui/badge";
import type { BillingCycle, PlatformPlan } from "@/types/plan";
import { BILLING_CYCLE_LABELS } from "@/types/plan";

interface BillingCycleSelectorProps {
  plan: PlatformPlan;
  selected: BillingCycle;
  onChange: (cycle: BillingCycle) => void;
  discountPct?: number; // optional applied discount %
}

function getSavingsLabel(plan: PlatformPlan, cycle: BillingCycle): string | null {
  if (cycle === "MONTHLY") return null;
  const monthly = plan.billingOptions.find((o) => o.billingCycle === "MONTHLY")?.price;
  const option = plan.billingOptions.find((o) => o.billingCycle === cycle);
  if (!monthly || !option) return null;

  const months = cycle === "ANNUAL" ? 12 : cycle === "TWO_YEAR" ? 24 : 36;
  const wouldPay = monthly * months;
  const savings = wouldPay - option.price;
  if (savings <= 0) return null;

  const savingMonths = Math.round((savings / monthly) * 10) / 10;
  return savingMonths >= 1 ? `${Math.floor(savingMonths)} months free` : null;
}

export function BillingCycleSelector({
  plan,
  selected,
  onChange,
  discountPct,
}: BillingCycleSelectorProps) {
  const activeOptions = plan.billingOptions.filter((o) => o.isActive);

  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      {activeOptions.map((option) => {
        const isSelected = selected === option.billingCycle;
        const savings = getSavingsLabel(plan, option.billingCycle);
        const effectivePrice = discountPct
          ? Math.round(option.price * (1 - discountPct / 100))
          : option.price;

        return (
          <button
            key={option.billingCycle}
            type="button"
            onClick={() => onChange(option.billingCycle)}
            className={`relative flex flex-col items-start rounded-lg border p-3 text-left transition-all ${
              isSelected
                ? "border-primary bg-primary/5 ring-primary/20 ring-2"
                : "border-border hover:border-primary/40"
            }`}
          >
            {savings && (
              <Badge
                variant="secondary"
                className="mb-1 bg-green-100 text-xs text-green-700 hover:bg-green-100"
              >
                {savings}
              </Badge>
            )}
            <span className="text-sm font-semibold">
              {BILLING_CYCLE_LABELS[option.billingCycle as BillingCycle]}
            </span>
            <span className={`text-lg font-bold ${discountPct ? "text-primary" : ""}`}>
              ₹{effectivePrice.toLocaleString("en-IN")}
            </span>
            {discountPct && (
              <span className="text-muted-foreground text-xs line-through">
                ₹{option.price.toLocaleString("en-IN")}
              </span>
            )}
            {plan.planType === "FLAT_FEE" && (
              <span className="text-muted-foreground text-xs">
                {option.billingCycle === "MONTHLY"
                  ? "/month"
                  : option.billingCycle === "ANNUAL"
                    ? "/year"
                    : option.billingCycle === "TWO_YEAR"
                      ? "for 2 years"
                      : "for 3 years"}
              </span>
            )}
            {plan.planType === "PER_UNIT" && (
              <span className="text-muted-foreground text-xs">/unit/month</span>
            )}
          </button>
        );
      })}
    </div>
  );
}
