"use client";

import Link from "next/link";

import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  AlertTriangle,
  Bell,
  Building2,
  CheckCircle,
  CreditCard,
  RefreshCw,
  Timer,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageSkeleton } from "@/components/ui/LoadingSkeleton";
import { PageHeader } from "@/components/ui/PageHeader";
import { getNotifications } from "@/services/sa-notifications";
import type { Alert, AlertPriority, AlertType } from "@/services/sa-notifications";

const PRIORITY_COLORS: Record<AlertPriority, string> = {
  HIGH: "border-red-200 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-400",
  MEDIUM:
    "border-orange-200 bg-orange-50 text-orange-700 dark:border-orange-900 dark:bg-orange-950/30 dark:text-orange-400",
  LOW: "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-400",
};

const PRIORITY_BADGE: Record<AlertPriority, string> = {
  HIGH: "border-red-200 bg-red-50 text-red-700",
  MEDIUM: "border-orange-200 bg-orange-50 text-orange-700",
  LOW: "border-blue-200 bg-blue-50 text-blue-700",
};

function AlertIcon({ type }: { type: AlertType }) {
  switch (type) {
    case "TRIAL_EXPIRING":
      return <Timer className="h-4 w-4 shrink-0" />;
    case "SUBSCRIPTION_EXPIRED":
      return <AlertTriangle className="h-4 w-4 shrink-0" />;
    case "PAYMENT_OVERDUE":
      return <CreditCard className="h-4 w-4 shrink-0" />;
    case "SOCIETY_REGISTERED":
      return <Building2 className="h-4 w-4 shrink-0" />;
    default:
      return <Bell className="h-4 w-4 shrink-0" />;
  }
}

function AlertCard({ alert }: { alert: Alert }) {
  return (
    <div
      className={`flex items-start gap-3 rounded-lg border p-4 transition-colors ${PRIORITY_COLORS[alert.priority]}`}
    >
      <AlertIcon type={alert.type} />
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium">{alert.title}</span>
          <Badge variant="outline" className={`text-xs ${PRIORITY_BADGE[alert.priority]}`}>
            {alert.priority}
          </Badge>
        </div>
        <p className="mt-0.5 text-sm opacity-80">{alert.description}</p>
        <div className="mt-1 flex items-center gap-3">
          <p className="text-xs opacity-60">
            {format(new Date(alert.createdAt), "dd MMM yyyy, hh:mm a")}
          </p>
          <Link
            href={`/sa/societies/${alert.societyId}`}
            className="text-xs font-medium underline-offset-2 hover:underline"
          >
            View Society →
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function NotificationsPage() {
  const {
    data: alerts = [],
    isLoading,
    refetch,
    isFetching,
  } = useQuery({
    queryKey: ["sa-notifications"],
    queryFn: getNotifications,
    refetchInterval: 60_000,
  });

  const highAlerts = alerts.filter((a) => a.priority === "HIGH");
  const mediumAlerts = alerts.filter((a) => a.priority === "MEDIUM");
  const lowAlerts = alerts.filter((a) => a.priority === "LOW");

  if (isLoading) return <PageSkeleton />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <PageHeader title="Alerts" description="Platform-wide system alerts and health signals" />
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
          <RefreshCw className={`mr-2 h-4 w-4 ${isFetching ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      {/* Summary row */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-red-100 p-2 dark:bg-red-900/30">
                <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />
              </div>
              <div>
                <p className="text-muted-foreground text-sm">High Priority</p>
                <p className="text-2xl font-bold">{highAlerts.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-orange-100 p-2 dark:bg-orange-900/30">
                <Bell className="h-5 w-5 text-orange-600 dark:text-orange-400" />
              </div>
              <div>
                <p className="text-muted-foreground text-sm">Medium Priority</p>
                <p className="text-2xl font-bold">{mediumAlerts.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-5">
            <div className="flex items-center gap-3">
              <div className="rounded-lg bg-blue-100 p-2 dark:bg-blue-900/30">
                <CheckCircle className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-muted-foreground text-sm">Informational</p>
                <p className="text-2xl font-bold">{lowAlerts.length}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Alert feed */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-4 w-4" />
            All Alerts
            {alerts.length > 0 && (
              <span className="bg-muted ml-1 rounded px-1.5 py-0.5 text-xs font-medium">
                {alerts.length}
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {alerts.length === 0 ? (
            <div className="flex flex-col items-center gap-2 py-12">
              <CheckCircle className="h-10 w-10 text-green-500" />
              <p className="text-muted-foreground text-sm">No alerts — platform looks healthy!</p>
            </div>
          ) : (
            <div className="space-y-3">
              {alerts.map((alert) => (
                <AlertCard key={alert.id} alert={alert} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
