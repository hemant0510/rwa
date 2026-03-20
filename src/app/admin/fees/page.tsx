"use client";

import { useState } from "react";

import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { CreditCard, IndianRupee, Loader2 } from "lucide-react";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";

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
import { StatusBadge } from "@/components/ui/StatusBadge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useSocietyId } from "@/hooks/useSocietyId";
import { maskMobile } from "@/lib/utils";
import { recordPaymentSchema, type RecordPaymentInput } from "@/lib/validations/fee";
import { getFeeDashboard, recordPayment, grantExemption } from "@/services/fees";
import type { FeeStatus, PaymentMode } from "@/types/fee";
import { PAYMENT_MODE_LABELS } from "@/types/fee";

export default function FeesPage() {
  const { societyId } = useSocietyId();
  const queryClient = useQueryClient();
  const [paymentDialog, setPaymentDialog] = useState<{
    open: boolean;
    feeId: string;
    residentName: string;
    balance: number;
  }>({
    open: false,
    feeId: "",
    residentName: "",
    balance: 0,
  });
  const [exemptionDialog, setExemptionDialog] = useState<{
    open: boolean;
    feeId: string;
    residentName: string;
  }>({
    open: false,
    feeId: "",
    residentName: "",
  });
  const [exemptionReason, setExemptionReason] = useState("");

  const { data: dashboard, isLoading } = useQuery({
    queryKey: ["fees", societyId],
    queryFn: () => getFeeDashboard(societyId),
    enabled: !!societyId,
  });

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
      setPaymentDialog({ open: false, feeId: "", residentName: "", balance: 0 });
      paymentForm.reset();
      queryClient.invalidateQueries({ queryKey: ["fees"] });
      queryClient.invalidateQueries({ queryKey: ["expenses"] });
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

  return (
    <div className="space-y-6">
      <PageHeader title="Fee Management" description="Track and manage membership fees" />

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
                  {dashboard.fees.map((fee) => (
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
                        <StatusBadge status={fee.status as FeeStatus} />
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          {fee.status !== "PAID" && fee.status !== "EXEMPTED" && (
                            <Button
                              size="sm"
                              variant="ghost"
                              className="h-8"
                              onClick={() =>
                                setPaymentDialog({
                                  open: true,
                                  feeId: fee.id,
                                  residentName: fee.user.name,
                                  balance: Number(fee.balance),
                                })
                              }
                            >
                              Record Payment
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
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <Card>
              <CardContent className="text-muted-foreground py-8 text-center">
                No fee records found for this session.
              </CardContent>
            </Card>
          )}
        </>
      ) : null}

      {/* Payment Dialog */}
      <Dialog
        open={paymentDialog.open}
        onOpenChange={(open) => {
          if (!open) setPaymentDialog({ open: false, feeId: "", residentName: "", balance: 0 });
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record Payment for {paymentDialog.residentName}</DialogTitle>
          </DialogHeader>
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
