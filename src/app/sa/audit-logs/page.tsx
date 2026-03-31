"use client";

import { useState, useCallback } from "react";

import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Download, RefreshCw, Search, X } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/ui/PageHeader";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { AuditLogFilters, AuditLogItem } from "@/services/audit-logs";
import { buildExportUrl, getAuditLogs } from "@/services/audit-logs";

// ─── Action badge colours ─────────────────────────────────────────────────────

function getActionVariant(actionType: string): "default" | "destructive" | "secondary" | "outline" {
  if (
    actionType.includes("CREATED") ||
    actionType.includes("REGISTERED") ||
    actionType.includes("SENT")
  ) {
    return "default"; // green-ish (primary)
  }
  if (
    actionType.includes("DELETED") ||
    actionType.includes("REJECTED") ||
    actionType.includes("REVERSED") ||
    actionType.includes("CANCELLED") ||
    actionType.includes("ARCHIVED") ||
    actionType.includes("REVOKED") ||
    actionType.includes("REMOVED") ||
    actionType.includes("DEACTIVATED")
  ) {
    return "destructive";
  }
  if (actionType.includes("LOGIN") || actionType.includes("LOGOUT")) {
    return "outline";
  }
  return "secondary"; // updates, etc.
}

// ─── Action type groups ───────────────────────────────────────────────────────

const ACTION_GROUPS: Record<string, string[]> = {
  Society: ["SOCIETY_CREATED", "SOCIETY_UPDATED"],
  Residents: ["RESIDENT_REGISTERED", "RESIDENT_APPROVED", "RESIDENT_REJECTED"],
  Fees: ["PAYMENT_RECORDED", "PAYMENT_REVERSED", "EXEMPTION_GRANTED"],
  Expenses: ["EXPENSE_CREATED", "EXPENSE_REVERSED"],
  Events: [
    "EVENT_CREATED",
    "EVENT_UPDATED",
    "EVENT_DELETED",
    "EVENT_PUBLISHED",
    "EVENT_CANCELLED",
    "EVENT_COMPLETED",
    "EVENT_REGISTRATION_CREATED",
    "EVENT_REGISTRATION_CANCELLED",
    "EVENT_PAYMENT_RECORDED",
    "EVENT_EXPENSE_ADDED",
    "EVENT_SETTLED",
    "EVENT_PAYMENT_TRIGGERED",
  ],
  Petitions: [
    "PETITION_CREATED",
    "PETITION_UPDATED",
    "PETITION_DELETED",
    "PETITION_PUBLISHED",
    "PETITION_SUBMITTED",
    "PETITION_CLOSED",
    "PETITION_SIGNED",
    "PETITION_SIGNATURE_REVOKED",
    "PETITION_SIGNATURE_REMOVED",
    "PETITION_DOCUMENT_UPLOADED",
  ],
  Broadcasts: ["BROADCAST_SENT"],
  Auth: ["ADMIN_LOGIN", "ADMIN_LOGOUT"],
  Migration: ["MIGRATION_STARTED", "MIGRATION_COMPLETED"],
  "Super Admin": [
    "SA_PLAN_CREATED",
    "SA_PLAN_UPDATED",
    "SA_PLAN_ARCHIVED",
    "SA_PLAN_REORDERED",
    "SA_BILLING_OPTION_CREATED",
    "SA_BILLING_OPTION_UPDATED",
    "SA_BILLING_OPTION_DELETED",
    "SA_DISCOUNT_CREATED",
    "SA_DISCOUNT_UPDATED",
    "SA_DISCOUNT_DEACTIVATED",
    "SA_REMINDER_SENT",
    "SA_BULK_REMINDERS_SENT",
    "SA_SETTINGS_UPDATED",
  ],
};

const ENTITY_TYPES = [
  "Society",
  "User",
  "PlatformPlan",
  "PlanBillingOption",
  "PlanDiscount",
  "SocietySubscription",
  "SubscriptionPayment",
  "SubscriptionInvoice",
  "FeeSession",
  "FeeRecord",
  "PaymentRecord",
  "FeeExemption",
  "Expense",
  "Event",
  "EventRegistration",
  "Petition",
  "PetitionSignature",
  "Broadcast",
  "MigrationBatch",
  "SuperAdmin",
  "PlatformConfig",
];

// ─── Detail drawer ─────────────────────────────────────────────────────────────

