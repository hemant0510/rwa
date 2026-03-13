"use client";

import { useState } from "react";

import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { recordSubscriptionPayment } from "@/services/billing";

const REFERENCE_REQUIRED_MODES = ["UPI", "BANK_TRANSFER", "CHEQUE"] as const;

export function RecordSubscriptionPaymentDialog({ societyId }: { societyId: string }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [amount, setAmount] = useState("");
  const [paymentMode, setPaymentMode] = useState<
    "CASH" | "UPI" | "BANK_TRANSFER" | "CHEQUE" | "OTHER"
  >("UPI");
  const [referenceNo, setReferenceNo] = useState("");
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");
  const [sendEmail, setSendEmail] = useState(true);

  const requiresReference = (REFERENCE_REQUIRED_MODES as readonly string[]).includes(paymentMode);
  const isValid = Number(amount) > 0 && (!requiresReference || referenceNo.trim().length > 0);

  const mutation = useMutation({
    mutationFn: () =>
      recordSubscriptionPayment(societyId, {
        amount: Number(amount),
        paymentMode,
        referenceNo: referenceNo || undefined,
        paymentDate,
        notes: notes || undefined,
        sendEmail,
      }),
    onSuccess: () => {
      toast.success("Payment recorded");
      qc.invalidateQueries({ queryKey: ["subscription-payments", societyId] });
      qc.invalidateQueries({ queryKey: ["subscription-invoices", societyId] });
      setOpen(false);
      setAmount("");
      setReferenceNo("");
      setNotes("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>Record Payment</Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Record Subscription Payment</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>Amount</Label>
            <Input
              type="number"
              min={1}
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
            />
          </div>
          <div>
            <Label>Payment Mode</Label>
            <Select
              value={paymentMode}
              onValueChange={(v) => setPaymentMode(v as typeof paymentMode)}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="CASH">Cash</SelectItem>
                <SelectItem value="UPI">UPI</SelectItem>
                <SelectItem value="BANK_TRANSFER">Bank Transfer</SelectItem>
                <SelectItem value="CHEQUE">Cheque</SelectItem>
                <SelectItem value="OTHER">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>
              Reference No{requiresReference && <span className="text-destructive"> *</span>}
            </Label>
            <Input value={referenceNo} onChange={(e) => setReferenceNo(e.target.value)} />
            {requiresReference && referenceNo.trim().length === 0 && (
              <p className="text-destructive mt-1 text-xs">
                Required for {paymentMode.replace("_", " ")}
              </p>
            )}
          </div>
          <div>
            <Label>Payment Date</Label>
            <Input
              type="date"
              value={paymentDate}
              onChange={(e) => setPaymentDate(e.target.value)}
            />
          </div>
          <div>
            <Label>Notes</Label>
            <Input value={notes} onChange={(e) => setNotes(e.target.value)} />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <Checkbox checked={sendEmail} onCheckedChange={(v) => setSendEmail(v === true)} />
            Send payment confirmation email to society admins
          </label>
          <Button
            className="w-full"
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending || !isValid}
          >
            {mutation.isPending ? "Saving..." : "Save Payment"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
