"use client";

import { AlertTriangle, Info } from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { ActivityItem } from "@/services/operations";

const SEVERITY_ICON = {
  info: Info,
  warning: AlertTriangle,
  alert: AlertTriangle,
};

const SEVERITY_COLORS = {
  info: "text-blue-500",
  warning: "text-yellow-500",
  alert: "text-red-500",
};

function timeAgo(timestamp: string): string {
  const diff = Date.now() - new Date(timestamp).getTime();
  const hours = Math.floor(diff / (1000 * 60 * 60));
  if (hours < 1) return "just now";
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

interface ActivityFeedProps {
  activities: ActivityItem[];
  isLoading: boolean;
}

export function ActivityFeed({ activities, isLoading }: ActivityFeedProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Activity</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : !activities.length ? (
          <p className="text-muted-foreground py-8 text-center">No recent activity</p>
        ) : (
          <div className="space-y-3">
            {activities.map((item, idx) => {
              const Icon = SEVERITY_ICON[item.severity];
              return (
                <div key={idx} className="flex items-start gap-3 rounded-md border p-3">
                  <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${SEVERITY_COLORS[item.severity]}`} />
                  <div className="flex-1">
                    <p className="text-sm">{item.message}</p>
                    <p className="text-muted-foreground text-xs">{timeAgo(item.timestamp)}</p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export { timeAgo };
