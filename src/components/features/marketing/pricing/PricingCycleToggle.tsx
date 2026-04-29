"use client";

import { cn } from "@/lib/utils";
import type { BillingCycle } from "@/types/public-plan";

interface CycleOption {
  value: BillingCycle;
  label: string;
  hint?: string;
}

const CYCLES: CycleOption[] = [
  { value: "MONTHLY", label: "Monthly" },
  { value: "ANNUAL", label: "Annual", hint: "Save 17%" },
  { value: "TWO_YEAR", label: "2-Year", hint: "Save 17%" },
  { value: "THREE_YEAR", label: "3-Year", hint: "Save 25%" },
];

interface Props {
  value: BillingCycle;
  onChange: (cycle: BillingCycle) => void;
}

export function PricingCycleToggle({ value, onChange }: Props) {
  return (
    <div
      role="radiogroup"
      aria-label="Billing cycle"
      className="bg-muted inline-flex flex-wrap gap-1 rounded-xl p-1"
    >
      {CYCLES.map((cycle) => {
        const isActive = cycle.value === value;
        return (
          <button
            key={cycle.value}
            type="button"
            role="radio"
            aria-checked={isActive}
            onClick={() => onChange(cycle.value)}
            className={cn(
              "relative rounded-lg px-4 py-2 text-sm font-medium transition-all",
              isActive
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {cycle.label}
            {cycle.hint ? (
              <span
                className={cn(
                  "ml-2 rounded-full px-1.5 py-0.5 text-[10px] font-semibold",
                  isActive ? "bg-primary/15 text-primary" : "bg-background text-muted-foreground",
                )}
              >
                {cycle.hint}
              </span>
            ) : null}
          </button>
        );
      })}
    </div>
  );
}
