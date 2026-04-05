"use client";

import { useRef, useState } from "react";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Upload, X } from "lucide-react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { paymentClaimSchema } from "@/lib/validations/payment-claim";
import { submitPaymentClaim, uploadClaimScreenshot } from "@/services/payment-claims";

import type { z } from "zod";

type FormValues = z.infer<typeof paymentClaimSchema>;

interface PaymentClaimFormProps {
  membershipFeeId: string;
  amountDue: number;
  onSuccess: () => void;
}

const today = () => new Date().toISOString().split("T")[0];

export function PaymentClaimForm({ membershipFeeId, amountDue, onSuccess }: PaymentClaimFormProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [screenshotPreview, setScreenshotPreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(paymentClaimSchema),
    defaultValues: {
      membershipFeeId,
      claimedAmount: amountDue,
      paymentDate: today(),
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
      toast.error("Failed to upload screenshot. Max 2MB, JPG/PNG/WebP only.");
    } finally {
      setUploading(false);
    }
  }

  async function onSubmit(values: FormValues) {
    try {
      await submitPaymentClaim(values);
      toast.success("Claim submitted — admin will verify within 24 hours.");
      onSuccess();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to submit claim";
      toast.error(msg);
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
      {/* Hidden feeId */}
      <input type="hidden" {...register("membershipFeeId")} />

      {/* UTR */}
      <div className="space-y-1.5">
        <Label htmlFor="utrNumber">
          UTR / Transaction ID <span className="text-destructive">*</span>
        </Label>
        <Input
          id="utrNumber"
          placeholder="e.g. 425619876543"
          inputMode="text"
          autoCapitalize="characters"
          {...register("utrNumber")}
        />
        {errors.utrNumber && <p className="text-destructive text-sm">{errors.utrNumber.message}</p>}
        <p className="text-muted-foreground text-xs">Find this in GPay → History</p>
      </div>

      {/* Payment date */}
      <div className="space-y-1.5">
        <Label htmlFor="paymentDate">
          Payment date <span className="text-destructive">*</span>
        </Label>
        <Input id="paymentDate" type="date" max={today()} {...register("paymentDate")} />
        {errors.paymentDate && (
          <p className="text-destructive text-sm">{errors.paymentDate.message}</p>
        )}
      </div>

      {/* Amount */}
      <div className="space-y-1.5">
        <Label htmlFor="claimedAmount">
          Amount paid <span className="text-destructive">*</span>
        </Label>
        <Input
          id="claimedAmount"
          type="number"
          min={1}
          step={1}
          {...register("claimedAmount", { valueAsNumber: true })}
        />
        {errors.claimedAmount && (
          <p className="text-destructive text-sm">{errors.claimedAmount.message}</p>
        )}
      </div>

      {/* Screenshot */}
      <div className="space-y-1.5">
        <Label>Screenshot (optional)</Label>
        <div className="flex items-start gap-3">
          {screenshotPreview && (
            <div className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={screenshotPreview}
                alt="Payment screenshot preview"
                className="h-24 w-24 rounded border object-contain"
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
              aria-label="Upload screenshot"
              onChange={handleFileChange}
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
              {screenshotPreview ? "Replace screenshot" : "Upload screenshot"}
            </Button>
            <p className="text-muted-foreground mt-1 text-xs">PNG / JPG / WebP, max 2 MB</p>
          </div>
        </div>
      </div>

      <Button type="submit" className="h-12 w-full" disabled={isSubmitting || uploading}>
        {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Submit for verification
      </Button>
      <p className="text-muted-foreground text-center text-xs">Admin verifies within 24h.</p>
    </form>
  );
}
