import { AlertTriangle, CheckCircle2, CircleSlash, Clock } from "lucide-react";

import { cn } from "@/lib/utils";

export type ExpiryStatus = "VALID" | "EXPIRING_SOON" | "EXPIRED" | "NOT_SET";

interface ExpiryBadgeProps {
  label: string;
  date: string | null;
  status: ExpiryStatus;
  className?: string;
}

const STATUS_STYLES: Record<ExpiryStatus, { className: string; Icon: typeof CheckCircle2 }> = {
  VALID: {
    className: "border-emerald-200 bg-emerald-50 text-emerald-700",
    Icon: CheckCircle2,
  },
  EXPIRING_SOON: {
    className: "border-amber-200 bg-amber-50 text-amber-700",
    Icon: Clock,
  },
  EXPIRED: {
    className: "border-red-200 bg-red-50 text-red-700",
    Icon: AlertTriangle,
  },
  NOT_SET: {
    className: "border-slate-200 bg-slate-50 text-slate-600",
    Icon: CircleSlash,
  },
};

function formatDate(date: string | null): string {
  if (!date) return "Not set";
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return "Not set";
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

export function ExpiryBadge({ label, date, status, className }: ExpiryBadgeProps) {
  const { className: statusClass, Icon } = STATUS_STYLES[status];
  const ariaStatus =
    status === "VALID"
      ? "valid"
      : status === "EXPIRING_SOON"
        ? "expiring soon"
        : status === "EXPIRED"
          ? "expired"
          : "not set";
  const formatted = formatDate(date);

  return (
    <span
      aria-label={`${label} ${ariaStatus}: ${formatted}`}
      className={cn(
        "inline-flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium",
        statusClass,
        className,
      )}
    >
      <Icon className="h-3 w-3" aria-hidden="true" />
      <span className="font-semibold">{label}:</span>
      <span>{formatted}</span>
    </span>
  );
}
