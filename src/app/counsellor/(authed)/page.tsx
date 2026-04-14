"use client";

import Link from "next/link";

import { useQuery } from "@tanstack/react-query";
import { AlertCircle, Building2, Clock, Users } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/EmptyState";
import { CardSkeleton } from "@/components/ui/LoadingSkeleton";
import { PageHeader } from "@/components/ui/PageHeader";
import { getDashboard } from "@/services/counsellor-self";

export default function CounsellorDashboardPage() {
  const { data, isLoading, error } = useQuery({
    queryKey: ["counsellor-dashboard"],
    queryFn: getDashboard,
  });

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Welcome${data ? `, ${data.counsellor.name.split(" ")[0]}` : ""}`}
        description="Portfolio overview across your assigned societies."
      />

      {isLoading && <CardSkeleton />}

      {error && (
        <div className="border-destructive/40 bg-destructive/10 text-destructive rounded-md border p-4 text-sm">
          Failed to load dashboard: {error.message}
        </div>
      )}

      {data && (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Societies"
              value={data.totals.societies}
              icon={<Building2 className="h-4 w-4" />}
            />
            <StatCard
              label="Residents"
              value={data.totals.residents}
              icon={<Users className="h-4 w-4" />}
            />
            <StatCard
              label="Open escalations"
              value={data.totals.openEscalations}
              icon={<AlertCircle className="h-4 w-4" />}
            />
            <StatCard
              label="Pending ack"
              value={data.totals.pendingAck}
              icon={<Clock className="h-4 w-4" />}
            />
          </div>

          {data.societies.length === 0 ? (
            <EmptyState
              title="No societies assigned yet"
              description="Super Admin has not assigned any societies to you."
            />
          ) : (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Your portfolio</CardTitle>
              </CardHeader>
              <CardContent className="divide-y p-0">
                {data.societies.map((s) => (
                  <Link
                    key={s.id}
                    href={`/counsellor/societies/${s.id}`}
                    className="flex items-center justify-between gap-3 px-4 py-3 hover:bg-zinc-50"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate font-medium">{s.name}</span>
                        {s.isPrimary && (
                          <Badge variant="default" className="text-[10px]">
                            Primary
                          </Badge>
                        )}
                      </div>
                      <p className="text-muted-foreground text-xs">
                        {s.societyCode} · {s.city}, {s.state} · {s.totalUnits} units
                      </p>
                    </div>
                    {s.openEscalations > 0 && (
                      <Badge variant="destructive" className="text-[10px]">
                        {s.openEscalations} open
                      </Badge>
                    )}
                  </Link>
                ))}
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

function StatCard({ label, value, icon }: { label: string; value: number; icon: React.ReactNode }) {
  return (
    <Card>
      <CardContent className="flex items-center gap-3 p-4">
        <div className="rounded-md bg-emerald-50 p-2 text-emerald-700">{icon}</div>
        <div>
          <p className="text-muted-foreground text-xs">{label}</p>
          <p className="text-2xl font-bold">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}
