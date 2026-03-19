"use client";

import { useState } from "react";

import Link from "next/link";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  Users,
  Search,
  CheckCircle,
  XCircle,
  Plus,
  Loader2,
  Trash2,
  Mail,
  Upload,
  ChevronLeft,
  ChevronRight,
  FileCheck,
  FileX,
  FileMinus,
} from "lucide-react";
import { toast } from "sonner";

import { BulkUploadDialog } from "@/components/residents/BulkUploadDialog";
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
import { FLOOR_LEVELS } from "@/lib/constants";
import {
  getResidents,
  approveResident,
  rejectResident,
  permanentDeleteResident,
  sendResidentVerificationEmail,
} from "@/services/residents";
import { getSocietyByCode } from "@/services/societies";
import { SOCIETY_TYPE_ADDRESS_FIELDS, type SocietyType } from "@/types/society";
import { RESIDENT_STATUS_LABELS } from "@/types/user";

const STATUS_COLORS: Record<string, string> = {
  PENDING_APPROVAL: "border-yellow-200 bg-yellow-50 text-yellow-700",
  ACTIVE_PAID: "border-green-200 bg-green-50 text-green-700",
  ACTIVE_PENDING: "border-blue-200 bg-blue-50 text-blue-700",
  ACTIVE_OVERDUE: "border-red-200 bg-red-50 text-red-700",
  ACTIVE_PARTIAL: "border-orange-200 bg-orange-50 text-orange-700",
  ACTIVE_EXEMPTED: "border-purple-200 bg-purple-50 text-purple-700",
  REJECTED: "border-gray-200 bg-gray-50 text-gray-500",
  DEACTIVATED: "border-red-300 bg-red-50 text-red-800",
};

const CURRENT_YEAR = new Date().getFullYear();
const YEAR_OPTIONS = Array.from({ length: CURRENT_YEAR - 2019 }, (_, i) => 2020 + i);

/** Generate smart page numbers: e.g. [1, 2, 3, '...', 8, 9, 10] */
function getPageNumbers(current: number, total: number): (number | "...")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  if (current <= 4) return [1, 2, 3, 4, 5, "...", total];
  if (current >= total - 3) return [1, "...", total - 4, total - 3, total - 2, total - 1, total];
  return [1, "...", current - 1, current, current + 1, "...", total];
}

