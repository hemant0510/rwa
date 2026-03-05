import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { FeeStatus } from "@/types/fee";

const statusConfig: Record<FeeStatus, { label: string; className: string }> = {
  PAID: {
    label: "Paid",
    className: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  },
  PENDING: {
    label: "Pending",
    className: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
  },
  OVERDUE: {
    label: "Overdue",
    className: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  },
  PARTIAL: {
    label: "Partial",
    className: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  },
  EXEMPTED: {
    label: "Exempted",
    className: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  },
  NOT_YET_DUE: {
    label: "Not Yet Due",
    className: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
  },
};

interface StatusBadgeProps {
  status: FeeStatus;
  amount?: number;
  className?: string;
}

export function StatusBadge({ status, amount, className }: StatusBadgeProps) {
  const config = statusConfig[status];
  const label =
    status === "PARTIAL" && amount != null
      ? `\u20B9${amount.toLocaleString("en-IN")}`
      : config.label;

  return (
    <Badge variant="outline" className={cn("border-0 font-medium", config.className, className)}>
      {label}
    </Badge>
  );
}
