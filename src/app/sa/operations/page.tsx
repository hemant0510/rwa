"use client";

import { useQuery } from "@tanstack/react-query";
import {
  Activity,
  BarChart3,
  Loader2,
  Megaphone,
  RefreshCw,
  ScrollText,
  TrendingUp,
  Users,
} from "lucide-react";

import { ActivityFeed } from "@/components/features/operations/ActivityFeed";
import {
  SocietyHealthTable,
  formatCurrency,
  healthColor,
} from "@/components/features/operations/SocietyHealthTable";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/PageHeader";
import { Skeleton } from "@/components/ui/skeleton";
import { getActivityFeed, getOperationsSummary, getSocietyHealth } from "@/services/operations";

export default function OperationsDashboardPage() {
  const {
    data: summary,
    isLoading: summaryLoading,
    refetch: refetchSummary,
    isFetching: summaryFetching,
  } = useQuery({
    queryKey: ["operations-summary"],
    queryFn: getOperationsSummary,
  });

  const {
    data: health,
    isLoading: healthLoading,
    refetch: refetchHealth,
  } = useQuery({
    queryKey: ["operations-health"],
    queryFn: getSocietyHealth,
  });

  const {
    data: activityData,
    isLoading: activityLoading,
    refetch: refetchActivity,
  } = useQuery({
    queryKey: ["operations-activity"],
    queryFn: getActivityFeed,
  });

  const refreshAll = () => {
    refetchSummary();
    refetchHealth();
    refetchActivity();
  };

  const kpis = [
    {
      label: "Total Residents",
      value: summary?.totalResidents.toLocaleString(),
      icon: Users,
      color: "text-blue-600",
    },
    {
      label: "Collection Rate",
      value: summary ? `${summary.collectionRate}%` : undefined,
      icon: TrendingUp,
      color: healthColor(summary?.collectionRate ?? 0),
    },
    {
      label: "Expenses (This Month)",
      value: summary ? formatCurrency(summary.totalExpensesThisMonth) : undefined,
      icon: BarChart3,
      color: "text-orange-600",
    },
    {
      label: "Active Events",
      value: summary?.activeEvents.toLocaleString(),
      icon: Activity,
      color: "text-purple-600",
    },
    {
      label: "Active Petitions",
      value: summary?.activePetitions.toLocaleString(),
      icon: ScrollText,
      color: "text-indigo-600",
    },
    {
      label: "Broadcasts (This Month)",
      value: summary?.broadcastsThisMonth.toLocaleString(),
      icon: Megaphone,
      color: "text-teal-600",
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Platform Operations"
        description="Aggregated metrics and health signals across all societies"
      >
        <Button variant="outline" size="sm" onClick={refreshAll}>
          {summaryFetching ? (
            <Loader2 className="mr-1 h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="mr-1 h-4 w-4" />
          )}
          Refresh
        </Button>
      </PageHeader>

      {/* Row 1: Platform KPIs */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
        {summaryLoading
          ? Array.from({ length: 6 }).map((_, i) => (
              <Card key={i}>
                <CardContent className="p-4">
                  <Skeleton className="mb-2 h-4 w-20" />
                  <Skeleton className="h-8 w-16" />
                </CardContent>
              </Card>
            ))
          : kpis.map((kpi) => (
              <Card key={kpi.label}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2">
                    <kpi.icon className={`h-4 w-4 ${kpi.color}`} />
                    <p className="text-muted-foreground text-xs">{kpi.label}</p>
                  </div>
                  <p className={`mt-1 text-2xl font-bold ${kpi.color}`}>{kpi.value}</p>
                </CardContent>
              </Card>
            ))}
      </div>

      {/* Row 2: Society Health Table */}
      <SocietyHealthTable societies={health?.societies ?? []} isLoading={healthLoading} />

      {/* Row 3: Recent Activity Feed */}
      <ActivityFeed activities={activityData?.activities ?? []} isLoading={activityLoading} />
    </div>
  );
}
