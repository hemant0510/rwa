"use client";

import { CheckCircle2, Circle } from "lucide-react";

interface StatusEvent {
  status: string;
  timestamp: string;
  label?: string;
}

const STATUS_LABELS: Record<string, string> = {
  OPEN: "Opened",
  IN_PROGRESS: "Picked Up",
  AWAITING_ADMIN: "Awaiting Admin Response",
  AWAITING_SA: "Awaiting SA Response",
  RESOLVED: "Resolved",
  CLOSED: "Closed",
};

function formatDate(timestamp: string): string {
  return new Date(timestamp).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

interface StatusTimelineProps {
  events: StatusEvent[];
}

export function StatusTimeline({ events }: StatusTimelineProps) {
  if (events.length === 0) {
    return <p className="text-muted-foreground py-4 text-center text-sm">No status changes</p>;
  }

  return (
    <div className="space-y-0">
      {events.map((event, idx) => {
        const isLast = idx === events.length - 1;
        return (
          <div key={idx} className="flex gap-3">
            <div className="flex flex-col items-center">
              {isLast ? (
                <CheckCircle2 className="h-4 w-4 shrink-0 text-green-600" />
              ) : (
                <Circle className="text-muted-foreground h-4 w-4 shrink-0" />
              )}
              {!isLast && <div className="bg-border my-1 w-px flex-1" />}
            </div>
            <div className="pb-4">
              <p className="text-sm font-medium">
                {event.label ?? STATUS_LABELS[event.status] ?? event.status}
              </p>
              <p className="text-muted-foreground text-xs">{formatDate(event.timestamp)}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export { formatDate };
