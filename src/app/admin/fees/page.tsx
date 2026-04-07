"use client";

import { useMemo, useState } from "react";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { CheckCircle, CreditCard, IndianRupee, Loader2, XCircle } from "lucide-react";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CardSkeleton } from "@/components/ui/LoadingSkeleton";
import { PageHeader } from "@/components/ui/PageHeader";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { StatusBadge } from "@/components/ui/StatusBadge";
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
import { maskMobile } from "@/lib/utils";
import { recordPaymentSchema, type RecordPaymentInput } from "@/lib/validations/fee";
import { getAdminPaymentClaims, verifyClaim, rejectClaim } from "@/services/admin-payment-claims";
import { getFeeDashboard, getFeeSessions, recordPayment, grantExemption } from "@/services/fees";
import type { FeeStatus, PaymentMode } from "@/types/fee";
import { PAYMENT_MODE_LABELS } from "@/types/fee";
import type { PaymentClaim } from "@/types/payment";

const FEE_STATUS_OPTIONS = [
  { value: "ALL", label: "All statuses" },
  { value: "PENDING", label: "Pending" },
  { value: "PARTIAL", label: "Partial" },
  { value: "OVERDUE", label: "Overdue" },
  { value: "PAID", label: "Paid" },
  { value: "EXEMPTED", label: "Exempted" },
];

