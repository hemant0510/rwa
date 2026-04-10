"use client";

import { Badge } from "@/components/ui/badge";

const TYPE_LABELS: Record<string, string> = {
  MAINTENANCE_ISSUE: "Maintenance",
  SECURITY_CONCERN: "Security",
  NOISE_COMPLAINT: "Noise",
  PARKING_ISSUE: "Parking",
  CLEANLINESS: "Cleanliness",
  BILLING_QUERY: "Billing",
  AMENITY_REQUEST: "Amenity",
  NEIGHBOR_DISPUTE: "Neighbor Dispute",
  SUGGESTION: "Suggestion",
  OTHER: "Other",
};

export function ResidentTicketTypeBadge({ type }: { type: string }) {
  return (
    <Badge variant="outline" className="text-xs font-medium">
      {TYPE_LABELS[type] ?? type}
    </Badge>
  );
}
