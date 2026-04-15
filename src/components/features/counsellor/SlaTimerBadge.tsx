import { AlertTriangle, Clock } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { describeSla } from "@/lib/counsellor/sla";

interface SlaTimerBadgeProps {
  deadline: string | null;
}

export function SlaTimerBadge({ deadline }: SlaTimerBadgeProps) {
  const deadlineDate = deadline ? new Date(deadline) : null;
  const status = describeSla(deadlineDate);

  if (!status.deadline || status.hoursRemaining === null) {
    return (
      <Badge variant="outline" className="gap-1 text-xs">
        <Clock className="h-3 w-3" />
        SLA: n/a
      </Badge>
    );
  }

  if (status.isBreached) {
    return (
      <Badge variant="destructive" className="gap-1 text-xs">
        <AlertTriangle className="h-3 w-3" />
        SLA breached · {Math.abs(status.hoursRemaining)}h overdue
      </Badge>
    );
  }

  const urgent = status.hoursRemaining <= 12;
  return (
    <Badge
      variant={urgent ? "default" : "secondary"}
      className={`gap-1 text-xs ${urgent ? "bg-amber-600 hover:bg-amber-700" : ""}`}
    >
      <Clock className="h-3 w-3" />
      SLA: {status.hoursRemaining}h left
    </Badge>
  );
}
