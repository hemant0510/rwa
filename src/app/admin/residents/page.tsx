"use client";

import { useState } from "react";

import Link from "next/link";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import { Users, Search, CheckCircle, XCircle } from "lucide-react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/EmptyState";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { useSocietyId } from "@/hooks/useSocietyId";
import { getResidents, approveResident, rejectResident } from "@/services/residents";
import { RESIDENT_STATUS_LABELS } from "@/types/user";

const STATUS_COLORS: Record<string, string> = {
  PENDING_APPROVAL: "border-yellow-200 bg-yellow-50 text-yellow-700",
  ACTIVE_PAID: "border-green-200 bg-green-50 text-green-700",
  ACTIVE_PENDING: "border-blue-200 bg-blue-50 text-blue-700",
  ACTIVE_OVERDUE: "border-red-200 bg-red-50 text-red-700",
  ACTIVE_PARTIAL: "border-orange-200 bg-orange-50 text-orange-700",
  ACTIVE_EXEMPTED: "border-purple-200 bg-purple-50 text-purple-700",
  REJECTED: "border-gray-200 bg-gray-50 text-gray-500",
};

export default function ResidentsPage() {
  const { societyId } = useSocietyId();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [rejectDialog, setRejectDialog] = useState<{ open: boolean; id: string }>({
    open: false,
    id: "",
  });
  const [rejectReason, setRejectReason] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["residents", societyId, { search, status: statusFilter, page }],
    queryFn: () =>
      getResidents(societyId, {
        search: search || undefined,
        status: statusFilter === "all" ? undefined : statusFilter,
        page,
      }),
    enabled: !!societyId,
  });

  const approveMutation = useMutation({
    mutationFn: approveResident,
    onSuccess: () => {
      toast.success("Resident approved!");
      queryClient.invalidateQueries({ queryKey: ["residents"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const rejectMutation = useMutation({
    mutationFn: ({ id, reason }: { id: string; reason: string }) => rejectResident(id, reason),
    onSuccess: () => {
      toast.success("Resident rejected");
      setRejectDialog({ open: false, id: "" });
      setRejectReason("");
      queryClient.invalidateQueries({ queryKey: ["residents"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <div className="space-y-6">
      <PageHeader title="Residents" description="Manage society residents" />

      <div className="flex flex-col gap-3 sm:flex-row">
        <div className="relative flex-1">
          <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
          <Input
            placeholder="Search by name or mobile..."
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
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="All Statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="PENDING_APPROVAL">Pending Approval</SelectItem>
            <SelectItem value="ACTIVE_PAID">Active (Paid)</SelectItem>
            <SelectItem value="ACTIVE_PENDING">Active (Pending)</SelectItem>
            <SelectItem value="ACTIVE_OVERDUE">Active (Overdue)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <TableSkeleton rows={5} />
      ) : !data?.data?.length ? (
        <EmptyState
          icon={<Users className="text-muted-foreground h-8 w-8" />}
          title="No residents found"
          description={
            search
              ? "Try adjusting your search."
              : "Residents will appear here after they register."
          }
        />
      ) : (
        <>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead className="hidden sm:table-cell">Mobile</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="hidden md:table-cell">RWAID</TableHead>
                  <TableHead className="hidden lg:table-cell">Registered</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.data.map((resident) => (
                  <TableRow key={resident.id}>
                    <TableCell>
                      <Link
                        href={`/admin/residents/${resident.id}`}
                        className="font-medium hover:underline"
                      >
                        {resident.name}
                      </Link>
                      <p className="text-muted-foreground text-xs sm:hidden">{resident.mobile}</p>
                    </TableCell>
                    <TableCell className="hidden sm:table-cell">{resident.mobile}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={STATUS_COLORS[resident.status] || ""}>
                        {RESIDENT_STATUS_LABELS[resident.status] || resident.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden font-mono text-xs md:table-cell">
                      {resident.rwaid || "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground hidden text-sm lg:table-cell">
                      {format(new Date(resident.registeredAt), "dd MMM yyyy")}
                    </TableCell>
                    <TableCell className="text-right">
                      {resident.status === "PENDING_APPROVAL" && (
                        <div className="flex justify-end gap-1">
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 text-green-600 hover:text-green-700"
                            onClick={() => approveMutation.mutate(resident.id)}
                            disabled={approveMutation.isPending}
                          >
                            <CheckCircle className="mr-1 h-4 w-4" />
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-8 text-red-600 hover:text-red-700"
                            onClick={() => setRejectDialog({ open: true, id: resident.id })}
                          >
                            <XCircle className="mr-1 h-4 w-4" />
                            Reject
                          </Button>
                        </div>
                      )}
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

      <Dialog
        open={rejectDialog.open}
        onOpenChange={(open) => setRejectDialog({ open, id: open ? rejectDialog.id : "" })}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Resident</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="rejectReason">Reason for rejection</Label>
            <Input
              id="rejectReason"
              placeholder="e.g., Duplicate registration, incorrect details"
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectDialog({ open: false, id: "" })}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={rejectReason.length < 5 || rejectMutation.isPending}
              onClick={() => rejectMutation.mutate({ id: rejectDialog.id, reason: rejectReason })}
            >
              Reject
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