function DetailDrawer({ log, onClose }: { log: AuditLogItem | null; onClose: () => void }) {
  return (
    <Sheet open={!!log} onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>Audit Entry</SheetTitle>
        </SheetHeader>
        {log && (
          <div className="mt-4 space-y-4 text-sm">
            <div className="grid grid-cols-2 gap-x-4 gap-y-2">
              <span className="text-muted-foreground">Timestamp</span>
              <span>{format(new Date(log.createdAt), "dd MMM yyyy HH:mm:ss")}</span>

              <span className="text-muted-foreground">Action</span>
              <Badge variant={getActionVariant(log.actionType)} className="w-fit text-xs">
                {log.actionType}
              </Badge>

              <span className="text-muted-foreground">User</span>
              <span>
                {log.userName ?? "Unknown"}
                {log.userEmail && (
                  <span className="text-muted-foreground block text-xs">{log.userEmail}</span>
                )}
              </span>

              <span className="text-muted-foreground">Entity</span>
              <span>
                {log.entityType}
                <span className="text-muted-foreground block truncate font-mono text-xs">
                  {log.entityId}
                </span>
              </span>

              <span className="text-muted-foreground">Society</span>
              <span>{log.societyName ?? "Platform"}</span>

              {log.ipAddress && (
                <>
                  <span className="text-muted-foreground">IP Address</span>
                  <span className="font-mono">{log.ipAddress}</span>
                </>
              )}
            </div>

            {(log.oldValue !== null || log.newValue !== null) && (
              <div className="space-y-3 border-t pt-3">
                {log.oldValue !== null && (
                  <div>
                    <p className="text-muted-foreground mb-1 text-xs font-medium tracking-wide uppercase">
                      Before
                    </p>
                    <pre className="bg-muted overflow-auto rounded p-2 text-xs">
                      {JSON.stringify(log.oldValue, null, 2)}
                    </pre>
                  </div>
                )}
                {log.newValue !== null && (
                  <div>
                    <p className="text-muted-foreground mb-1 text-xs font-medium tracking-wide uppercase">
                      After
                    </p>
                    <pre className="bg-muted overflow-auto rounded p-2 text-xs">
                      {JSON.stringify(log.newValue, null, 2)}
                    </pre>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}

// ─── Pagination ───────────────────────────────────────────────────────────────

function Pagination({
  page,
  totalPages,
  onPage,
}: {
  page: number;
  totalPages: number;
  onPage: (p: number) => void;
}) {
  if (totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-between border-t pt-4">
      <span className="text-muted-foreground text-sm">
        Page {page} of {totalPages}
      </span>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => onPage(page - 1)}>
          Previous
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={page >= totalPages}
          onClick={() => onPage(page + 1)}
        >
          Next
        </Button>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const today = new Date();
const sevenDaysAgo = new Date(today);
sevenDaysAgo.setDate(today.getDate() - 7);

const DEFAULT_FROM = sevenDaysAgo.toISOString().slice(0, 10);
const DEFAULT_TO = today.toISOString().slice(0, 10);

export default function AuditLogsPage() {
  const [filters, setFilters] = useState<AuditLogFilters>({
    from: DEFAULT_FROM,
    to: DEFAULT_TO,
    page: 1,
    limit: 50,
  });
  const [selectedLog, setSelectedLog] = useState<AuditLogItem | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [userSearch, setUserSearch] = useState("");

  const queryKey = ["audit-logs", filters];

  const { data, isLoading, isFetching, refetch } = useQuery({
    queryKey,
    queryFn: () => getAuditLogs(filters),
    refetchInterval: autoRefresh ? 30_000 : false,
  });

  const setFilter = useCallback(
    <K extends keyof AuditLogFilters>(key: K, value: AuditLogFilters[K]) => {
      setFilters((prev) => ({ ...prev, [key]: value, page: 1 }));
    },
    [],
  );

  const clearFilters = useCallback(() => {
    setFilters({ from: DEFAULT_FROM, to: DEFAULT_TO, page: 1, limit: 50 });
    setUserSearch("");
  }, []);

  const handleUserSearch = useCallback(() => {
    setFilter("userId", userSearch || undefined);
  }, [userSearch, setFilter]);

  const exportUrl = buildExportUrl({
    from: filters.from,
    to: filters.to,
    societyId: filters.societyId,
    actionType: filters.actionType,
    userId: filters.userId,
    entityType: filters.entityType,
  });

  const items = data?.items ?? [];
  const totalPages = data?.totalPages ?? 1;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Audit Logs"
        description="Platform-wide activity trail across all societies and admins"
      >
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setAutoRefresh((v) => !v)}
            className={autoRefresh ? "border-green-500 text-green-600" : ""}
          >
            <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${isFetching ? "animate-spin" : ""}`} />
            {autoRefresh ? "Auto-refresh ON" : "Auto-refresh"}
          </Button>
          <Button variant="outline" size="sm" onClick={() => void refetch()}>
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
            Refresh
          </Button>
          <a href={exportUrl} download>
            <Button variant="outline" size="sm">
              <Download className="mr-1.5 h-3.5 w-3.5" />
              Export CSV
            </Button>
          </a>
        </div>
      </PageHeader>

      {/* Filters */}
      <Card>
        <CardContent className="pt-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <div className="space-y-1.5">
              <Label>From</Label>
              <Input
                type="date"
                value={filters.from ?? ""}
                onChange={(e) => setFilter("from", e.target.value || undefined)}
              />
            </div>

            <div className="space-y-1.5">
              <Label>To</Label>
              <Input
                type="date"
                value={filters.to ?? ""}
                onChange={(e) => setFilter("to", e.target.value || undefined)}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Action Type</Label>
              <Select
                value={filters.actionType ?? "all"}
                onValueChange={(v) => setFilter("actionType", v === "all" ? undefined : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All actions" />
                </SelectTrigger>
                <SelectContent className="max-h-80">
                  <SelectItem value="all">All actions</SelectItem>
                  {Object.entries(ACTION_GROUPS).map(([group, actions]) => (
                    <div key={group}>
                      <div className="text-muted-foreground px-2 py-1 text-xs font-semibold uppercase">
                        {group}
                      </div>
                      {actions.map((a) => (
                        <SelectItem key={a} value={a} className="text-xs">
                          {a}
                        </SelectItem>
                      ))}
                    </div>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5">
              <Label>Entity Type</Label>
              <Select
                value={filters.entityType ?? "all"}
                onValueChange={(v) => setFilter("entityType", v === "all" ? undefined : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All entities" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All entities</SelectItem>
                  {ENTITY_TYPES.map((e) => (
                    <SelectItem key={e} value={e} className="text-xs">
                      {e}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1.5 lg:col-span-2">
              <Label>User ID Search</Label>
              <div className="flex gap-2">
                <Input
                  placeholder="Paste user or super admin ID…"
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleUserSearch()}
                />
                <Button variant="outline" size="icon" onClick={handleUserSearch}>
                  <Search className="h-4 w-4" />
                </Button>
                {filters.userId && (
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => {
                      setUserSearch("");
                      setFilter("userId", undefined);
                    }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>

            <div className="flex items-end">
              <Button
                variant="ghost"
                size="sm"
                onClick={clearFilters}
                className="text-muted-foreground"
              >
                <X className="mr-1.5 h-3.5 w-3.5" />
                Clear filters
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Table */}
      <div className="space-y-4">
        {data && (
          <p className="text-muted-foreground text-sm">
            {data.total.toLocaleString()} {data.total === 1 ? "entry" : "entries"} found
          </p>
        )}

        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-40">Timestamp</TableHead>
                <TableHead>User</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Entity</TableHead>
                <TableHead>Society</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 10 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 5 }).map((__, j) => (
                      <TableCell key={j}>
                        <Skeleton className="h-4 w-full" />
                      </TableCell>
                    ))}
                  </TableRow>
                ))
              ) : items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-muted-foreground py-10 text-center">
                    No audit entries found for the selected filters.
                  </TableCell>
                </TableRow>
              ) : (
                items.map((log) => (
                  <TableRow
                    key={log.id}
                    className="cursor-pointer"
                    onClick={() => setSelectedLog(log)}
                  >
                    <TableCell className="font-mono text-xs">
                      {format(new Date(log.createdAt), "dd MMM yyyy HH:mm")}
                    </TableCell>
                    <TableCell>
                      <div className="text-sm font-medium">{log.userName ?? "Unknown"}</div>
                      {log.userEmail && (
                        <div className="text-muted-foreground text-xs">{log.userEmail}</div>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={getActionVariant(log.actionType)} className="text-xs">
                        {log.actionType}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="text-sm">{log.entityType}</div>
                      <div className="text-muted-foreground max-w-[120px] truncate font-mono text-xs">
                        {log.entityId}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm">{log.societyName ?? "Platform"}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>

        <Pagination
          page={filters.page ?? 1}
          totalPages={totalPages}
          onPage={(p) => setFilters((prev) => ({ ...prev, page: p }))}
        />
      </div>

      <DetailDrawer log={selectedLog} onClose={() => setSelectedLog(null)} />
    </div>
  );
}
