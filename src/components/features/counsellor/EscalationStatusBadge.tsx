import { Badge } from "@/components/ui/badge";

const STATUS_CLASSES: Record<string, string> = {
  PENDING: "bg-red-100 text-red-700",
  ACKNOWLEDGED: "bg-blue-100 text-blue-700",
  REVIEWING: "bg-indigo-100 text-indigo-700",
  RESOLVED_BY_COUNSELLOR: "bg-green-100 text-green-700",
  DEFERRED_TO_ADMIN: "bg-amber-100 text-amber-700",
  WITHDRAWN: "bg-gray-100 text-gray-700",
};

const STATUS_LABELS: Record<string, string> = {
  PENDING: "Pending",
  ACKNOWLEDGED: "Acknowledged",
  REVIEWING: "Reviewing",
  RESOLVED_BY_COUNSELLOR: "Resolved",
  DEFERRED_TO_ADMIN: "Deferred to Admin",
  WITHDRAWN: "Withdrawn",
};

export function EscalationStatusBadge({ status }: { status: string }) {
  return (
    <Badge
      variant="outline"
      className={`border-0 text-xs font-medium ${STATUS_CLASSES[status] ?? ""}`}
    >
      {STATUS_LABELS[status] ?? status}
    </Badge>
  );
}
