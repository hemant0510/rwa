"use client";

import { use, useState } from "react";

import Link from "next/link";
import { useRouter } from "next/navigation";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { format } from "date-fns";
import {
  ArrowLeft,
  CheckCircle,
  XCircle,
  Phone,
  Mail,
  Home,
  Pencil,
  Trash2,
  Loader2,
  AlertTriangle,
} from "lucide-react";
import { toast } from "sonner";

import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageSkeleton } from "@/components/ui/LoadingSkeleton";
import { PageHeader } from "@/components/ui/PageHeader";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { StatusBadge } from "@/components/ui/StatusBadge";
import {
  getResident,
  approveResident,
  rejectResident,
  updateResident,
  deleteResident,
} from "@/services/residents";
import type { FeeStatus } from "@/types/fee";
import { RESIDENT_STATUS_LABELS } from "@/types/user";

const STATUS_COLORS: Record<string, string> = {
  PENDING_APPROVAL: "border-yellow-200 bg-yellow-50 text-yellow-700",
  ACTIVE_PAID: "border-green-200 bg-green-50 text-green-700",
  ACTIVE_PENDING: "border-blue-200 bg-blue-50 text-blue-700",
  ACTIVE_OVERDUE: "border-red-200 bg-red-50 text-red-700",
  ACTIVE_EXEMPTED: "border-purple-200 bg-purple-50 text-purple-700",
  REJECTED: "border-gray-200 bg-gray-50 text-gray-500",
  DEACTIVATED: "border-red-200 bg-red-50 text-red-700",
};

