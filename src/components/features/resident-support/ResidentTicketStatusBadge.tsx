"use client";

import { Badge } from "@/components/ui/badge";

const STATUS_COLORS: Record<string, string> = {
  OPEN: "bg-blue-100 text-blue-700",
  IN_PROGRESS: "bg-indigo-100 text-indigo-700",
  AWAITING_RESIDENT: "bg-orange-100 text-orange-700",
  AWAITING_ADMIN: "bg-purple-100 text-purple-700",
  RESOLVED: "bg-green-100 text-green-700",
  CLOSED: "bg-gray-100 text-gray-700",
};

const STATUS_LABELS: Record<string, string> = {
  OPEN: "Open",
  IN_PROGRESS: "In Progress",
  AWAITING_RESIDENT: "Awaiting Resident",
  AWAITING_ADMIN: "Awaiting Admin",
  RESOLVED: "Resolved",
  CLOSED: "Closed",
};

export function ResidentTicketStatusBadge({ status }: { status: string }) {
  return (
    <Badge
      variant="outline"
      className={`border-0 text-xs font-medium ${STATUS_COLORS[status] ?? ""}`}
    >
      {STATUS_LABELS[status] ?? status}
    </Badge>
  );
}
