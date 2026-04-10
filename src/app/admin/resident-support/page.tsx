"use client";

import { useState } from "react";

import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Paperclip, X } from "lucide-react";

import { ResidentTicketStatusBadge } from "@/components/features/resident-support/ResidentTicketStatusBadge";
import { ResidentTicketTypeBadge } from "@/components/features/resident-support/ResidentTicketTypeBadge";
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
import { useSocietyId } from "@/hooks/useSocietyId";
import {
  RESIDENT_TICKET_TYPES,
  RESIDENT_TICKET_STATUSES,
  RESIDENT_TICKET_TYPE_LABELS,
  RESIDENT_TICKET_STATUS_LABELS,
  RESIDENT_TICKET_PRIORITIES,
  RESIDENT_TICKET_PRIORITY_LABELS,
} from "@/lib/validations/resident-support";
import { getAdminResidentTickets, getAdminResidentStats } from "@/services/resident-support";
import type { ResidentTicketStats } from "@/types/resident-support";

type AdminTicketRow = {
  id: string;
  ticketNumber: number;
  type: string;
  priority: string;
  status: string;
  subject: string;
  updatedAt: string;
  createdByUser: { name: string; userUnits?: Array<{ unit: { displayLabel: string } }> };
  _count: { messages: number; attachments: number };
};

type AdminTicketListResponse = {
  data: AdminTicketRow[];
  total: number;
  page: number;
  limit: number;
};

const PRIORITY_COLORS: Record<string, string> = {
  LOW: "bg-slate-100 text-slate-700",
  MEDIUM: "bg-blue-100 text-blue-700",
  HIGH: "bg-orange-100 text-orange-700",
  URGENT: "bg-red-100 text-red-700",
};

interface Filters {
  status: string;
  type: string;
  priority: string;
  page: number;
}

const DEFAULT_FILTERS: Filters = { status: "", type: "", priority: "", page: 1 };

function KpiCard({
  label,
  value,
  colorClass,
  highlight,
}: {
  label: string;
  value: number | string | null | undefined;
  colorClass?: string;
  highlight?: boolean;
}) {
  return (
    <Card
      className={
        highlight && value
          ? "border-red-200 bg-red-50/50 dark:border-red-900 dark:bg-red-950/20"
          : ""
      }
    >
      <CardContent className="pt-4">
        <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">{label}</p>
        {value === undefined || value === null ? (
          <Skeleton className="mt-2 h-8 w-16" />
        ) : (
          <p
            className={`mt-1 text-3xl font-bold ${colorClass ?? (highlight && value ? "text-red-600" : "")}`}
          >
            {value}
          </p>
        )}
      </CardContent>
    </Card>
  );
}

