"use client";

import { useState } from "react";

import Link from "next/link";

import { Check, Star } from "lucide-react";

import { PricingCycleToggle } from "@/components/features/marketing/pricing/PricingCycleToggle";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { BillingCycle, PublicPlan } from "@/types/public-plan";

interface Props {
  plans: PublicPlan[];
}

const CYCLE_SUFFIX: Record<BillingCycle, string> = {
  MONTHLY: "/mo",
  ANNUAL: "/yr",
  TWO_YEAR: "/2yr",
  THREE_YEAR: "/3yr",
};

const CYCLE_HUMAN: Record<BillingCycle, string> = {
  MONTHLY: "monthly",
  ANNUAL: "annual",
  TWO_YEAR: "two-year",
  THREE_YEAR: "three-year",
};

function formatINR(n: number) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0,
  }).format(n);
}

function getPriceForCycle(plan: PublicPlan, cycle: BillingCycle): number | null {
  if (plan.planType === "PER_UNIT") {
    return plan.pricePerUnit;
  }
  const opt = plan.billingOptions.find((o) => o.billingCycle === cycle);
  return opt ? opt.price : null;
}

function getMonthlySavings(plan: PublicPlan, cycle: BillingCycle): number | null {
  if (cycle === "MONTHLY" || plan.planType !== "FLAT_FEE") return null;
  const monthly = plan.billingOptions.find((o) => o.billingCycle === "MONTHLY");
  const target = plan.billingOptions.find((o) => o.billingCycle === cycle);
  if (!monthly || !target) return null;
  const monthsMap: Record<BillingCycle, number> = {
    MONTHLY: 1,
    ANNUAL: 12,
    TWO_YEAR: 24,
    THREE_YEAR: 36,
  };
  const months = monthsMap[cycle];
  const expected = monthly.price * months;
  const savings = expected - target.price;
  return savings > 0 ? savings : null;
}

export function PricingGrid({ plans }: Props) {
  const [cycle, setCycle] = useState<BillingCycle>("ANNUAL");

  if (plans.length === 0) {
    return (
      <div className="bg-muted/40 mx-auto max-w-md rounded-2xl border p-10 text-center">
        <p className="text-foreground font-medium">Plans aren&apos;t loading right now.</p>
        <p className="text-muted-foreground mt-2 text-sm">
          Please refresh, or{" "}
          <Link href="/contact" className="text-primary underline">
            contact us
          </Link>{" "}
          for pricing details.
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-10 flex justify-center">
        <PricingCycleToggle value={cycle} onChange={setCycle} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3 xl:grid-cols-3">
        {plans.map((plan) => {
          const price = getPriceForCycle(plan, cycle);
          const savings = getMonthlySavings(plan, cycle);
          const isHighlighted = plan.badgeText?.toLowerCase().includes("popular");
          const enabledFeatures = Object.entries(plan.featuresJson ?? {})
            .filter(([, on]) => on)
            .slice(0, 6);

          return (
            <div
              key={plan.id}
              className={cn(
                "bg-card relative flex flex-col rounded-2xl border p-7 transition-all",
                isHighlighted
                  ? "border-primary shadow-primary/10 shadow-xl lg:scale-[1.03]"
                  : "hover:border-primary/40 hover:shadow-md",
              )}
            >
              {plan.badgeText ? (
                <div className="from-primary to-chart-2 text-primary-foreground absolute -top-3 left-1/2 inline-flex -translate-x-1/2 items-center gap-1 rounded-full bg-gradient-to-r px-3 py-1 text-xs font-semibold">
                  <Star className="h-3 w-3" />
                  {plan.badgeText}
                </div>
              ) : null}

              <h3 className="text-foreground text-xl font-bold">{plan.name}</h3>
              {plan.description ? (
                <p className="text-muted-foreground mt-1 text-sm">{plan.description}</p>
              ) : null}

              <div className="mt-6 flex items-baseline gap-1">
                <span className="text-foreground text-4xl font-bold">
                  {plan.planType === "PER_UNIT" && plan.pricePerUnit
                    ? `₹${plan.pricePerUnit}`
                    : price !== null
                      ? formatINR(price)
                      : "—"}
                </span>
                <span className="text-muted-foreground text-sm">
                  {plan.planType === "PER_UNIT" ? "/unit/mo" : CYCLE_SUFFIX[cycle]}
                </span>
              </div>

              <p className="text-muted-foreground mt-1 text-xs">
                {plan.residentLimit ? `Up to ${plan.residentLimit} units` : "Unlimited units"}
                {plan.planType === "PER_UNIT"
                  ? " — billed monthly"
                  : ` ${CYCLE_HUMAN[cycle]} billing`}
              </p>

              {savings ? (
                <p className="text-primary mt-2 text-xs font-medium">
                  Save {formatINR(savings)} vs paying monthly
                </p>
              ) : null}

              <ul className="mt-6 flex-1 space-y-2.5">
                {enabledFeatures.map(([key]) => (
                  <li key={key} className="flex items-start gap-2 text-sm">
                    <Check className="text-primary mt-0.5 h-4 w-4 shrink-0" />
                    <span className="text-foreground/85">
                      {key
                        .split("_")
                        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
                        .join(" ")}
                    </span>
                  </li>
                ))}
              </ul>

              <Link href="/register-society" className="mt-7 block">
                <Button
                  variant={isHighlighted ? "default" : "outline"}
                  className="w-full"
                  size="lg"
                >
                  Start free trial
                </Button>
              </Link>
            </div>
          );
        })}
      </div>
    </div>
  );
}
