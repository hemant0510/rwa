// Static pricing fallback used when the live plans endpoint returns nothing
// (DB empty, dev environment without seed, or error).
// Source of truth: subscription_plans.md.

import Link from "next/link";

import { Check, Star } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface FallbackPlan {
  name: string;
  monthly: number | null;
  pricePerUnit?: number;
  units: string;
  description: string;
  features: string[];
  badge?: string;
  highlighted?: boolean;
  perUnit?: boolean;
}

const FALLBACK_PLANS: FallbackPlan[] = [
  {
    name: "Basic",
    monthly: 499,
    units: "Up to 150 units",
    description: "Small societies starting their digital journey",
    features: [
      "Resident management + RWAID",
      "Fee collection (UPI claim)",
      "Expense tracking",
      "Basic reports",
    ],
  },
  {
    name: "Basic+",
    monthly: 999,
    units: "Up to 300 units",
    description: "Add multi-admin and advanced reports",
    features: [
      "Everything in Basic",
      "Multi admin with permissions",
      "Advanced reports",
      "Audit log retention",
    ],
  },
  {
    name: "Community",
    monthly: 1799,
    units: "Up to 750 units",
    description: "Most popular for growing societies",
    badge: "Most popular",
    highlighted: true,
    features: [
      "Everything in Basic+",
      "WhatsApp notifications",
      "Petitions + signatures",
      "Community events module",
    ],
  },
  {
    name: "Pro",
    monthly: 2999,
    units: "Up to 2,000 units",
    description: "Larger gated communities and complexes",
    features: [
      "Everything in Community",
      "Elections module",
      "Priority support",
      "Bulk operations",
    ],
  },
  {
    name: "Enterprise AI",
    monthly: 4999,
    units: "Unlimited units",
    description: "Largest societies with AI features (when available)",
    badge: "Best value",
    features: [
      "Everything in Pro",
      "AI insights (roadmap)",
      "API access",
      "Dedicated success manager",
    ],
  },
  {
    name: "Flex",
    monthly: null,
    pricePerUnit: 8,
    units: "Unlimited — pay per unit",
    description: "Pay only for active units, billed monthly",
    perUnit: true,
    features: [
      "All core features",
      "Resident-count snapshot",
      "Cancel anytime",
      "Predictable monthly cost",
    ],
  },
];

const FORMATTER = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

export function StaticPricingFallback() {
  return (
    <div className="grid gap-6 lg:grid-cols-3">
      {FALLBACK_PLANS.map((plan) => (
        <div
          key={plan.name}
          className={cn(
            "bg-card relative flex flex-col rounded-2xl border p-7 transition-all",
            plan.highlighted
              ? "border-primary shadow-primary/10 shadow-xl lg:scale-[1.03]"
              : "hover:border-primary/40 hover:shadow-md",
          )}
        >
          {plan.badge ? (
            <div className="from-primary to-chart-2 text-primary-foreground absolute -top-3 left-1/2 inline-flex -translate-x-1/2 items-center gap-1 rounded-full bg-gradient-to-r px-3 py-1 text-xs font-semibold">
              <Star className="h-3 w-3" />
              {plan.badge}
            </div>
          ) : null}

          <h3 className="text-foreground text-xl font-bold">{plan.name}</h3>
          <p className="text-muted-foreground mt-1 text-sm">{plan.description}</p>

          <div className="mt-6 flex items-baseline gap-1">
            <span className="text-foreground text-4xl font-bold">
              {plan.perUnit
                ? `₹${plan.pricePerUnit}`
                : plan.monthly
                  ? FORMATTER.format(plan.monthly)
                  : "—"}
            </span>
            <span className="text-muted-foreground text-sm">
              {plan.perUnit ? "/unit/mo" : "/mo"}
            </span>
          </div>
          <p className="text-muted-foreground mt-1 text-xs">{plan.units}</p>

          <ul className="mt-6 flex-1 space-y-2.5">
            {plan.features.map((f) => (
              <li key={f} className="flex items-start gap-2 text-sm">
                <Check className="text-primary mt-0.5 h-4 w-4 shrink-0" />
                <span className="text-foreground/85">{f}</span>
              </li>
            ))}
          </ul>

          <Link href="/register-society" className="mt-7 block">
            <Button variant={plan.highlighted ? "default" : "outline"} className="w-full" size="lg">
              Start free trial
            </Button>
          </Link>
        </div>
      ))}
    </div>
  );
}
