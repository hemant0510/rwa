"use client";

import { useCallback, useState } from "react";

import Link from "next/link";

import { useQuery } from "@tanstack/react-query";
import { ChevronLeft, ChevronRight, Loader2, Search, Users } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
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
import { getPlatformResidents, type PlatformResidentFilters } from "@/services/operations";

const STATUS_COLORS: Record<string, string> = {
  ACTIVE_PAID: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  ACTIVE_PENDING: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
  ACTIVE_OVERDUE: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  ACTIVE_PARTIAL: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  ACTIVE_EXEMPTED: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  PENDING_APPROVAL: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  REJECTED: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  DEACTIVATED: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
};

function maskMobile(mobile: string | null): string {
  if (!mobile || mobile.length < 4) return mobile ?? "—";
  return "****" + mobile.slice(-4);
}

function formatStatus(status: string): string {
  return status.replace(/_/g, " ");
}

export default function PlatformResidentsPage() {
  const [filters, setFilters] = useState<PlatformResidentFilters>({
    page: 1,
    limit: 50,
  });

  const setFilter = useCallback(
    <K extends keyof PlatformResidentFilters>(key: K, value: PlatformResidentFilters[K]) => {
      setFilters((prev) => ({
        ...prev,
        [key]: value,
        ...(key !== "page" ? { page: 1 } : {}),
      }));
    },
    [],
  );

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ["platform-residents", filters],
    queryFn: () => getPlatformResidents(filters),
  });

  const kpis = data?.kpis;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Platform Residents"
        description="All residents across every society on the platform"
      >
        {isFetching && !isLoading && (
          <Loader2 className="text-muted-foreground h-4 w-4 animate-spin" />
        )}
      </PageHeader>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {isLoading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-4">
                <Skeleton className="mb-2 h-4 w-24" />
                <Skeleton className="h-8 w-16" />
              </CardContent>
            </Card>
          ))
        ) : (
          <>
            <Card>
              <CardContent className="p-4">
                <p className="text-muted-foreground text-sm">Total Residents</p>
                <p className="text-2xl font-bold">{kpis?.totalAll.toLocaleString()}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-muted-foreground text-sm">Active & Paid</p>
                <p className="text-2xl font-bold text-green-600">
                  {kpis?.activePaid.toLocaleString()}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-muted-foreground text-sm">Pending Approval</p>
                <p className="text-2xl font-bold text-amber-600">
                  {kpis?.pending.toLocaleString()}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <p className="text-muted-foreground text-sm">Overdue</p>
                <p className="text-2xl font-bold text-red-600">{kpis?.overdue.toLocaleString()}</p>
              </CardContent>
            </Card>
          </>
        )}
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="flex flex-wrap items-center gap-3 p-4">
          <div className="relative min-w-[200px] flex-1">
            <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
            <Input
              placeholder="Search by name, email, phone, or RWAID..."
              className="pl-9"
              value={filters.search ?? ""}
              onChange={(e) => setFilter("search", e.target.value)}
            />
          </div>
          <Select
            value={filters.status ?? "all"}
            onValueChange={(v) => setFilter("status", v === "all" ? undefined : v)}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="All Statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="ACTIVE">Active</SelectItem>
              <SelectItem value="PENDING">Pending Approval</SelectItem>
              <SelectItem value="OVERDUE">Overdue</SelectItem>
              <SelectItem value="DEACTIVATED">Deactivated</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      {/* Results */}
      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-3 p-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : !data?.data.length ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <Users className="text-muted-foreground mb-4 h-12 w-12" />
              <p className="text-muted-foreground text-lg font-medium">No residents found</p>
              <p className="text-muted-foreground text-sm">Try adjusting your search or filters</p>
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead className="hidden md:table-cell">Email</TableHead>
                    <TableHead className="hidden lg:table-cell">Mobile</TableHead>
                    <TableHead>Society</TableHead>
                    <TableHead className="hidden md:table-cell">Unit</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="hidden lg:table-cell">Registered</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.data.map((resident) => (
                    <TableRow key={resident.id}>
                      <TableCell className="font-medium">
                        {resident.societyId ? (
                          <Link
                            href={`/sa/societies/${resident.societyId}`}
                            className="hover:underline"
                          >
                            {resident.name}
                          </Link>
                        ) : (
                          resident.name
                        )}
                      </TableCell>
                      <TableCell className="hidden md:table-cell">{resident.email}</TableCell>
                      <TableCell className="hidden lg:table-cell">
                        {maskMobile(resident.mobile)}
                      </TableCell>
                      <TableCell>{resident.society?.name ?? "—"}</TableCell>
                      <TableCell className="hidden md:table-cell">
                        {resident.userUnits?.[0]?.unit?.unitNumber ?? "—"}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={`border-0 text-xs font-medium ${STATUS_COLORS[resident.status] ?? ""}`}
                        >
                          {formatStatus(resident.status)}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell">
                        {new Date(resident.createdAt).toLocaleDateString("en-IN", {
                          day: "2-digit",
                          month: "short",
                          year: "numeric",
                        })}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Pagination */}
              <div className="flex items-center justify-between border-t px-4 py-3">
                <p className="text-muted-foreground text-sm">
                  Showing {((data.page - 1) * data.limit + 1).toLocaleString()}–
                  {Math.min(data.page * data.limit, data.total).toLocaleString()} of{" "}
                  {data.total.toLocaleString()}
                </p>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={data.page <= 1}
                    onClick={() => setFilter("page", data.page - 1)}
                  >
                    <ChevronLeft className="mr-1 h-4 w-4" />
                    Previous
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={data.page >= data.totalPages}
                    onClick={() => setFilter("page", data.page + 1)}
                  >
                    Next
                    <ChevronRight className="ml-1 h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
