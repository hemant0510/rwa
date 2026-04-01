"use client";

import { CheckCircle2, Circle } from "lucide-react";

import { Badge } from "@/components/ui/badge";

export interface StatusChangeEvent {
  id: string;
  fromStatus: string;
  toStatus: string;
  reason: string;
  createdAt: string;
}

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: "bg-green-100 text-green-700",
  TRIAL: "bg-blue-100 text-blue-700",
  SUSPENDED: "bg-red-100 text-red-700",
  OFFBOARDED: "bg-gray-100 text-gray-700",
};

function formatDate(timestamp: string): string {
  return new Date(timestamp).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

interface StatusTimelineProps {
  events: StatusChangeEvent[];
}

export function SocietyStatusTimeline({ events }: StatusTimelineProps) {
  if (events.length === 0) {
    return <p className="text-muted-foreground py-4 text-center text-sm">No status changes</p>;
  }

  return (
    <div className="space-y-0">
      {events.map((event, idx) => {
        const isLast = idx === events.length - 1;
        return (
          <div key={event.id} className="flex gap-3">
            <div className="flex flex-col items-center">
              {isLast ? (
                <CheckCircle2 className="h-4 w-4 shrink-0 text-green-600" />
              ) : (
                <Circle className="text-muted-foreground h-4 w-4 shrink-0" />
              )}
              {!isLast && <div className="bg-border my-1 w-px flex-1" />}
            </div>
            <div className="pb-4">
              <div className="flex items-center gap-2">
                <Badge
                  variant="outline"
                  className={`border-0 text-xs ${STATUS_COLORS[event.fromStatus] ?? ""}`}
                >
                  {event.fromStatus}
                </Badge>
                <span className="text-muted-foreground text-xs">&rarr;</span>
                <Badge
                  variant="outline"
                  className={`border-0 text-xs ${STATUS_COLORS[event.toStatus] ?? ""}`}
                >
                  {event.toStatus}
                </Badge>
              </div>
              <p className="mt-1 text-sm">{event.reason}</p>
              <p className="text-muted-foreground text-xs">{formatDate(event.createdAt)}</p>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export { formatDate };
