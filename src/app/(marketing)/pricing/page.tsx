import { PricingFAQ } from "@/components/features/marketing/pricing/PricingFAQ";
import { PricingGrid } from "@/components/features/marketing/pricing/PricingGrid";
import { StaticPricingFallback } from "@/components/features/marketing/pricing/StaticPricingFallback";
import { CtaBand } from "@/components/features/marketing/sections/CtaBand";
import { getPublicPlans } from "@/services/public-plans";

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Pricing — RWA Connect",
  description:
    "Plans starting at ₹499/month for 150 units. 14-day free trial on every plan. No credit card required.",
};

export default async function PricingPage() {
  const plans = await getPublicPlans();

  return (
    <>
      <section className="relative overflow-hidden">
        <div
          aria-hidden="true"
          className="from-primary/10 via-background to-background pointer-events-none absolute inset-0 bg-gradient-to-b"
        />
        <div className="relative mx-auto max-w-4xl px-4 pt-20 pb-12 text-center sm:px-6">
          <p className="text-primary mb-3 text-sm font-semibold tracking-wide uppercase">
            Honest pricing
          </p>
          <h1 className="mb-4 text-4xl font-bold tracking-tight sm:text-5xl">
            Plans that scale with your society.
          </h1>
          <p className="text-muted-foreground mx-auto max-w-xl text-lg">
            Every plan includes a 14-day free trial. No credit card. Cancel anytime.
          </p>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 pb-20 sm:px-6">
        {plans.length > 0 ? <PricingGrid plans={plans} /> : <StaticPricingFallback />}

        <div className="mt-16">
          <h2 className="mb-8 text-center text-2xl font-bold tracking-tight sm:text-3xl">
            Pricing FAQ
          </h2>
          <PricingFAQ />
        </div>
      </section>

      <CtaBand />
    </>
  );
}
