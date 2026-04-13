import { Star } from "lucide-react";

import { cn } from "@/lib/utils";

interface EmergencyContactIndicatorProps {
  isEmergencyContact: boolean;
  priority?: number | null;
  className?: string;
}

export function EmergencyContactIndicator({
  isEmergencyContact,
  priority,
  className,
}: EmergencyContactIndicatorProps) {
  if (!isEmergencyContact) return null;

  const priorityLabel = priority === 1 ? "Primary" : priority === 2 ? "Secondary" : "Emergency";
  const ariaLabel = `Emergency contact, ${priorityLabel.toLowerCase()} priority`;

  const colorClass =
    priority === 1
      ? "border-red-200 bg-red-50 text-red-700"
      : "border-amber-200 bg-amber-50 text-amber-700";

  return (
    <span
      aria-label={ariaLabel}
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium",
        colorClass,
        className,
      )}
    >
      <Star className="h-3 w-3 fill-current" aria-hidden="true" />
      {priorityLabel}
    </span>
  );
}