export default function ResidentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const queryClient = useQueryClient();

  const [editOpen, setEditOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteReason, setDeleteReason] = useState("");

  // Edit form state
  const [editName, setEditName] = useState("");
  const [editMobile, setEditMobile] = useState("");
  const [editEmail, setEditEmail] = useState("");
  const [editOwnership, setEditOwnership] = useState<"OWNER" | "TENANT">("OWNER");

  const { data: resident, isLoading } = useQuery({
    queryKey: ["residents", "detail", id],
    queryFn: () => getResident(id),
  });

  const approveMutation = useMutation({
    mutationFn: () => approveResident(id),
    onSuccess: () => {
      toast.success("Resident approved!");
      queryClient.invalidateQueries({ queryKey: ["residents"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const rejectMutation = useMutation({
    mutationFn: () => rejectResident(id, "Rejected by admin"),
    onSuccess: () => {
      toast.success("Resident rejected");
      queryClient.invalidateQueries({ queryKey: ["residents"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const editMutation = useMutation({
    mutationFn: (data: { name: string; mobile: string; email: string; ownershipType: string }) =>
      updateResident(id, data),
    onSuccess: () => {
      toast.success("Resident updated!");
      setEditOpen(false);
      queryClient.invalidateQueries({ queryKey: ["residents"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (reason: string) => deleteResident(id, reason),
    onSuccess: () => {
      toast.success("Resident deactivated");
      setDeleteOpen(false);
      router.push("/admin/residents");
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const openEditDialog = () => {
    if (!resident) return;
    setEditName(resident.name);
    setEditMobile(resident.mobile || "");
    setEditEmail(resident.email || "");
    setEditOwnership((resident.ownershipType as "OWNER" | "TENANT") || "OWNER");
    setEditOpen(true);
  };

  if (isLoading) return <PageSkeleton />;
  if (!resident) return <p className="text-muted-foreground">Resident not found.</p>;

  // Type assertion for API response which may include extra fields
  const residentData = resident as typeof resident & {
    units?: { id: string; displayLabel: string }[];
    fees?: {
      id: string;
      sessionYear: string;
      amountDue: number;
      amountPaid: number;
      status: string;
    }[];
    society?: { name: string };
    deactivatedAt?: string;
    deactivationReason?: string;
  };

  const isActive = resident.status.startsWith("ACTIVE_");
  const isDeactivated = resident.status === "DEACTIVATED";
  const canEdit = !isDeactivated;
  const canDeactivate = isActive;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/admin/residents">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <PageHeader title={resident.name}>
          <Badge variant="outline" className={STATUS_COLORS[resident.status] || ""}>
            {RESIDENT_STATUS_LABELS[resident.status] || resident.status}
          </Badge>
        </PageHeader>
        <div className="ml-auto flex gap-2">
          {canEdit && (
            <Button variant="outline" size="sm" onClick={openEditDialog}>
              <Pencil className="mr-1 h-4 w-4" />
              Edit
            </Button>
          )}
          {canDeactivate && (
            <Button variant="destructive" size="sm" onClick={() => setDeleteOpen(true)}>
              <Trash2 className="mr-1 h-4 w-4" />
              Deactivate
            </Button>
          )}
        </div>
      </div>

      {isDeactivated && (
        <div className="flex items-start gap-3 rounded-md border border-red-200 bg-red-50 p-4">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-600" />
          <div>
            <p className="font-medium text-red-800">Resident Deactivated</p>
            {residentData.deactivationReason && (
              <p className="mt-1 text-sm text-red-700">Reason: {residentData.deactivationReason}</p>
            )}
            {residentData.deactivatedAt && (
              <p className="text-sm text-red-600">
                On {format(new Date(residentData.deactivatedAt), "dd MMM yyyy, hh:mm a")}
              </p>
            )}
          </div>
        </div>
      )}

      {resident.status === "PENDING_APPROVAL" && (
        <div className="flex gap-3 rounded-md border border-yellow-200 bg-yellow-50 p-4 dark:border-yellow-800 dark:bg-yellow-900/20">
          <div className="flex-1">
            <p className="font-medium text-yellow-800 dark:text-yellow-200">Pending Approval</p>
            <p className="text-sm text-yellow-700 dark:text-yellow-300">
              Review this registration and approve or reject.
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              onClick={() => approveMutation.mutate()}
              disabled={approveMutation.isPending}
            >
              <CheckCircle className="mr-1 h-4 w-4" />
              Approve
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={() => rejectMutation.mutate()}
              disabled={rejectMutation.isPending}
            >
              <XCircle className="mr-1 h-4 w-4" />
              Reject
            </Button>
          </div>
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Personal Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <DetailRow label="RWAID" value={resident.rwaid || "Not assigned"} />
            <DetailRow label="Name" value={resident.name} />
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground flex items-center gap-1 text-sm">
                <Phone className="h-3 w-3" /> Mobile
              </span>
              <span className="text-sm font-medium">{resident.mobile}</span>
            </div>
            {resident.email && (
              <div className="flex items-center justify-between">
                <span className="text-muted-foreground flex items-center gap-1 text-sm">
                  <Mail className="h-3 w-3" /> Email
                </span>
                <span className="text-sm font-medium">{resident.email}</span>
              </div>
            )}
            <DetailRow label="Ownership" value={resident.ownershipType || "—"} />
            <DetailRow
              label="Registered"
              value={format(new Date(resident.registeredAt), "dd MMM yyyy, hh:mm a")}
            />
            {resident.approvedAt && (
              <DetailRow
                label="Approved"
                value={format(new Date(resident.approvedAt), "dd MMM yyyy, hh:mm a")}
              />
            )}
          </CardContent>
        </Card>

        {residentData.units && residentData.units.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Home className="h-4 w-4" />
                Unit Address
              </CardTitle>
            </CardHeader>
            <CardContent>
              {residentData.units.map((unit) => (
                <div key={unit.id} className="bg-muted/30 rounded-md border p-3">
                  <p className="font-mono font-medium">{unit.displayLabel}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        )}
      </div>

      {residentData.fees && residentData.fees.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Fee Records</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {residentData.fees.map((fee) => (
                <div
                  key={fee.id}
                  className="flex items-center justify-between rounded-md border px-4 py-3"
                >
                  <div>
                    <p className="font-medium">{fee.sessionYear}</p>
                    <p className="text-muted-foreground text-sm">
                      Due: {"\u20B9"}
                      {fee.amountDue.toLocaleString("en-IN")} | Paid: {"\u20B9"}
                      {fee.amountPaid.toLocaleString("en-IN")}
                    </p>
                  </div>
                  <StatusBadge status={fee.status as FeeStatus} />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Edit Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Resident</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="editName">Name</Label>
              <Input id="editName" value={editName} onChange={(e) => setEditName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="editMobile">Mobile</Label>
              <Input
                id="editMobile"
                value={editMobile}
                onChange={(e) => setEditMobile(e.target.value)}
                maxLength={10}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="editEmail">Email</Label>
              <Input
                id="editEmail"
                type="email"
                value={editEmail}
                onChange={(e) => setEditEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Ownership Type</Label>
              <Select
                value={editOwnership}
                onValueChange={(v) => setEditOwnership(v as "OWNER" | "TENANT")}
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
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>
              Cancel
            </Button>
            <Button
              disabled={editMutation.isPending || editName.length < 2}
              onClick={() =>
                editMutation.mutate({
                  name: editName,
                  mobile: editMobile,
                  email: editEmail,
                  ownershipType: editOwnership,
                })
              }
            >
              {editMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Save Changes
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Deactivate AlertDialog */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deactivate Resident</AlertDialogTitle>
            <AlertDialogDescription>
              This will deactivate the resident and prevent them from logging in. This action can be
              reversed by a SuperAdmin.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="space-y-2">
            <Label htmlFor="deleteReason">Reason for deactivation</Label>
            <Input
              id="deleteReason"
              placeholder="e.g., Moved out, Non-payment, etc."
              value={deleteReason}
              onChange={(e) => setDeleteReason(e.target.value)}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel
              onClick={() => {
                setDeleteReason("");
              }}
            >
              Cancel
            </AlertDialogCancel>
            <Button
              variant="destructive"
              disabled={deleteReason.length < 5 || deleteMutation.isPending}
              onClick={() => deleteMutation.mutate(deleteReason)}
            >
              {deleteMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Deactivate
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-muted-foreground text-sm">{label}</span>
      <span className="text-sm font-medium">{value}</span>
    </div>
  );
}