export default function FeesPage() {
  const { societyId } = useSocietyId();
  const queryClient = useQueryClient();
  const [selectedSession, setSelectedSession] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState("ALL");

  const [paymentDialog, setPaymentDialog] = useState<{
    open: boolean;
    feeId: string;
    residentName: string;
    balance: number;
    claim: PaymentClaim | null;
  }>({ open: false, feeId: "", residentName: "", balance: 0, claim: null });

  const [exemptionDialog, setExemptionDialog] = useState<{
    open: boolean;
    feeId: string;
    residentName: string;
  }>({ open: false, feeId: "", residentName: "" });

  const [exemptionReason, setExemptionReason] = useState("");
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");

  const { data: feeSessions } = useQuery({
    queryKey: ["fee-sessions-list"],
    queryFn: getFeeSessions,
  });

  const { data: dashboard, isLoading } = useQuery({
    queryKey: ["fees", societyId, selectedSession],
    queryFn: () => getFeeDashboard(societyId, selectedSession ?? undefined),
    enabled: !!societyId,
  });

  const { data: claimsData } = useQuery({
    queryKey: ["admin-payment-claims", societyId, "PENDING"],
    queryFn: () => getAdminPaymentClaims(societyId, { status: "PENDING" }),
    enabled: !!societyId,
  });

  const claimByFeeId = useMemo(() => {
    const map = new Map<string, PaymentClaim>();
    claimsData?.claims.forEach((c) => {
      if (c.membershipFeeId) map.set(c.membershipFeeId, c);
    });
    return map;
  }, [claimsData]);

  const paymentForm = useForm<RecordPaymentInput>({
    resolver: zodResolver(recordPaymentSchema),
    defaultValues: {
      amount: 0,
      paymentMode: "UPI",
      paymentDate: new Date().toISOString().split("T")[0],
      referenceNo: "",
      notes: "",
    },
  });
  const paymentMode = useWatch({ control: paymentForm.control, name: "paymentMode" });

  const paymentMutation = useMutation({
    mutationFn: (data: RecordPaymentInput) => recordPayment(societyId, paymentDialog.feeId, data),
    onSuccess: () => {
      toast.success("Payment recorded!");
      setPaymentDialog({ open: false, feeId: "", residentName: "", balance: 0, claim: null });
      paymentForm.reset();
      queryClient.invalidateQueries({ queryKey: ["fees"] });
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const verifyMutation = useMutation({
    mutationFn: ({ claimId }: { claimId: string }) => verifyClaim(societyId, claimId),
    onSuccess: () => {
      toast.success("Payment claim verified");
      setPaymentDialog({ open: false, feeId: "", residentName: "", balance: 0, claim: null });
      queryClient.invalidateQueries({ queryKey: ["fees"] });
      queryClient.invalidateQueries({ queryKey: ["admin-payment-claims"] });
      queryClient.invalidateQueries({ queryKey: ["fees-pending-count"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const rejectMutation = useMutation({
    mutationFn: ({ claimId, reason }: { claimId: string; reason: string }) =>
      rejectClaim(societyId, claimId, reason),
    onSuccess: () => {
      toast.success("Payment claim rejected");
      setShowRejectForm(false);
      setRejectionReason("");
      queryClient.invalidateQueries({ queryKey: ["admin-payment-claims"] });
      queryClient.invalidateQueries({ queryKey: ["fees-pending-count"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const exemptionMutation = useMutation({
    mutationFn: () => grantExemption(societyId, exemptionDialog.feeId, { reason: exemptionReason }),
    onSuccess: () => {
      toast.success("Exemption granted!");
      setExemptionDialog({ open: false, feeId: "", residentName: "" });
      setExemptionReason("");
      queryClient.invalidateQueries({ queryKey: ["fees"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const claimActionPending = verifyMutation.isPending || rejectMutation.isPending;

  return (
    <div className="space-y-6">
      <PageHeader title="Fee Management" description="Track and manage membership fees" />

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <Select
          value={selectedSession ?? "current"}
          onValueChange={(v) => setSelectedSession(v === "current" ? null : v)}
        >
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="current">Current session</SelectItem>
            {feeSessions
              ?.filter((s) => s.sessionYear !== "current")
              .map((s) => (
                <SelectItem key={s.id} value={s.sessionYear}>
                  {s.sessionYear}
                </SelectItem>
              ))}
          </SelectContent>
        </Select>

        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {FEE_STATUS_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
      ) : dashboard ? (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="bg-primary/10 rounded-lg p-2">
                    <IndianRupee className="text-primary h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-muted-foreground text-sm">Total Due</p>
                    <p className="text-2xl font-bold">
                      {"\u20B9"}
                      {dashboard.totalDue.toLocaleString("en-IN")}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-3">
                  <div className="rounded-lg bg-green-100 p-2 dark:bg-green-900/30">
                    <CreditCard className="h-5 w-5 text-green-600" />
                  </div>
                  <div>
                    <p className="text-muted-foreground text-sm">Collected</p>
                    <p className="text-2xl font-bold">
                      {"\u20B9"}
                      {dashboard.totalCollected.toLocaleString("en-IN")}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <p className="text-muted-foreground mb-1 text-sm">Collection Rate</p>
                <p className="text-2xl font-bold">{dashboard.collectionRate}%</p>
                <Progress value={dashboard.collectionRate} className="mt-2" />
              </CardContent>
            </Card>
          </div>

          {dashboard.fees && dashboard.fees.length > 0 ? (
            (() => {
              const filteredFees = dashboard.fees.filter(
                (fee) => statusFilter === "ALL" || fee.status === statusFilter,
              );
              return filteredFees.length > 0 ? (
                <div className="rounded-md border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Resident</TableHead>
                        <TableHead className="hidden sm:table-cell">RWAID</TableHead>
                        <TableHead>Due</TableHead>
                        <TableHead>Paid</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {filteredFees.map((fee) => {
                        const claim = claimByFeeId.get(fee.id) ?? null;
                        return (
                          <TableRow key={fee.id}>
                            <TableCell>
                              <p className="font-medium">{fee.user.name}</p>
                              <p className="text-muted-foreground text-xs sm:hidden">
                                {maskMobile(fee.user.mobile)}
                              </p>
                            </TableCell>
                            <TableCell className="hidden font-mono text-xs sm:table-cell">
                              {fee.user.rwaid || "—"}
                            </TableCell>
                            <TableCell>
                              {"\u20B9"}
                              {Number(fee.amountDue).toLocaleString("en-IN")}
                            </TableCell>
                            <TableCell>
                              {"\u20B9"}
                              {Number(fee.amountPaid).toLocaleString("en-IN")}
                            </TableCell>
                            <TableCell>
                              <div className="flex flex-col gap-1">
                                <StatusBadge status={fee.status as FeeStatus} />
                                {claim && (
                                  <Badge
                                    variant="outline"
                                    className="w-fit border-amber-300 bg-amber-50 text-xs text-amber-700 dark:border-amber-700 dark:bg-amber-950/30 dark:text-amber-400"
                                  >
                                    UPI Claim
                                  </Badge>
                                )}
                              </div>
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-1">
                                {fee.status !== "PAID" && fee.status !== "EXEMPTED" && (
                                  <Button
                                    size="sm"
                                    variant={claim ? "default" : "ghost"}
                                    className="h-8"
                                    onClick={() => {
                                      setShowRejectForm(false);
                                      setRejectionReason("");
                                      paymentForm.reset({
                                        amount: Number(fee.balance),
                                        paymentMode: "UPI",
                                        paymentDate: new Date().toISOString().split("T")[0],
                                        referenceNo: claim?.utrNumber ?? "",
                                        notes: "",
                                      });
                                      setPaymentDialog({
                                        open: true,
                                        feeId: fee.id,
                                        residentName: fee.user.name,
                                        balance: Number(fee.balance),
                                        claim,
                                      });
                                    }}
                                  >
                                    {claim ? "Review Claim" : "Record Payment"}
                                  </Button>
                                )}
                                {fee.status !== "PAID" && fee.status !== "EXEMPTED" && (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="text-muted-foreground h-8"
                                    onClick={() =>
                                      setExemptionDialog({
                                        open: true,
                                        feeId: fee.id,
                                        residentName: fee.user.name,
                                      })
                                    }
                                  >
                                    Exempt
                                  </Button>
                                )}
                              </div>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <Card>
                  <CardContent className="text-muted-foreground py-8 text-center">
                    No {statusFilter !== "ALL" ? statusFilter.toLowerCase() : ""} fee records for
                    this session.
                  </CardContent>
                </Card>
              );
            })()
          ) : (
            <Card>
              <CardContent className="text-muted-foreground py-8 text-center">
                No fee records found for this session.
              </CardContent>
            </Card>
          )}
        </>
      ) : null}

      {/* Payment / Claim Dialog */}
      <Dialog
        open={paymentDialog.open}
        onOpenChange={(open) => {
          /* v8 ignore start */
          if (!open) {
            setPaymentDialog({ open: false, feeId: "", residentName: "", balance: 0, claim: null });
            setShowRejectForm(false);
            setRejectionReason("");
          }
          /* v8 ignore stop */
        }}
      >
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {paymentDialog.claim ? "Review Claim" : "Record Payment"} —{" "}
              {paymentDialog.residentName}
            </DialogTitle>
          </DialogHeader>

          {/* UPI Claim Section */}
          {paymentDialog.claim && (
            <div className="space-y-3 rounded-lg border border-amber-200 bg-amber-50 p-3 dark:border-amber-800 dark:bg-amber-950/30">
              <p className="text-sm font-semibold text-amber-900 dark:text-amber-300">
                UPI Payment Claim
              </p>

              {paymentDialog.claim.screenshotUrl && (
                <a
                  href={paymentDialog.claim.screenshotUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group relative inline-block"
                  title="Click to open full size"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={paymentDialog.claim.screenshotUrl}
                    alt="Payment screenshot"
                    className="h-36 w-auto max-w-full rounded border object-contain transition-opacity group-hover:opacity-90"
                  />
                </a>
              )}

              <div className="space-y-0.5 text-sm">
                <p>
                  <span className="text-muted-foreground">UTR:</span>{" "}
                  <span className="font-mono font-medium">{paymentDialog.claim.utrNumber}</span>
                </p>
                <p>
                  <span className="text-muted-foreground">Amount:</span>{" "}
                  <span className="font-medium">
                    ₹{Number(paymentDialog.claim.claimedAmount).toLocaleString("en-IN")}
                  </span>
                </p>
                <p>
                  <span className="text-muted-foreground">Date:</span>{" "}
                  {new Date(paymentDialog.claim.paymentDate).toLocaleDateString("en-IN", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </p>
              </div>

              {!showRejectForm ? (
                <div className="flex gap-2">
                  <Button
                    size="sm"
                    className="flex-1"
                    onClick={() => verifyMutation.mutate({ claimId: paymentDialog.claim!.id })}
                    disabled={claimActionPending}
                  >
                    {verifyMutation.isPending ? (
                      <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                    ) : (
                      <CheckCircle className="mr-1.5 h-4 w-4" />
                    )}
                    Verify & Mark Paid
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    className="flex-1"
                    onClick={() => setShowRejectForm(true)}
                    disabled={claimActionPending}
                  >
                    <XCircle className="mr-1.5 h-4 w-4" />
                    Reject Claim
                  </Button>
                </div>
              ) : (
                <div className="space-y-2">
                  <Label className="text-xs">Rejection Reason (min 10 characters)</Label>
                  <Textarea
                    placeholder="e.g. UTR not found in bank statement"
                    value={rejectionReason}
                    onChange={(e) => setRejectionReason(e.target.value)}
                    rows={2}
                    className="text-sm"
                  />
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="destructive"
                      className="flex-1"
                      onClick={() =>
                        rejectMutation.mutate({
                          claimId: paymentDialog.claim!.id,
                          reason: rejectionReason.trim(),
                        })
                      }
                      disabled={rejectionReason.trim().length < 10 || claimActionPending}
                    >
                      {rejectMutation.isPending && (
                        <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />
                      )}
                      Confirm Rejection
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        setShowRejectForm(false);
                        setRejectionReason("");
                      }}
                      disabled={claimActionPending}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )}

              <Separator />
              <p className="text-muted-foreground text-xs">
                Or record a manual payment below if needed:
              </p>
            </div>
          )}

          {/* Manual Payment Form */}
          <form
            onSubmit={paymentForm.handleSubmit((data) => paymentMutation.mutate(data))}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label>
                Amount (Balance: {"\u20B9"}
                {paymentDialog.balance.toLocaleString("en-IN")}){" "}
                <span className="text-destructive">*</span>
              </Label>
              <Input
                type="number"
                min={1}
                aria-invalid={!!paymentForm.formState.errors.amount}
                {...paymentForm.register("amount", { valueAsNumber: true })}
              />
              {paymentForm.formState.errors.amount && (
                <p className="text-destructive text-sm">
                  {paymentForm.formState.errors.amount.message}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label>
                Payment Mode <span className="text-destructive">*</span>
              </Label>
              <Select
                value={paymentMode}
                onValueChange={(v) => paymentForm.setValue("paymentMode", v as PaymentMode)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.entries(PAYMENT_MODE_LABELS) as [PaymentMode, string][]).map(
                    ([value, label]) => (
                      <SelectItem key={value} value={value}>
                        {label}
                      </SelectItem>
                    ),
                  )}
                </SelectContent>
              </Select>
            </div>
            {(paymentMode === "UPI" || paymentMode === "BANK_TRANSFER") && (
              <div className="space-y-2">
                <Label>Reference Number</Label>
                <Input
                  placeholder="Transaction ID"
                  aria-invalid={!!paymentForm.formState.errors.referenceNo}
                  {...paymentForm.register("referenceNo")}
                />
                {paymentForm.formState.errors.referenceNo && (
                  <p className="text-destructive text-sm">
                    {paymentForm.formState.errors.referenceNo.message}
                  </p>
                )}
              </div>
            )}
            <div className="space-y-2">
              <Label>
                Payment Date <span className="text-destructive">*</span>
              </Label>
              <Input type="date" {...paymentForm.register("paymentDate")} />
            </div>
            <div className="space-y-2">
              <Label>Notes (Optional)</Label>
              <Input placeholder="Any additional notes" {...paymentForm.register("notes")} />
            </div>
            <DialogFooter>
              <Button type="submit" disabled={paymentMutation.isPending}>
                {paymentMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Record Payment
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Exemption Dialog */}
      <Dialog
        open={exemptionDialog.open}
        onOpenChange={(open) => {
          if (!open) setExemptionDialog({ open: false, feeId: "", residentName: "" });
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Grant Exemption to {exemptionDialog.residentName}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Reason for exemption</Label>
            <Input
              placeholder="e.g., Senior citizen, financial hardship"
              value={exemptionReason}
              onChange={(e) => setExemptionReason(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setExemptionDialog({ open: false, feeId: "", residentName: "" })}
            >
              Cancel
            </Button>
            <Button
              disabled={exemptionReason.length < 10 || exemptionMutation.isPending}
              onClick={() => exemptionMutation.mutate()}
            >
              {exemptionMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Grant Exemption
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
