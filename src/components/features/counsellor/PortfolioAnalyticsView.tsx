"use client";

import { AlertTriangle, Building2, CheckCircle2, Clock, TrendingUp } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { CounsellorPortfolioAnalytics } from "@/types/counsellor";

interface Props {
  data: CounsellorPortfolioAnalytics;
}

export function PortfolioAnalyticsView({ data }: Props) {
  const { totals, byType, bySociety, byStatus, windowDays } = data;
  const maxTypeCount = byType.length > 0 ? byType[0].count : 0;
  const maxSocietyTotal = bySociety.length > 0 ? bySociety[0].total : 0;
  const avg = totals.avgResolutionHours;

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Societies"
          value={String(totals.societies)}
          icon={<Building2 className="h-4 w-4" />}
        />
        <StatCard
          label="Open escalations"
          value={String(totals.openEscalations)}
          icon={<Clock className="h-4 w-4" />}
        />
        <StatCard
          label="SLA breached (open)"
          value={String(totals.slaBreachedOpen)}
          icon={<AlertTriangle className="h-4 w-4" />}
          tone={totals.slaBreachedOpen > 0 ? "danger" : "neutral"}
        />
        <StatCard
          label="Avg resolution (h)"
          value={avg === null ? "—" : String(avg)}
          icon={<CheckCircle2 className="h-4 w-4" />}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <TrendingUp className="h-4 w-4" />
            Escalation volume (last {windowDays} days)
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground mb-3 text-sm">
            {totals.escalationsInWindow} escalations in the selected window out of{" "}
            {totals.escalationsAllTime} total.
          </p>
          {byType.length === 0 ? (
            <p className="text-muted-foreground text-sm">No escalations in the selected window.</p>
          ) : (
            <ul className="space-y-2">
              {byType.map((row) => (
                <li key={row.type} className="flex items-center gap-3">
                  <span className="min-w-[8rem] truncate text-sm font-medium">{row.type}</span>
                  <div className="bg-muted relative h-3 flex-1 overflow-hidden rounded">
                    <div
                      data-testid={`type-bar-${row.type}`}
                      className="h-full bg-emerald-500"
                      style={{ width: `${(row.count / maxTypeCount) * 100}%` }}
                    />
                  </div>
                  <span className="w-10 text-right text-sm tabular-nums">{row.count}</span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Status mix (all time)</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {byStatus.map((row) => (
              <div
                key={row.status}
                className="flex items-center justify-between rounded border px-3 py-2 text-sm"
              >
                <span className="text-muted-foreground">{row.status.replace(/_/g, " ")}</span>
                <Badge variant="secondary">{row.count}</Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Per society</CardTitle>
        </CardHeader>
        <CardContent>
          {bySociety.length === 0 ? (
            <p className="text-muted-foreground text-sm">No societies in your portfolio yet.</p>
          ) : (
            <ul className="divide-y">
              {bySociety.map((s) => (
                <li key={s.societyId} className="flex items-center gap-3 py-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{s.societyName}</p>
                    <p className="text-muted-foreground text-xs">{s.societyCode}</p>
                  </div>
                  <div className="bg-muted relative hidden h-2 w-28 overflow-hidden rounded sm:block">
                    <div
                      data-testid={`society-bar-${s.societyId}`}
                      className="h-full bg-sky-500"
                      style={{
                        width: `${maxSocietyTotal === 0 ? 0 : (s.total / maxSocietyTotal) * 100}%`,
                      }}
                    />
                  </div>
                  <div className="flex gap-2 text-xs">
                    <Badge variant="outline">Open {s.open}</Badge>
                    <Badge variant="outline">Resolved {s.resolved}</Badge>
                    <Badge variant="secondary">Total {s.total}</Badge>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({
  label,
  value,
  icon,
  tone = "neutral",
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  tone?: "neutral" | "danger";
}) {
  const iconBg = tone === "danger" ? "bg-red-50 text-red-700" : "bg-emerald-50 text-emerald-700";
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <div className={`rounded-md p-2 ${iconBg}`}>{icon}</div>
        <div>
          <p className="text-muted-foreground text-xs">{label}</p>
          <p className="text-2xl font-bold">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}
