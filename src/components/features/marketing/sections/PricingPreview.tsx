import Link from "next/link";

import { ArrowRight, Check } from "lucide-react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Plan {
  name: string;
  price: string;
  cycle: string;
  description: string;
  units: string;
  features: string[];
  highlighted?: boolean;
  badge?: string;
}

const PLANS: Plan[] = [
  {
    name: "Basic",
    price: "₹499",
    cycle: "/mo",
    description: "Perfect for small societies starting out",
    units: "Up to 150 units",
    features: [
      "Resident management + RWAID",
      "Fee collection (UPI claim)",
      "Expense tracking",
      "Basic reports",
    ],
  },
  {
    name: "Community",
    price: "₹1,799",
    cycle: "/mo",
    description: "For growing societies that need WhatsApp + multi-admin",
    units: "Up to 750 units",
    features: [
      "Everything in Basic",
      "Multi admin with permissions",
      "WhatsApp notifications",
      "Petitions + Community events",
    ],
    highlighted: true,
    badge: "Most popular",
  },
  {
    name: "Pro",
    price: "₹2,999",
    cycle: "/mo",
    description: "Larger gated communities and complexes",
    units: "Up to 2,000 units",
    features: [
      "Everything in Community",
      "Advanced reports",
      "Elections module",
      "Priority support",
    ],
  },
];

export function PricingPreview() {
  return (
    <section className="bg-muted/20 border-y">
      <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6">
        <div className="mx-auto mb-12 max-w-2xl text-center">
          <p className="text-primary mb-3 text-sm font-semibold tracking-wide uppercase">
            Honest pricing
          </p>
          <h2 className="mb-4 text-3xl font-bold tracking-tight sm:text-4xl">
            Plans that scale with your society
          </h2>
          <p className="text-muted-foreground text-lg">
            14-day free trial on every plan. No credit card. Cancel anytime.
          </p>
        </div>

        <div className="grid gap-6 lg:grid-cols-3">
          {PLANS.map((plan) => (
            <div
              key={plan.name}
              className={cn(
                "bg-card relative rounded-2xl border p-7 transition-all",
                plan.highlighted
                  ? "border-primary shadow-primary/10 scale-[1.02] shadow-xl"
                  : "hover:border-primary/40 hover:shadow-md",
              )}
            >
              {plan.badge ? (
                <div className="from-primary to-chart-2 text-primary-foreground absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-gradient-to-r px-3 py-1 text-xs font-semibold">
                  {plan.badge}
                </div>
              ) : null}

              <h3 className="text-foreground text-xl font-bold">{plan.name}</h3>
              <p className="text-muted-foreground mt-1 text-sm">{plan.description}</p>

              <div className="mt-6 flex items-baseline gap-1">
                <span className="text-foreground text-4xl font-bold">{plan.price}</span>
                <span className="text-muted-foreground text-sm">{plan.cycle}</span>
              </div>
              <p className="text-muted-foreground mt-1 text-xs">{plan.units}</p>

              <ul className="mt-6 space-y-2.5">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm">
                    <Check className="text-primary mt-0.5 h-4 w-4 shrink-0" />
                    <span className="text-foreground/85">{f}</span>
                  </li>
                ))}
              </ul>

              <Link href="/register-society" className="mt-7 block">
                <Button
                  variant={plan.highlighted ? "default" : "outline"}
                  className="w-full"
                  size="lg"
                >
                  Start free trial
                </Button>
              </Link>
            </div>
          ))}
        </div>

        <div className="mt-10 text-center">
          <Link
            href="/pricing"
            className="text-primary inline-flex items-center gap-1 text-sm font-medium hover:underline"
          >
            Compare all 6 plans (incl. Flex per-unit) <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}
