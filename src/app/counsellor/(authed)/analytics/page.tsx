"use client";

import { useState } from "react";

import { useQuery } from "@tanstack/react-query";

import { PortfolioAnalyticsView } from "@/components/features/counsellor/PortfolioAnalyticsView";
import { Button } from "@/components/ui/button";
import { CardSkeleton } from "@/components/ui/LoadingSkeleton";
import { PageHeader } from "@/components/ui/PageHeader";
import { getPortfolioAnalytics } from "@/services/counsellor-self";

const WINDOW_OPTIONS = [7, 30, 90] as const;
type WindowDays = (typeof WINDOW_OPTIONS)[number];

export default function CounsellorAnalyticsPage() {
  const [windowDays, setWindowDays] = useState<WindowDays>(30);
  const { data, isLoading, error } = useQuery({
    queryKey: ["counsellor-analytics", windowDays],
    queryFn: () => getPortfolioAnalytics({ windowDays }),
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Portfolio analytics"
        description="Cross-society escalation metrics across your assigned portfolio."
      />

      <div className="flex flex-wrap gap-2">
        {WINDOW_OPTIONS.map((days) => (
          <Button
            key={days}
            size="sm"
            variant={windowDays === days ? "default" : "outline"}
            onClick={() => setWindowDays(days)}
          >
            Last {days} days
          </Button>
        ))}
      </div>

      {isLoading && <CardSkeleton />}

      {error && (
        <div className="border-destructive/40 bg-destructive/10 text-destructive rounded-md border p-4 text-sm">
          Failed to load analytics: {error.message}
        </div>
      )}

      {data && <PortfolioAnalyticsView data={data} />}
    </div>
  );
}
