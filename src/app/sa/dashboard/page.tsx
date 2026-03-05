"use client";

import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Building2, CheckCircle, Clock, AlertTriangle } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CardSkeleton } from "@/components/ui/LoadingSkeleton";
import { PageHeader } from "@/components/ui/PageHeader";
import { getSuperAdminStats } from "@/services/super-admin";

export default function SuperAdminDashboardPage() {
  const { data, isLoading } = useQuery({
    queryKey: ["super-admin", "stats"],
    queryFn: getSuperAdminStats,
  });

  return (
    <div className="space-y-6">
      <PageHeader title="Dashboard" description="Overview of all societies on the platform" />

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-4">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="bg-primary/10 rounded-lg p-2">
                  <Building2 className="text-primary h-5 w-5" />
                </div>
                <div>
                  <p className="text-muted-foreground text-sm">Total Societies</p>
                  <p className="text-2xl font-bold">{data?.total ?? 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-green-100 p-2 dark:bg-green-900/30">
                  <CheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
                </div>
                <div>
                  <p className="text-muted-foreground text-sm">Active</p>
                  <p className="text-2xl font-bold">{data?.active ?? 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-yellow-100 p-2 dark:bg-yellow-900/30">
                  <Clock className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
                </div>
                <div>
                  <p className="text-muted-foreground text-sm">Trial</p>
                  <p className="text-2xl font-bold">{data?.trial ?? 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <div className="rounded-lg bg-red-100 p-2 dark:bg-red-900/30">
                  <AlertTriangle className="h-5 w-5 text-red-600 dark:text-red-400" />
                </div>
                <div>
                  <p className="text-muted-foreground text-sm">Suspended</p>
                  <p className="text-2xl font-bold">{data?.suspended ?? 0}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Recently Onboarded</CardTitle>
        </CardHeader>
        <CardContent>
          {!data?.recentSocieties?.length ? (
            <p className="text-muted-foreground text-sm">No societies onboarded yet.</p>
          ) : (
            <div className="space-y-3">
              {data.recentSocieties.map((s) => (
                <div
                  key={s.id}
                  className="flex items-center justify-between rounded-md border px-4 py-3"
                >
                  <div>
                    <p className="font-medium">{s.name}</p>
                    <p className="text-muted-foreground text-sm">{s.city}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <Badge
                      variant="outline"
                      className={
                        s.status === "ACTIVE"
                          ? "border-green-200 bg-green-50 text-green-700"
                          : s.status === "TRIAL"
                            ? "border-yellow-200 bg-yellow-50 text-yellow-700"
                            : "border-red-200 bg-red-50 text-red-700"
                      }
                    >
                      {s.status}
                    </Badge>
                    <span className="text-muted-foreground text-xs">
                      {format(new Date(s.onboardingDate), "dd MMM yyyy")}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
