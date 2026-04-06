"use client";

import { useRef, useState } from "react";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Upload, X } from "lucide-react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { subscriptionClaimSchema } from "@/lib/validations/payment-claim";
import { uploadClaimScreenshot } from "@/services/payment-claims";
import { submitSubscriptionClaim } from "@/services/subscription-payment-claims";

import type { z } from "zod";

type FormValues = z.infer<typeof subscriptionClaimSchema>;

interface SubscriptionPaymentClaimFormProps {
  societyId: string;
  amountDue: number;
  periodStart: string;
  periodEnd: string;
  onSuccess: () => void;
}

export function SubscriptionPaymentClaimForm({
  societyId,
  amountDue,
  periodStart,
  periodEnd,
  onSuccess,
}: SubscriptionPaymentClaimFormProps) {
  const [open, setOpen] = useState(false);
  const [screenshotPreview, setScreenshotPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const today = new Date().toISOString().split("T")[0];

  const {
    register,
    handleSubmit,
    setValue,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(subscriptionClaimSchema),
    defaultValues: {
      amount: amountDue,
      utrNumber: "",
      paymentDate: today,
      periodStart,
      periodEnd,
    },
  });

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files![0];
    if (!file) return;

    setUploading(true);
    try {
      const { url } = await uploadClaimScreenshot(file);
      setValue("screenshotUrl", url, { shouldValidate: true });
      setScreenshotPreview(url);
      toast.success("Screenshot uploaded");
    } catch {
      toast.error("Failed to upload screenshot");
    } finally {
      setUploading(false);
    }
  }

  async function onSubmit(values: FormValues) {
    try {
      await submitSubscriptionClaim(societyId, values);
      toast.success(
        "Your payment claim has been submitted. SA will verify within 2 business days.",
      );
      setOpen(false);
      reset();
      setScreenshotPreview(null);
      onSuccess();
    } catch {
      toast.error("Failed to submit payment claim");
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>I&apos;ve paid — confirm payment</Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Confirm Subscription Payment</DialogTitle>
          <DialogDescription>
            Enter your payment details below. Super Admin will verify within 2 business days.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* UTR */}
          <div className="space-y-2">
            <Label htmlFor="utrNumber">UTR / Transaction ID</Label>
            <Input id="utrNumber" placeholder="e.g. 428756123456" {...register("utrNumber")} />
            {errors.utrNumber && (
              <p className="text-destructive text-sm">{errors.utrNumber.message}</p>
            )}
          </div>

          {/* Amount */}
          <div className="space-y-2">
            <Label htmlFor="amount">Amount Paid</Label>
            <Input
              id="amount"
              type="number"
              step="0.01"
              {...register("amount", { valueAsNumber: true })}
            />
            {errors.amount && <p className="text-destructive text-sm">{errors.amount.message}</p>}
          </div>

          {/* Payment Date */}
          <div className="space-y-2">
            <Label htmlFor="paymentDate">Payment Date</Label>
            <Input id="paymentDate" type="date" max={today} {...register("paymentDate")} />
            {errors.paymentDate && (
              <p className="text-destructive text-sm">{errors.paymentDate.message}</p>
            )}
          </div>

          {/* Period Start */}
          <div className="space-y-2">
            <Label htmlFor="periodStart">Period Start</Label>
            <Input id="periodStart" type="date" {...register("periodStart")} />
            {errors.periodStart && (
              <p className="text-destructive text-sm">{errors.periodStart.message}</p>
            )}
          </div>

          {/* Period End */}
          <div className="space-y-2">
            <Label htmlFor="periodEnd">Period End</Label>
            <Input id="periodEnd" type="date" {...register("periodEnd")} />
            {errors.periodEnd && (
              <p className="text-destructive text-sm">{errors.periodEnd.message}</p>
            )}
          </div>

          {/* Screenshot */}
          <div className="space-y-2">
            <Label>Screenshot (optional)</Label>
            <div className="flex items-start gap-3">
              {screenshotPreview && (
                <div className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={screenshotPreview}
                    alt="Payment screenshot"
                    className="h-20 w-20 rounded border object-contain"
                  />
                  <button
                    type="button"
                    aria-label="Remove screenshot"
                    onClick={() => {
                      setScreenshotPreview(null);
                      setValue("screenshotUrl", undefined);
                      fileInputRef.current!.value = "";
                    }}
                    className="bg-destructive text-destructive-foreground absolute -top-2 -right-2 rounded-full p-0.5"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              )}
              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={handleFileChange}
                  aria-label="Upload screenshot"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={uploading}
                  onClick={() => fileInputRef.current!.click()}
                >
                  {uploading ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Upload className="mr-2 h-4 w-4" />
                  )}
                  Upload Screenshot
                </Button>
              </div>
            </div>
          </div>

          <Button type="submit" disabled={isSubmitting || uploading} className="w-full">
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Submit Payment Claim
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