export default function ResidentsPage() {
  const { societyId, societyCode } = useSocietyId();
  const queryClient = useQueryClient();

  // Filters
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [emailVerifiedFilter, setEmailVerifiedFilter] = useState("all");
  const [ownershipFilter, setOwnershipFilter] = useState("all");
  const [yearFilter, setYearFilter] = useState("all");
  const [docFilter, setDocFilter] = useState("all");

  // Pagination
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);

  // Dialogs
  const [rejectDialog, setRejectDialog] = useState<{ open: boolean; id: string }>({
    open: false,
    id: "",
  });
  const [rejectReason, setRejectReason] = useState("");
  const [deleteDialog, setDeleteDialog] = useState<{ open: boolean; id: string; name: string }>({
    open: false,
    id: "",
    name: "",
  });
  const [addDialog, setAddDialog] = useState(false);
  const [bulkUploadOpen, setBulkUploadOpen] = useState(false);

  // Add Resident form state
  const [addForm, setAddForm] = useState({
    fullName: "",
    mobile: "",
    email: "",
    password: "",
    passwordConfirm: "",
    ownershipType: "OWNER" as "OWNER" | "TENANT",
  });
  const [unitFields, setUnitFields] = useState<Record<string, string>>({});
  const [addFormErrors, setAddFormErrors] = useState<Record<string, string>>({});

  // Track which resident's verification email is being sent
  const [sendingVerificationId, setSendingVerificationId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: [
      "residents",
      societyId,
      {
        search,
        status: statusFilter,
        page,
        limit,
        emailVerifiedFilter,
        ownershipFilter,
        yearFilter,
        docFilter,
      },
    ],
    queryFn: () =>
      getResidents(societyId, {
        search: search || undefined,
        status: statusFilter === "all" ? undefined : statusFilter,
        page,
        limit,
        emailVerified:
          emailVerifiedFilter === "all" ? undefined : (emailVerifiedFilter as "true" | "false"),
        ownershipType: ownershipFilter === "all" ? undefined : ownershipFilter,
        year: yearFilter === "all" ? undefined : yearFilter,
        docStatus: docFilter === "all" ? undefined : (docFilter as "none" | "partial" | "full"),
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

  const deleteMutation = useMutation({
    mutationFn: permanentDeleteResident,
    onSuccess: () => {
      toast.success("Resident permanently deleted");
      setDeleteDialog({ open: false, id: "", name: "" });
      queryClient.invalidateQueries({ queryKey: ["residents"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const sendVerificationMutation = useMutation({
    mutationFn: (id: string) => {
      setSendingVerificationId(id);
      return sendResidentVerificationEmail(id);
    },
    onSuccess: () => {
      toast.success("Verification email sent");
      setSendingVerificationId(null);
      queryClient.invalidateQueries({ queryKey: ["residents"] });
    },
    onError: (err: Error) => {
      toast.error(err.message);
      setSendingVerificationId(null);
    },
  });

  // Fetch society type for address fields
  const { data: society } = useQuery({
    queryKey: ["societies", "code", societyCode],
    queryFn: () => getSocietyByCode(societyCode!),
    enabled: !!societyCode,
  });

  const addressFields = society ? SOCIETY_TYPE_ADDRESS_FIELDS[society.type as SocietyType] : null;

  const addMutation = useMutation({
    mutationFn: async () => {
      const errors: Record<string, string> = {};
      if (addForm.fullName.length < 2) errors.fullName = "Name must be at least 2 characters";
      if (!/^[6-9]\d{9}$/.test(addForm.mobile))
        errors.mobile = "Enter a valid 10-digit mobile number";
      if (!addForm.email || !/\S+@\S+\.\S+/.test(addForm.email))
        errors.email = "Enter a valid email address";
      if (addForm.password.length < 8) errors.password = "Password must be at least 8 characters";
      if (addForm.password !== addForm.passwordConfirm)
        errors.passwordConfirm = "Passwords do not match";
      if (Object.keys(errors).length > 0) {
        setAddFormErrors(errors);
        throw new Error("Please fix the highlighted fields");
      }
      setAddFormErrors({});
      const res = await fetch("/api/v1/residents/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          societyCode,
          fullName: addForm.fullName,
          mobile: addForm.mobile,
          email: addForm.email,
          password: addForm.password,
          ownershipType: addForm.ownershipType,
          consentWhatsApp: true,
          unitAddress: Object.keys(unitFields).length > 0 ? unitFields : undefined,
        }),
      });
      if (!res.ok) {
        const err = (await res.json()) as { error?: { message?: string } };
        throw new Error(err.error?.message || "Failed to add resident");
      }
      return (await res.json()) as { id: string };
    },
    onSuccess: () => {
      toast.success("Resident added successfully! They will appear as Pending Approval.");
      setAddDialog(false);
      setAddForm({
        fullName: "",
        mobile: "",
        email: "",
        password: "",
        passwordConfirm: "",
        ownershipType: "OWNER",
      });
      setUnitFields({});
      queryClient.invalidateQueries({ queryKey: ["residents"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  function resetPage() {
    setPage(1);
  }

  const totalPages = data ? Math.ceil(data.total / limit) : 0;
  const pageNumbers = totalPages > 0 ? getPageNumbers(page, totalPages) : [];

  return (
    <div className="space-y-6">
      <PageHeader title="Residents" description="Manage society residents">
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setBulkUploadOpen(true)}>
            <Upload className="mr-2 h-4 w-4" />
            Import
          </Button>
          <Button onClick={() => setAddDialog(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Add Resident
          </Button>
        </div>
      </PageHeader>

      {/* Filters row */}
      <div className="flex flex-wrap gap-3">
        <div className="relative min-w-[200px] flex-1">
          <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
          <Input
            placeholder="Search by name, mobile, email, or RWAID..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              resetPage();
            }}
            className="pl-9"
          />
        </div>

        <Select
          value={statusFilter}
          onValueChange={(v) => {
            setStatusFilter(v);
            resetPage();
          }}
        >
          <SelectTrigger className="w-[170px]">
            <SelectValue placeholder="All Statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="PENDING_APPROVAL">Pending Approval</SelectItem>
            <SelectItem value="ACTIVE_PAID">Active (Paid)</SelectItem>
            <SelectItem value="ACTIVE_PENDING">Active (Pending)</SelectItem>
            <SelectItem value="ACTIVE_OVERDUE">Active (Overdue)</SelectItem>
            <SelectItem value="DEACTIVATED">Deactivated</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={emailVerifiedFilter}
          onValueChange={(v) => {
            setEmailVerifiedFilter(v);
            resetPage();
          }}
        >
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Email Verified" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Email: All</SelectItem>
            <SelectItem value="true">Verified</SelectItem>
            <SelectItem value="false">Not Verified</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={ownershipFilter}
          onValueChange={(v) => {
            setOwnershipFilter(v);
            resetPage();
          }}
        >
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Ownership" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="OWNER">Owner</SelectItem>
            <SelectItem value="TENANT">Tenant</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={yearFilter}
          onValueChange={(v) => {
            setYearFilter(v);
            resetPage();
          }}
        >
          <SelectTrigger className="w-[130px]">
            <SelectValue placeholder="RWA Year" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Years</SelectItem>
            {YEAR_OPTIONS.map((y) => (
              <SelectItem key={y} value={String(y)}>
                {y}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={docFilter}
          onValueChange={(v) => {
            setDocFilter(v);
            resetPage();
          }}
        >
          <SelectTrigger className="w-[155px]">
            <SelectValue placeholder="Documents" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Documents</SelectItem>
            <SelectItem value="full">Fully Verified</SelectItem>
            <SelectItem value="partial">Partial</SelectItem>
            <SelectItem value="none">No Documents</SelectItem>
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
                  <TableHead className="hidden md:table-cell">Ownership</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="hidden md:table-cell">Email</TableHead>
                  <TableHead className="hidden lg:table-cell">Docs</TableHead>
                  <TableHead className="hidden lg:table-cell">RWAID</TableHead>
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
                    <TableCell className="hidden md:table-cell">
                      {resident.ownershipType ? (
                        <Badge
                          variant="outline"
                          className={
                            resident.ownershipType === "OWNER"
                              ? "border-blue-200 bg-blue-50 text-blue-700"
                              : "border-violet-200 bg-violet-50 text-violet-700"
                          }
                        >
                          {resident.ownershipType === "OWNER" ? "Owner" : "Tenant"}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground text-xs">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className={STATUS_COLORS[resident.status] || ""}>
                        {RESIDENT_STATUS_LABELS[resident.status] || resident.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <div className="flex items-center gap-1">
                        <Badge
                          variant="outline"
                          className={
                            resident.isEmailVerified
                              ? "border-green-200 bg-green-50 text-green-700"
                              : "border-amber-200 bg-amber-50 text-amber-700"
                          }
                        >
                          {resident.isEmailVerified ? "Verified" : "Not Verified"}
                        </Badge>
                        {!resident.isEmailVerified && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 px-1.5 text-xs text-blue-600 hover:text-blue-700"
                            title="Send verification email"
                            disabled={sendingVerificationId === resident.id}
                            onClick={() => sendVerificationMutation.mutate(resident.id)}
                          >
                            {sendingVerificationId === resident.id ? (
                              <Loader2 className="h-3 w-3 animate-spin" />
                            ) : (
                              <Mail className="h-3 w-3" />
                            )}
                          </Button>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      <DocStatusBadge
                        hasId={!!resident.idProofUrl}
                        hasOwnership={!!resident.ownershipProofUrl}
                      />
                    </TableCell>
                    <TableCell className="hidden font-mono text-xs lg:table-cell">
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
                      {resident.status === "DEACTIVATED" && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 text-red-600 hover:text-red-700"
                          onClick={() =>
                            setDeleteDialog({
                              open: true,
                              id: resident.id,
                              name: resident.name,
                            })
                          }
                        >
                          <Trash2 className="mr-1 h-4 w-4" />
                          Delete
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-muted-foreground text-sm">
              Showing {data.total === 0 ? 0 : (page - 1) * limit + 1}–
              {Math.min(page * limit, data.total)} of {data.total} residents
            </p>

            <div className="flex items-center gap-3">
              {/* Page size selector */}
              <div className="flex items-center gap-2 text-sm">
                <span className="text-muted-foreground">Show</span>
                <Select
                  value={String(limit)}
                  onValueChange={(v) => {
                    setLimit(Number(v));
                    resetPage();
                  }}
                >
                  <SelectTrigger className="h-8 w-16">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="20">20</SelectItem>
                    <SelectItem value="50">50</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Page number buttons */}
              {totalPages > 1 && (
                <div className="flex items-center gap-1">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 w-8 p-0"
                    disabled={page === 1}
                    onClick={() => setPage((p) => p - 1)}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>

                  {pageNumbers.map((p, i) =>
                    p === "..." ? (
                      <span key={`ellipsis-${i}`} className="text-muted-foreground px-1 text-sm">
                        …
                      </span>
                    ) : (
                      <Button
                        key={p}
                        variant={p === page ? "default" : "outline"}
                        size="sm"
                        className="h-8 w-8 p-0"
                        onClick={() => setPage(p)}
                      >
                        {p}
                      </Button>
                    ),
                  )}

                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 w-8 p-0"
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* Reject Dialog */}
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

      {/* Permanent Delete Dialog */}
      <Dialog
        open={deleteDialog.open}
        onOpenChange={(open) =>
          setDeleteDialog({
            open,
            id: open ? deleteDialog.id : "",
            name: open ? deleteDialog.name : "",
          })
        }
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Permanently Delete Resident</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <p className="text-sm">
              Are you sure you want to permanently delete <strong>{deleteDialog.name}</strong>?
            </p>
            <p className="text-destructive text-sm font-medium">
              This will permanently delete this resident and all their data (fees, payments, units).
              This action cannot be undone.
            </p>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setDeleteDialog({ open: false, id: "", name: "" })}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              disabled={deleteMutation.isPending}
              onClick={() => deleteMutation.mutate(deleteDialog.id)}
            >
              {deleteMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete Permanently
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add Resident Dialog */}
      <Dialog
        open={addDialog}
        onOpenChange={(open) => {
          if (!open) {
            setAddForm({
              fullName: "",
              mobile: "",
              email: "",
              password: "",
              passwordConfirm: "",
              ownershipType: "OWNER",
            });
            setUnitFields({});
            setAddFormErrors({});
          }
          setAddDialog(open);
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Resident</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>
                Full Name <span className="text-destructive">*</span>
              </Label>
              <Input
                placeholder="Enter full name"
                value={addForm.fullName}
                aria-invalid={!!addFormErrors.fullName}
                onChange={(e) => {
                  setAddForm((f) => ({ ...f, fullName: e.target.value }));
                  setAddFormErrors((e2) => {
                    const { fullName: _, ...rest } = e2;
                    return rest;
                  });
                }}
              />
              {addFormErrors.fullName && (
                <p className="text-destructive text-sm">{addFormErrors.fullName}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label>
                Mobile Number <span className="text-destructive">*</span>
              </Label>
              <div className="flex gap-2">
                <span className="bg-muted text-muted-foreground flex items-center rounded-md border px-3 text-sm">
                  +91
                </span>
                <Input
                  placeholder="9876543210"
                  maxLength={10}
                  value={addForm.mobile}
                  aria-invalid={!!addFormErrors.mobile}
                  onChange={(e) => {
                    setAddForm((f) => ({ ...f, mobile: e.target.value }));
                    setAddFormErrors((e2) => {
                      const { mobile: _, ...rest } = e2;
                      return rest;
                    });
                  }}
                />
              </div>
              {addFormErrors.mobile && (
                <p className="text-destructive text-sm">{addFormErrors.mobile}</p>
              )}
            </div>
            <div className="space-y-2">
              <Label>
                Email <span className="text-destructive">*</span>
              </Label>
              <Input
                type="email"
                placeholder="email@example.com"
                autoComplete="off"
                value={addForm.email}
                aria-invalid={!!addFormErrors.email}
                onChange={(e) => {
                  setAddForm((f) => ({ ...f, email: e.target.value }));
                  setAddFormErrors((e2) => {
                    const { email: _, ...rest } = e2;
                    return rest;
                  });
                }}
              />
              {addFormErrors.email && (
                <p className="text-destructive text-sm">{addFormErrors.email}</p>
              )}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label>
                  Password <span className="text-destructive">*</span>
                </Label>
                <Input
                  type="password"
                  placeholder="Min 8 characters"
                  autoComplete="new-password"
                  value={addForm.password}
                  aria-invalid={!!addFormErrors.password}
                  onChange={(e) => {
                    setAddForm((f) => ({ ...f, password: e.target.value }));
                    setAddFormErrors((e2) => {
                      const { password: _, ...rest } = e2;
                      return rest;
                    });
                  }}
                />
                {addFormErrors.password && (
                  <p className="text-destructive text-sm">{addFormErrors.password}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label>
                  Confirm Password <span className="text-destructive">*</span>
                </Label>
                <Input
                  type="password"
                  autoComplete="new-password"
                  value={addForm.passwordConfirm}
                  aria-invalid={!!addFormErrors.passwordConfirm}
                  onChange={(e) => {
                    setAddForm((f) => ({ ...f, passwordConfirm: e.target.value }));
                    setAddFormErrors((e2) => {
                      const { passwordConfirm: _, ...rest } = e2;
                      return rest;
                    });
                  }}
                />
                {addFormErrors.passwordConfirm && (
                  <p className="text-destructive text-sm">{addFormErrors.passwordConfirm}</p>
                )}
              </div>
            </div>
            <div className="space-y-2">
              <Label>
                Ownership Type <span className="text-destructive">*</span>
              </Label>
              <Select
                value={addForm.ownershipType}
                onValueChange={(v) =>
                  setAddForm((f) => ({ ...f, ownershipType: v as "OWNER" | "TENANT" }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="OWNER">Owner</SelectItem>
                  <SelectItem value="TENANT">Tenant</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {addressFields && (
              <div className="bg-muted/30 space-y-3 rounded-md border p-4">
                <p className="text-sm font-medium">Address Details</p>
                <div className="grid gap-3 sm:grid-cols-2">
                  {addressFields.required.map((field) => (
                    <div key={field} className="space-y-1">
                      <Label className="text-xs capitalize">
                        {field.replace(/([A-Z])/g, " $1").trim()} *
                      </Label>
                      {field === "floorLevel" ? (
                        <Select
                          value={unitFields[field] || ""}
                          onValueChange={(v) => setUnitFields((prev) => ({ ...prev, [field]: v }))}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select floor" />
                          </SelectTrigger>
                          <SelectContent>
                            {FLOOR_LEVELS.map((f) => (
                              <SelectItem key={f} value={f}>
                                {f}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      ) : (
                        <Input
                          value={unitFields[field] || ""}
                          onChange={(e) =>
                            setUnitFields((prev) => ({ ...prev, [field]: e.target.value }))
                          }
                        />
                      )}
                    </div>
                  ))}
                  {addressFields.optional.map((field) => (
                    <div key={field} className="space-y-1">
                      <Label className="text-xs capitalize">
                        {field.replace(/([A-Z])/g, " $1").trim()}
                      </Label>
                      <Input
                        value={unitFields[field] || ""}
                        onChange={(e) =>
                          setUnitFields((prev) => ({ ...prev, [field]: e.target.value }))
                        }
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddDialog(false)}>
              Cancel
            </Button>
            <Button
              disabled={
                addForm.fullName.length < 2 ||
                !addForm.email ||
                !addForm.password ||
                addMutation.isPending
              }
              onClick={() => addMutation.mutate()}
            >
              {addMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Add Resident
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk Upload Dialog */}
      {societyCode && (
        <BulkUploadDialog
          open={bulkUploadOpen}
          onOpenChange={setBulkUploadOpen}
          societyCode={societyCode}
          onSuccess={() => queryClient.invalidateQueries({ queryKey: ["residents"] })}
        />
      )}
    </div>
  );
}

function DocStatusBadge({
  hasId,
  hasOwnership,
}: {
  readonly hasId: boolean;
  readonly hasOwnership: boolean;
}) {
  if (hasId && hasOwnership) {
    return (
      <span
        title="Both documents uploaded"
        className="inline-flex items-center gap-1 rounded-full border border-green-200 bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700"
      >
        <FileCheck className="h-3 w-3" />
        Verified
      </span>
    );
  }
  if (hasId || hasOwnership) {
    return (
      <span
        title={
          hasId
            ? "ID proof uploaded, ownership proof missing"
            : "Ownership proof uploaded, ID proof missing"
        }
        className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700"
      >
        <FileMinus className="h-3 w-3" />
        Partial
      </span>
    );
  }
  return (
    <span
      title="No documents uploaded"
      className="inline-flex items-center gap-1 rounded-full border border-red-200 bg-red-50 px-2 py-0.5 text-xs font-medium text-red-600"
    >
      <FileX className="h-3 w-3" />
      None
    </span>
  );
}
