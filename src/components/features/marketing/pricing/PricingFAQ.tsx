"use client";

import { useState } from "react";

import { ChevronDown } from "lucide-react";

import { cn } from "@/lib/utils";

const ITEMS: { q: string; a: string }[] = [
  {
    q: "Are taxes included?",
    a: "Prices shown are exclusive of GST (18%). GST is added at checkout and reflected on the invoice.",
  },
  {
    q: "Can I cancel anytime?",
    a: "Yes. Cancel from the admin settings. Your subscription stays active until the end of the current billing period — no cancellation fee.",
  },
  {
    q: "Do you offer refunds on annual plans?",
    a: "Annual plans are non-refundable for the period already consumed. Upgrades and downgrades are pro-rated automatically. See our refund policy for details.",
  },
  {
    q: "Can I switch plans mid-cycle?",
    a: "Yes. The system pro-rates the credit/charge automatically. Upgrades take effect immediately; downgrades take effect at the end of the current cycle.",
  },
  {
    q: "What if my society grows past my plan's unit limit?",
    a: "We notify you before you hit the cap. You can upgrade to a larger plan or switch to Flex (pay per unit). No service interruption.",
  },
  {
    q: "Is there a setup fee?",
    a: "No. Onboarding is self-serve and takes about two minutes. We're available over WhatsApp/email if you get stuck.",
  },
];

export function PricingFAQ() {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  return (
    <div className="mx-auto max-w-3xl space-y-3">
      {ITEMS.map((item, i) => {
        const isOpen = openIndex === i;
        return (
          <div
            key={item.q}
            className={cn(
              "bg-card overflow-hidden rounded-xl border transition-all",
              isOpen ? "border-primary/40 shadow-sm" : "hover:border-primary/30",
            )}
          >
            <button
              type="button"
              onClick={() => setOpenIndex(isOpen ? null : i)}
              className="flex w-full items-center justify-between gap-4 px-6 py-5 text-left"
              aria-expanded={isOpen}
            >
              <span className="text-foreground text-sm font-semibold sm:text-base">{item.q}</span>
              <ChevronDown
                className={cn(
                  "text-muted-foreground h-4 w-4 shrink-0 transition-transform",
                  isOpen && "rotate-180",
                )}
              />
            </button>
            {isOpen ? (
              <p className="text-muted-foreground border-t px-6 py-4 text-sm leading-relaxed">
                {item.a}
              </p>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