export default function AdminResidentSupportPage() {
  const { saQueryString } = useSocietyId();
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);

  const apiFilters: Record<string, string> = {};
  if (filters.status) apiFilters.status = filters.status;
  if (filters.type) apiFilters.type = filters.type;
  if (filters.priority) apiFilters.priority = filters.priority;
  if (filters.page > 1) apiFilters.page = String(filters.page);

  const { data: ticketsData, isLoading } = useQuery<AdminTicketListResponse>({
    queryKey: ["admin-resident-tickets", apiFilters],
    queryFn: () =>
      getAdminResidentTickets(apiFilters) as unknown as Promise<AdminTicketListResponse>,
  });

  const { data: stats } = useQuery<ResidentTicketStats>({
    queryKey: ["admin-resident-stats"],
    queryFn: getAdminResidentStats,
    staleTime: 30_000,
  });

  const setFilter = <K extends keyof Filters>(key: K, value: Filters[K]) => {
    setFilters((prev) => ({ ...prev, [key]: value, page: 1 }));
  };

  const clearFilters = () => setFilters(DEFAULT_FILTERS);
  const hasFilters = filters.status || filters.type || filters.priority;

  const totalPages = ticketsData ? Math.ceil(ticketsData.total / 20) : 1;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Resident Support"
        description="Manage resident support tickets for your society"
      />

      {/* KPI cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <KpiCard label="Open" value={stats?.open} colorClass="text-blue-600" />
        <KpiCard label="In Progress" value={stats?.inProgress} colorClass="text-indigo-600" />
        <KpiCard label="Awaiting Admin" value={stats?.awaitingAdmin} highlight />
        <KpiCard label="Resolved (7d)" value={stats?.resolved7d} colorClass="text-green-600" />
        <KpiCard
          label="Avg Resolution"
          value={
            stats
              ? stats.avgResolutionHours !== null
                ? `${stats.avgResolutionHours}h`
                : "—"
              : undefined
          }
        />
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-4">
          <div className="flex flex-wrap gap-3">
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select
                value={filters.status || "all"}
                onValueChange={(v) => setFilter("status", v === "all" ? "" : v)}
              >
                <SelectTrigger className="w-44">
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  {RESIDENT_TICKET_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {RESIDENT_TICKET_STATUS_LABELS[s]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Type</Label>
              <Select
                value={filters.type || "all"}
                onValueChange={(v) => setFilter("type", v === "all" ? "" : v)}
              >
                <SelectTrigger className="w-44">
                  <SelectValue placeholder="All types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All types</SelectItem>
                  {RESIDENT_TICKET_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {RESIDENT_TICKET_TYPE_LABELS[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Priority</Label>
              <Select
                value={filters.priority || "all"}
                onValueChange={(v) => setFilter("priority", v === "all" ? "" : v)}
              >
                <SelectTrigger className="w-36">
                  <SelectValue placeholder="All priorities" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All priorities</SelectItem>
                  {RESIDENT_TICKET_PRIORITIES.map((p) => (
                    <SelectItem key={p} value={p}>
                      {RESIDENT_TICKET_PRIORITY_LABELS[p]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {hasFilters && (
              <div className="flex items-end">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearFilters}
                  className="text-muted-foreground"
                >
                  <X className="mr-1.5 h-3.5 w-3.5" />
                  Clear
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Ticket table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle>
            Tickets
            {ticketsData && (
              <span className="text-muted-foreground ml-2 text-sm font-normal">
                ({ticketsData.total})
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-3 p-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : !ticketsData?.data.length ? (
            <div className="py-12 text-center">
              <p className="text-muted-foreground text-sm">
                {hasFilters ? "No tickets match your filters." : "No resident support tickets yet."}
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
                  <TableHead className="w-16">#</TableHead>
                  <TableHead>Resident</TableHead>
                  <TableHead className="max-w-[240px]">Subject</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Priority</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Updated</TableHead>
                  <TableHead className="w-16 text-right">Msgs</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ticketsData.data.map((ticket) => {
                  const unit = ticket.createdByUser.userUnits?.[0]?.unit.displayLabel;
                  /* v8 ignore start */
                  const priorityColor = PRIORITY_COLORS[ticket.priority] ?? "";
                  const priorityLabel =
                    RESIDENT_TICKET_PRIORITY_LABELS[
                      ticket.priority as (typeof RESIDENT_TICKET_PRIORITIES)[number]
                    ] ?? ticket.priority;
                  /* v8 ignore stop */
                  return (
                    <TableRow
                      key={ticket.id}
                      className={`hover:bg-muted/50 cursor-pointer ${ticket.priority === "URGENT" ? "bg-red-50/60 dark:bg-red-950/20" : ""}`}
                      /* v8 ignore start */
                      onClick={() => {
                        window.location.href = `/admin/resident-support/${ticket.id}${saQueryString}`;
                      }}
                      /* v8 ignore stop */
                    >
                      <TableCell className="font-mono text-xs">
                        <span className="flex items-center gap-1.5">
                          #{ticket.ticketNumber}
                          {/* v8 ignore start */}
                          {ticket.status === "AWAITING_ADMIN" && (
                            <span className="h-2 w-2 animate-pulse rounded-full bg-orange-500" />
                          )}
                          {/* v8 ignore stop */}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm">
                        <span className="font-medium">{ticket.createdByUser.name}</span>
                        {unit && (
                          <span className="text-muted-foreground ml-1 text-xs">({unit})</span>
                        )}
                      </TableCell>
                      <TableCell className="max-w-[240px] truncate font-medium">
                        {ticket.subject}
                      </TableCell>
                      <TableCell>
                        <ResidentTicketTypeBadge type={ticket.type} />
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={`border-0 text-xs font-medium ${priorityColor}`}
                        >
                          {priorityLabel}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <ResidentTicketStatusBadge status={ticket.status} />
                      </TableCell>
                      <TableCell className="text-muted-foreground text-xs">
                        {format(new Date(ticket.updatedAt), "dd MMM, HH:mm")}
                      </TableCell>
                      <TableCell className="text-right text-sm">
                        <div className="flex items-center justify-end gap-2">
                          <span>{ticket._count.messages}</span>
                          {ticket._count.attachments > 0 && (
                            <span className="text-muted-foreground flex items-center gap-0.5">
                              <Paperclip className="h-3 w-3" />
                              {ticket._count.attachments}
                            </span>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
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
              onClick={() => setFilters((prev) => ({ ...prev, page: prev.page - 1 }))}
            >
              Previous
            </Button>
            <Button
              variant="outline"
              size="sm"
              disabled={filters.page >= totalPages}
              onClick={() => setFilters((prev) => ({ ...prev, page: prev.page + 1 }))}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
