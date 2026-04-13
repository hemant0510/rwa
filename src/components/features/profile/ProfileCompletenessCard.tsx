"use client";

import { useState } from "react";

import Link from "next/link";

import { Check, ChevronRight, Circle, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { CompletenessItem, CompletenessResult, TierLabel } from "@/types/user";

const TIER_STYLES: Record<
  TierLabel,
  { ring: string; badge: string; label: string; track: string }
> = {
  BASIC: {
    ring: "text-slate-500",
    badge: "border-slate-300 bg-slate-50 text-slate-700",
    label: "Basic",
    track: "text-slate-200",
  },
  STANDARD: {
    ring: "text-amber-500",
    badge: "border-amber-300 bg-amber-50 text-amber-700",
    label: "Standard",
    track: "text-amber-100",
  },
  COMPLETE: {
    ring: "text-blue-500",
    badge: "border-blue-300 bg-blue-50 text-blue-700",
    label: "Complete",
    track: "text-blue-100",
  },
  VERIFIED: {
    ring: "text-emerald-500",
    badge: "border-emerald-300 bg-emerald-50 text-emerald-700",
    label: "Verified",
    track: "text-emerald-100",
  },
};

const NEXT_ITEM_HREFS: Record<string, string> = {
  A1: "/r/profile",
  A2: "/r/profile",
  A3: "/r/profile",
  A4: "/r/profile",
  B1: "/r/profile",
  B2: "/r/profile",
  C1: "/r/profile/family",
  D1: "/r/profile/family",
  E1: "/r/profile/vehicles",
};

function hrefForNextItem(item: CompletenessItem | null): string {
  if (!item) return "/r/profile";
  return NEXT_ITEM_HREFS[item.key] ?? "/r/profile";
}

export function CompletenessRing({
  percentage,
  tier,
  size = "md",
}: {
  percentage: number;
  tier: TierLabel;
  size?: "sm" | "md";
}) {
  const style = TIER_STYLES[tier];
  const radius = 26;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percentage / 100) * circumference;
  const dim = size === "sm" ? "h-12 w-12" : "h-16 w-16";
  const fontSize = size === "sm" ? "text-[10px]" : "text-sm";
  return (
    <div className={`relative shrink-0 ${dim}`} aria-label={`${percentage}% complete`}>
      <svg viewBox="0 0 64 64" className="h-full w-full -rotate-90">
        <circle
          cx="32"
          cy="32"
          r={radius}
          fill="none"
          strokeWidth="6"
          className={style.track}
          stroke="currentColor"
        />
        <circle
          cx="32"
          cy="32"
          r={radius}
          fill="none"
          strokeWidth="6"
          className={style.ring}
          stroke="currentColor"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
        />
      </svg>
      <span
        className={`absolute inset-0 flex items-center justify-center font-semibold text-slate-800 ${fontSize}`}
      >
        {percentage}%
      </span>
    </div>
  );
}

interface ProfileCompletenessCardProps {
  completeness: CompletenessResult;
  trigger?: React.ReactNode;
}

/**
 * Details popup: ring + tier badge + next-step CTA + core-items checklist + Extras.
 * `trigger` defaults to a compact ring + tier badge + "View details" button.
 */
export function ProfileCompletenessCard({ completeness, trigger }: ProfileCompletenessCardProps) {
  const [open, setOpen] = useState(false);
  const { percentage, tier, items, bonus, nextIncompleteItem } = completeness;
  const style = TIER_STYLES[tier];
  const nextHref = hrefForNextItem(nextIncompleteItem);

  const defaultTrigger = (
    <button
      type="button"
      onClick={() => setOpen(true)}
      className="flex items-center gap-3 rounded-md px-2 py-1 hover:bg-slate-50"
      aria-label="View profile completeness details"
    >
      <CompletenessRing percentage={percentage} tier={tier} size="sm" />
      <div className="flex flex-col items-start">
        <span
          className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${style.badge}`}
        >
          {style.label}
        </span>
        <span className="text-primary mt-0.5 text-[10px] font-medium">View details</span>
      </div>
    </button>
  );

  return (
    <>
      {trigger ?? defaultTrigger}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              <CompletenessRing percentage={percentage} tier={tier} />
              <span className="flex flex-col">
                <span>Profile Completeness</span>
                <span
                  className={`mt-1 inline-flex w-fit items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${style.badge}`}
                >
                  {style.label}
                </span>
              </span>
            </DialogTitle>
            <DialogDescription>
              Complete these items to strengthen your directory profile.
            </DialogDescription>
          </DialogHeader>

          {nextIncompleteItem ? (
            <Link
              href={nextHref}
              onClick={() => setOpen(false)}
              className="text-primary inline-flex items-center gap-1 text-xs font-medium hover:underline"
            >
              Next: {nextIncompleteItem.label}
              <ChevronRight className="h-3.5 w-3.5" />
            </Link>
          ) : (
            <p className="text-muted-foreground text-xs">All core items complete</p>
          )}

          <ul className="space-y-1.5">
            {items.map((item) => (
              <li key={item.key} className="flex items-center gap-2 text-xs">
                {item.completed ? (
                  <Check className="h-3.5 w-3.5 text-emerald-600" aria-hidden="true" />
                ) : (
                  <Circle className="h-3.5 w-3.5 text-slate-300" aria-hidden="true" />
                )}
                <span
                  className={
                    item.completed ? "text-slate-600 line-through" : "font-medium text-slate-800"
                  }
                >
                  {item.label}
                </span>
                <span className="text-muted-foreground ml-auto text-[10px]">{item.points} pts</span>
              </li>
            ))}
          </ul>

          <div className="border-t pt-3">
            <div className="text-muted-foreground mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase">
              <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
              Extras
            </div>
            <ul className="space-y-1">
              {bonus.map((b) => (
                <li key={b.key} className="flex items-center gap-2 text-xs">
                  {b.completed ? (
                    <Check className="h-3.5 w-3.5 text-emerald-600" aria-hidden="true" />
                  ) : (
                    <Circle className="h-3.5 w-3.5 text-slate-300" aria-hidden="true" />
                  )}
                  <span
                    className={
                      b.completed ? "text-slate-600 line-through" : "font-medium text-slate-800"
                    }
                  >
                    {b.label}
                  </span>
                </li>
              ))}
            </ul>
          </div>

          <div className="flex justify-end">
            <Button variant="outline" size="sm" onClick={/* v8 ignore next */ () => setOpen(false)}>
              Close
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
