"use client";

import { useState } from "react";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Loader2, Plus, X } from "lucide-react";

import { PriorityBadge } from "@/components/features/support/PriorityBadge";
import { SupportStatusBadge } from "@/components/features/support/StatusBadge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useSocietyId } from "@/hooks/useSocietyId";
import { createRequest, getAdminRequests } from "@/services/support";

interface Filters {
  status: string;
  type: string;
  priority: string;
  page: number;
}

const DEFAULT_FILTERS: Filters = { status: "", type: "", priority: "", page: 1 };

export default function AdminSupportPage() {
  const { saQueryString } = useSocietyId();
  const queryClient = useQueryClient();

  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [showForm, setShowForm] = useState(false);
  const [subject, setSubject] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState("TECHNICAL_SUPPORT");
  const [priority, setPriority] = useState("MEDIUM");

  const apiFilters: Record<string, string> = {};
  if (filters.status) apiFilters.status = filters.status;
  if (filters.type) apiFilters.type = filters.type;
  if (filters.priority) apiFilters.priority = filters.priority;
  if (filters.page > 1) apiFilters.page = String(filters.page);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-support", apiFilters],
    queryFn: () => getAdminRequests(apiFilters),
  });

  const setFilter = <K extends keyof Filters>(key: K, value: Filters[K]) => {
    setFilters((prev) => ({ ...prev, [key]: value, page: 1 }));
  };

  const clearFilters = () => setFilters(DEFAULT_FILTERS);

  const hasFilters = filters.status || filters.type || filters.priority;

  const createMutation = useMutation({
    mutationFn: createRequest,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-support"] });
      setShowForm(false);
      setSubject("");
      setDescription("");
      setType("TECHNICAL_SUPPORT");
      setPriority("MEDIUM");
    },
  });

  const totalPages = data ? Math.ceil(data.total / 20) : 1;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    createMutation.mutate({
      subject,
      description,
      type: type as "TECHNICAL_SUPPORT",
      priority: priority as "MEDIUM",
    });
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Support" description="Raise and track requests with the platform team">
        <Button size="sm" onClick={() => setShowForm(!showForm)}>
          <Plus className="mr-1 h-4 w-4" />
          New Request
        </Button>
      </PageHeader>

      {/* Create form */}
      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>New Support Request</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label>Type</Label>
                  <Select value={type} onValueChange={setType}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
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
                  <Select value={priority} onValueChange={setPriority}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="LOW">Low</SelectItem>
                      <SelectItem value="MEDIUM">Medium</SelectItem>
                      <SelectItem value="HIGH">High</SelectItem>
                      <SelectItem value="URGENT">Urgent</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="subject">Subject</Label>
                <Input
                  id="subject"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="Brief summary (5–200 chars)"
                  required
                  minLength={5}
                  maxLength={200}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Describe the issue in detail (20–5000 chars)"
                  required
                  minLength={20}
                  maxLength={5000}
                  rows={5}
                />
              </div>
              <div className="flex gap-2">
                <Button type="submit" disabled={createMutation.isPending}>
                  {createMutation.isPending && <Loader2 className="mr-1 h-4 w-4 animate-spin" />}
                  Submit Request
                </Button>
                <Button type="button" variant="outline" onClick={() => setShowForm(false)}>
                  Cancel
                </Button>
              </div>
              {createMutation.isError && (
                <p className="text-sm text-red-600">{createMutation.error.message}</p>
              )}
            </form>
          </CardContent>
        </Card>
      )}

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
                <SelectTrigger className="w-40">
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="OPEN">Open</SelectItem>
                  <SelectItem value="IN_PROGRESS">In Progress</SelectItem>
                  <SelectItem value="AWAITING_ADMIN">Awaiting Me</SelectItem>
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
                <SelectTrigger className="w-44">
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
                <SelectTrigger className="w-36">
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

      {/* Request list */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle>
            My Requests
            {data && (
              <span className="text-muted-foreground ml-2 text-sm font-normal">({data.total})</span>
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
          ) : !data?.data.length ? (
            <div className="py-12 text-center">
              <p className="text-muted-foreground text-sm">
                {hasFilters
                  ? "No requests match your filters."
                  : "No support requests yet. Create one to get help from the platform team."}
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
                    className={`hover:bg-muted/50 cursor-pointer ${r.status === "AWAITING_ADMIN" ? "bg-yellow-50/60 dark:bg-yellow-950/20" : ""}`}
                    onClick={() => {
                      window.location.href = `/admin/support/${r.id}${saQueryString}`;
                    }}
                  >
                    <TableCell className="font-mono text-xs">{r.requestNumber}</TableCell>
                    <TableCell className="max-w-[240px] truncate font-medium">
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
