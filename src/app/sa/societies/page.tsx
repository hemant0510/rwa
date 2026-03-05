"use client";

import { useState } from "react";

import Link from "next/link";

import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { Plus, Building2, Search } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input } from "@/components/ui/input";
import { TableSkeleton } from "@/components/ui/LoadingSkeleton";
import { PageHeader } from "@/components/ui/PageHeader";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getSocieties } from "@/services/societies";
import { SOCIETY_TYPE_LABELS } from "@/types/society";

const STATUS_COLORS: Record<string, string> = {
  ACTIVE: "border-green-200 bg-green-50 text-green-700",
  TRIAL: "border-yellow-200 bg-yellow-50 text-yellow-700",
  SUSPENDED: "border-red-200 bg-red-50 text-red-700",
  OFFBOARDED: "border-gray-200 bg-gray-50 text-gray-500",
};

export default function SocietiesPage() {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [page, setPage] = useState(1);

  const { data, isLoading } = useQuery({
    queryKey: ["societies", { search, status: statusFilter, page }],
    queryFn: () =>
      getSocieties({
        search: search || undefined,
        status: statusFilter === "all" ? undefined : statusFilter,
        page,
      }),
  });

  return (
    <div className="space-y-6">
      <PageHeader title="Societies" description="Manage all registered societies">
        <Link href="/sa/societies/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Onboard New
          </Button>
        </Link>
      </PageHeader>

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
          <Input
            placeholder="Search by name, code, or city..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="pl-9"
          />
        </div>
        <Select
          value={statusFilter}
          onValueChange={(v) => {
            setStatusFilter(v);
            setPage(1);
          }}
        >
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="All Statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="ACTIVE">Active</SelectItem>
            <SelectItem value="TRIAL">Trial</SelectItem>
            <SelectItem value="SUSPENDED">Suspended</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <TableSkeleton rows={5} />
      ) : !data?.data?.length ? (
        <EmptyState
          icon={<Building2 className="text-muted-foreground h-8 w-8" />}
          title="No societies found"
          description={
            search ? "Try adjusting your search." : "Onboard your first society to get started."
          }
          action={
            !search ? (
              <Link href="/sa/societies/new">
                <Button>Onboard Society</Button>
              </Link>
            ) : undefined
          }
        />
      ) : (
        <>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead className="hidden md:table-cell">Type</TableHead>
                  <TableHead className="hidden sm:table-cell">City</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="hidden lg:table-cell">Onboarded</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.data.map((society) => (
                  <TableRow key={society.id}>
                    <TableCell>
                      <Link
                        href={`/sa/societies/${society.id}`}
                        className="font-medium hover:underline"
                      >
                        {society.name}
                      </Link>
                      <p className="text-muted-foreground text-xs">{society.societyCode}</p>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      {SOCIETY_TYPE_LABELS[society.type] || society.type}
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">
                      {society.city}, {society.state}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={STATUS_COLORS[society.status] || ""}>
                        {society.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      {format(new Date(society.onboardingDate), "dd MMM yyyy")}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {data.total > 20 && (
            <div className="flex items-center justify-between">
              <p className="text-muted-foreground text-sm">
                Showing {(page - 1) * 20 + 1}-{Math.min(page * 20, data.total)} of {data.total}
              </p>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page === 1}
                  onClick={() => setPage((p) => p - 1)}
                >
                  Previous
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={page * 20 >= data.total}
                  onClick={() => setPage((p) => p + 1)}
                >
                  Next
                </Button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
