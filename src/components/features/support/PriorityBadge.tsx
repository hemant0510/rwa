"use client";

import { Badge } from "@/components/ui/badge";

const PRIORITY_COLORS: Record<string, string> = {
  LOW: "bg-gray-100 text-gray-600",
  MEDIUM: "bg-blue-100 text-blue-700",
  HIGH: "bg-orange-100 text-orange-700",
  URGENT: "bg-red-100 text-red-700",
};

export function PriorityBadge({ priority }: { priority: string }) {
  return (
    <Badge
      variant="outline"
      className={`border-0 text-xs font-medium ${PRIORITY_COLORS[priority] ?? ""}`}
    >
      {priority}
    </Badge>
  );
}
