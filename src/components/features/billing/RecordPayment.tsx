"use client";

import { useState } from "react";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
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
import { getSubscription, recordSubscriptionPayment } from "@/services/billing";

const REFERENCE_REQUIRED_MODES = ["UPI", "BANK_TRANSFER", "CHEQUE"] as const;

const CYCLE_LABELS: Record<string, string> = {
  MONTHLY: "Monthly",
  ANNUAL: "Annual",
  TWO_YEAR: "2-Year",
  THREE_YEAR: "3-Year",
};

const CYCLE_EXTENSION: Record<string, string> = {
  MONTHLY: "1 month",
  ANNUAL: "1 year",
  TWO_YEAR: "2 years",
  THREE_YEAR: "3 years",
};

export function RecordSubscriptionPaymentDialog({ societyId }: { societyId: string }) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);

  // "" means "use the subscription's current billing option" (no explicit selection)
  const [cycleId, setCycleId] = useState("");
  // "" means "use the plan price" (no manual override)
  const [amountOverride, setAmountOverride] = useState("");

  const [paymentMode, setPaymentMode] = useState<
    "CASH" | "UPI" | "BANK_TRANSFER" | "CHEQUE" | "OTHER"
  >("UPI");
  const [referenceNo, setReferenceNo] = useState("");
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState("");
  const [sendEmail, setSendEmail] = useState(true);

  const { data: subscription } = useQuery({
    queryKey: ["subscription", societyId],
    queryFn: () => getSubscription(societyId),
    enabled: open,
  });

  const billingOptions = subscription?.plan?.billingOptions ?? [];
  const currentOptionId = subscription?.billingOption?.id ?? "";

  // Derive effective billing option: explicit selection or subscription default
  const effectiveCycleId = cycleId || currentOptionId;
  const effectiveOption = billingOptions.find((o) => o.id === effectiveCycleId);

  // Derive displayed amount: manual override or plan price
  const displayAmount = amountOverride || (effectiveOption ? String(effectiveOption.price) : "");

  function handleCycleSelect(id: string) {
    setCycleId(id);
    setAmountOverride(""); // reset manual override when cycle changes
  }

  function handleAmountChange(val: string) {
    // Clear override if user types back the plan price
    const planPrice = effectiveOption ? String(effectiveOption.price) : "";
    setAmountOverride(val === planPrice ? "" : val);
  }

  const requiresReference = (REFERENCE_REQUIRED_MODES as readonly string[]).includes(paymentMode);
  const isValid =
    Number(displayAmount) > 0 && (!requiresReference || referenceNo.trim().length > 0);

  const mutation = useMutation({
    mutationFn: () =>
      recordSubscriptionPayment(societyId, {
        amount: Number(displayAmount),
        paymentMode,
        referenceNo: referenceNo || undefined,
        paymentDate,
        notes: notes || undefined,
        sendEmail,
        billingOptionId: effectiveCycleId || undefined,
      }),
    onSuccess: () => {
      toast.success("Payment recorded");
      qc.invalidateQueries({ queryKey: ["subscription-payments", societyId] });
      qc.invalidateQueries({ queryKey: ["subscription-invoices", societyId] });
      qc.invalidateQueries({ queryKey: ["subscription", societyId] });
      setOpen(false);
      setCycleId("");
      setAmountOverride("");
      setReferenceNo("");
      setNotes("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const isSubscriptionExpired =
    !subscription?.currentPeriodEnd || new Date(subscription.currentPeriodEnd) <= new Date();

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
          {/* Billing cycle selector — shown when plan has multiple billing options */}
          {billingOptions.length > 0 && (
            <div>
              <Label>Billing Cycle</Label>
              <div className="mt-1 flex flex-wrap gap-2">
                {billingOptions.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => handleCycleSelect(opt.id)}
                    className={`rounded-md border px-3 py-1.5 text-sm font-medium transition-colors ${
                      effectiveCycleId === opt.id
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-input bg-background hover:bg-accent"
                    } ${opt.id === currentOptionId ? "ring-1 ring-offset-1" : ""}`}
                  >
                    {CYCLE_LABELS[opt.billingCycle] ?? opt.billingCycle}
                    <span className="ml-1 opacity-70">₹{opt.price.toLocaleString("en-IN")}</span>
                  </button>
                ))}
              </div>
              {effectiveOption && (
                <p className="text-muted-foreground mt-1 text-xs">
                  Validity extends by{" "}
                  {CYCLE_EXTENSION[effectiveOption.billingCycle] ?? effectiveOption.billingCycle}{" "}
                  from {isSubscriptionExpired ? "today" : "current expiry"}.
                </p>
              )}
            </div>
          )}

          <div>
            <Label>Amount</Label>
            <Input
              type="number"
              min={1}
              value={displayAmount}
              onChange={(e) => handleAmountChange(e.target.value)}
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
