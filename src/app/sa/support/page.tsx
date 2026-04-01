"use client";

import { useState } from "react";

import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Loader2, RefreshCw, X } from "lucide-react";

import { PriorityBadge } from "@/components/features/support/PriorityBadge";
import { SupportStatusBadge } from "@/components/features/support/StatusBadge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/ui/PageHeader";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

const PRIORITY_ROW_COLORS: Record<string, string> = {
  URGENT: "bg-red-50/60 hover:bg-red-50 dark:bg-red-950/20 dark:hover:bg-red-950/30",
  HIGH: "hover:bg-muted/50",
  MEDIUM: "hover:bg-muted/50",
  LOW: "hover:bg-muted/50",
};

interface Filters {
  status: string;
  type: string;
  priority: string;
  societyId: string;
  search: string;
  page: number;
}

const DEFAULT_FILTERS: Filters = {
  status: "",
  type: "",
  priority: "",
  societyId: "",
  search: "",
  page: 1,
};

export default function SASupportPage() {
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);

  const {
    data: stats,
    isLoading: statsLoading,
    refetch: refetchStats,
    isFetching,
  } = useQuery({
    queryKey: ["sa-support-stats"],
    queryFn: getSAStats,
  });

  const apiFilters: Record<string, string> = {};
  if (filters.status) apiFilters.status = filters.status;
  if (filters.type) apiFilters.type = filters.type;
  if (filters.priority) apiFilters.priority = filters.priority;
  if (filters.societyId) apiFilters.societyId = filters.societyId;
  if (filters.page > 1) apiFilters.page = String(filters.page);

  const {
    data,
    isLoading: listLoading,
    refetch: refetchList,
  } = useQuery({
    queryKey: ["sa-support-list", apiFilters],
    queryFn: () => getSARequests(apiFilters),
  });

  const setFilter = <K extends keyof Filters>(key: K, value: Filters[K]) => {
    setFilters((prev) => ({ ...prev, [key]: value, page: 1 }));
  };

  const clearFilters = () => {
    setFilters(DEFAULT_FILTERS);
  };

  const hasFilters = filters.status || filters.type || filters.priority || filters.societyId;

  const kpis = [
    { label: "Open", value: stats?.open ?? 0, color: "text-blue-600" },
    { label: "In Progress", value: stats?.inProgress ?? 0, color: "text-yellow-600" },
    {
      label: "Awaiting SA",
      value: stats?.awaitingSA ?? 0,
      color: (stats?.awaitingSA ?? 0) > 0 ? "text-red-600" : "text-muted-foreground",
    },
    { label: "Resolved (7d)", value: stats?.resolved7d ?? 0, color: "text-green-600" },
    {
      label: "Avg Resolution",
      value:
        stats?.avgResolutionHours != null
          ? `${Math.round(stats.avgResolutionHours as number)}h`
          : "—",
      color: "text-muted-foreground",
    },
  ];

  const totalPages = data ? Math.ceil(data.total / 50) : 1;

  return (
    <div className="space-y-6">
      <PageHeader title="Support Queue" description="Manage support requests from all societies">
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            refetchStats();
            refetchList();
          }}
        >
          {isFetching ? (
            <Loader2 className="mr-1 h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="mr-1 h-4 w-4" />
          )}
          Refresh
        </Button>
      </PageHeader>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-5">
        {statsLoading
          ? Array.from({ length: 5 }).map((_, i) => (
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
                  <p className={`mt-1 text-2xl font-bold ${kpi.color}`}>{kpi.value}</p>
                </CardContent>
              </Card>
            ))}
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select
                value={filters.status || "all"}
                onValueChange={(v) => setFilter("status", v === "all" ? "" : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="OPEN">Open</SelectItem>
                  <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
                  <SelectItem value="AWAITING_ADMIN">Awaiting Admin</SelectItem>
                  <SelectItem value="AWAITING_SA">Awaiting SA</SelectItem>
                  <SelectItem value="RESOLVED">Resolved</SelectItem>
                  <SelectItem value="CLOSED">Closed</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Type</Label>
              <Select
                value={filters.type || "all"}
                onValueChange={(v) => setFilter("type", v === "all" ? "" : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All types</SelectItem>
                  <SelectItem value="BUG_REPORT">Bug Report</SelectItem>
                  <SelectItem value="FEATURE_REQUEST">Feature Request</SelectItem>
                  <SelectItem value="BILLING_INQUIRY">Billing Inquiry</SelectItem>
                  <SelectItem value="TECHNICAL_SUPPORT">Technical Support</SelectItem>
                  <SelectItem value="ACCOUNT_ISSUE">Account Issue</SelectItem>
                  <SelectItem value="DATA_REQUEST">Data Request</SelectItem>
                  <SelectItem value="COMPLIANCE">Compliance</SelectItem>
                  <SelectItem value="OTHER">Other</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Priority</Label>
              <Select
                value={filters.priority || "all"}
                onValueChange={(v) => setFilter("priority", v === "all" ? "" : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All priorities" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All priorities</SelectItem>
                  <SelectItem value="URGENT">Urgent</SelectItem>
                  <SelectItem value="HIGH">High</SelectItem>
                  <SelectItem value="MEDIUM">Medium</SelectItem>
                  <SelectItem value="LOW">Low</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-end gap-2">
              {hasFilters && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearFilters}
                  className="text-muted-foreground"
                >
                  <X className="mr-1.5 h-3.5 w-3.5" />
                  Clear
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Request Table */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-2">
          <CardTitle>
            All Requests
            {data && (
              <span className="text-muted-foreground ml-2 text-sm font-normal">({data.total})</span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {listLoading ? (
            <div className="space-y-3 p-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : !data?.data.length ? (
            <div className="py-12 text-center">
              <p className="text-muted-foreground text-sm">
                {hasFilters ? "No requests match the current filters." : "No support requests yet."}
              </p>
              {hasFilters && (
                <Button variant="link" size="sm" onClick={clearFilters} className="mt-1">
                  Clear filters
                </Button>
              )}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">#</TableHead>
                  <TableHead>Society</TableHead>
                  <TableHead>Subject</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Last Updated</TableHead>
                  <TableHead className="text-right">Msgs</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.data.map((r) => (
                  <TableRow
                    key={r.id}
                    className={`cursor-pointer ${PRIORITY_ROW_COLORS[r.priority] ?? "hover:bg-muted/50"}`}
                    onClick={() => {
                      window.location.href = `/sa/support/${r.id}`;
                    }}
                  >
                    <TableCell className="font-mono text-xs">{r.requestNumber}</TableCell>
                    <TableCell className="text-sm">{r.society?.name ?? "—"}</TableCell>
                    <TableCell className="max-w-[220px] truncate font-medium">
                      {r.subject}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {r.type.replace(/_/g, " ")}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <PriorityBadge priority={r.priority} />
                    </TableCell>
                    <TableCell>
                      <SupportStatusBadge status={r.status} />
                    </TableCell>
                    <TableCell className="text-muted-foreground text-xs">
                      {format(new Date(r.updatedAt), "dd MMM, HH:mm")}
                    </TableCell>
                    <TableCell className="text-right text-sm">{r._count?.messages ?? 0}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <span className="text-muted-foreground text-sm">
            Page {filters.page} of {totalPages}
          </span>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={filters.page <= 1}
              onClick={() => setFilter("page", filters.page - 1)}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={filters.page >= totalPages}
              onClick={() => setFilter("page", filters.page + 1)}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
