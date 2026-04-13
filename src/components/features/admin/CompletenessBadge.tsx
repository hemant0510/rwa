import { cn } from "@/lib/utils";
import type { TierLabel } from "@/types/user";

const TIER_STYLES: Record<TierLabel, { className: string; label: string }> = {
  BASIC: {
    className: "border-slate-300 bg-slate-50 text-slate-700",
    label: "Basic",
  },
  STANDARD: {
    className: "border-amber-300 bg-amber-50 text-amber-700",
    label: "Standard",
  },
  COMPLETE: {
    className: "border-blue-300 bg-blue-50 text-blue-700",
    label: "Complete",
  },
  VERIFIED: {
    className: "border-emerald-300 bg-emerald-50 text-emerald-700",
    label: "Verified",
  },
};

interface CompletenessBadgeProps {
  tier: TierLabel;
  score?: number | null;
  className?: string;
}

export function CompletenessBadge({ tier, score, className }: CompletenessBadgeProps) {
  const style = TIER_STYLES[tier];
  const scoreDisplay = typeof score === "number" ? ` · ${score}%` : "";
  const ariaLabel = `Completeness tier ${style.label}${scoreDisplay ? `, ${score}% complete` : ""}`;

  return (
    <span
      aria-label={ariaLabel}
      className={cn(
        "inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold",
        style.className,
        className,
      )}
    >
      {style.label}
      {scoreDisplay}
    </span>
  );
}
