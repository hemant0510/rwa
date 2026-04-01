"use client";

import { useQuery } from "@tanstack/react-query";
import { Loader2, RefreshCw } from "lucide-react";

import { PriorityBadge } from "@/components/features/support/PriorityBadge";
import { SupportStatusBadge } from "@/components/features/support/StatusBadge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/PageHeader";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getSARequests, getSAStats } from "@/services/support";

export default function SASupportPage() {
  const {
    data: stats,
    isLoading: statsLoading,
    refetch: refetchStats,
    isFetching,
  } = useQuery({
    queryKey: ["sa-support-stats"],
    queryFn: getSAStats,
  });

  const { data, isLoading: listLoading } = useQuery({
    queryKey: ["sa-support-list"],
    queryFn: () => getSARequests(),
  });

  const kpis = [
    { label: "Open", value: stats?.open ?? 0 },
    { label: "In Progress", value: stats?.inProgress ?? 0 },
    { label: "Awaiting SA", value: stats?.awaitingSA ?? 0 },
    { label: "Resolved (7d)", value: stats?.resolved7d ?? 0 },
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Support Queue" description="Manage support requests from all societies">
        <Button variant="outline" size="sm" onClick={() => refetchStats()}>
          {isFetching ? (
            <Loader2 className="mr-1 h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="mr-1 h-4 w-4" />
          )}
          Refresh
        </Button>
      </PageHeader>

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {statsLoading
          ? Array.from({ length: 4 }).map((_, i) => (
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
                  <p className="text-muted-foreground text-xs">{kpi.label}</p>
                  <p className="mt-1 text-2xl font-bold">{kpi.value}</p>
                </CardContent>
              </Card>
            ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>All Requests</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {listLoading ? (
            <div className="space-y-3 p-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : !data?.data.length ? (
            <p className="text-muted-foreground py-8 text-center text-sm">No support requests</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>#</TableHead>
                  <TableHead>Society</TableHead>
                  <TableHead>Subject</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Messages</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.data.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell>{r.requestNumber}</TableCell>
                    <TableCell>{r.society?.name ?? "—"}</TableCell>
                    <TableCell className="font-medium">{r.subject}</TableCell>
                    <TableCell className="text-xs">{r.type.replace(/_/g, " ")}</TableCell>
                    <TableCell>
                      <PriorityBadge priority={r.priority} />
                    </TableCell>
                    <TableCell>
                      <SupportStatusBadge status={r.status} />
                    </TableCell>
                    <TableCell>{r._count?.messages ?? 0}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
