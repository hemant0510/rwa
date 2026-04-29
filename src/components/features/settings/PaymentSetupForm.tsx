"use client";

import { useRef, useState } from "react";

import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Upload, X } from "lucide-react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { upiSetupSchema } from "@/lib/validations/payment-setup";
import { updateUpiSetup, uploadSocietyQr } from "@/services/payment-setup";
import type { UpiSettings } from "@/types/payment";

import type { z } from "zod";

type FormValues = z.infer<typeof upiSetupSchema>;

interface PaymentSetupFormProps {
  societyId: string;
  initialValues: UpiSettings;
}

export function PaymentSetupForm({ societyId, initialValues }: PaymentSetupFormProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [qrPreview, setQrPreview] = useState<string | null>(initialValues.upiQrUrl);
  const [uploading, setUploading] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(upiSetupSchema),
    defaultValues: {
      upiId: initialValues.upiId ?? "",
      upiQrUrl: initialValues.upiQrUrl ?? undefined,
      upiAccountName: initialValues.upiAccountName ?? undefined,
    },
  });

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files![0];
    if (!file) return;

    setUploading(true);
    try {
      const { url } = await uploadSocietyQr(societyId, file);
      setValue("upiQrUrl", url, { shouldValidate: true });
      setQrPreview(url);
      toast.success("QR image uploaded");
    } catch {
      toast.error("Failed to upload QR image. Max 2MB, JPG/PNG/WebP only.");
    } finally {
      setUploading(false);
    }
  }

  async function onSubmit(values: FormValues) {
    try {
      await updateUpiSetup(societyId, values);
      toast.success("UPI payment settings saved");
    } catch {
      toast.error("Failed to save UPI settings");
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>UPI Payment Setup</CardTitle>
        <CardDescription>
          Configure your society&apos;s UPI details so residents can scan and pay fees directly.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* UPI ID */}
          <div className="space-y-2">
            <Label htmlFor="upiId">
              Society UPI ID <span className="text-destructive">*</span>
            </Label>
            <Input id="upiId" placeholder="edenestate@sbi" {...register("upiId")} />
            {errors.upiId && <p className="text-destructive text-sm">{errors.upiId.message}</p>}
            <p className="text-muted-foreground text-xs">
              Format: name@bank (e.g. society@sbi, rwa@hdfc)
            </p>
          </div>

          {/* QR Code Upload */}
          <div className="space-y-2">
            <Label>UPI QR Code Image</Label>
            <div className="flex items-start gap-4">
              {/* Preview */}
              {qrPreview && (
                <div className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={qrPreview}
                    alt="UPI QR code preview"
                    className="h-32 w-32 rounded border object-contain"
                  />
                  <button
                    type="button"
                    aria-label="Remove QR image"
                    onClick={() => {
                      setQrPreview(null);
                      setValue("upiQrUrl", undefined);
                      fileInputRef.current!.value = "";
                    }}
                    className="bg-destructive text-destructive-foreground absolute -top-2 -right-2 rounded-full p-0.5"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              )}

              {/* Upload button */}
              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp"
                  className="hidden"
                  onChange={handleFileChange}
                  aria-label="Upload QR image"
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
                  {qrPreview ? "Replace QR Image" : "Upload QR Image"}
                </Button>
                <p className="text-muted-foreground mt-1 text-xs">PNG / JPG / WebP, max 2 MB</p>
              </div>
            </div>
          </div>

          {/* Account Name */}
          <div className="space-y-2">
            <Label htmlFor="upiAccountName">Bank Account Name (optional)</Label>
            <Input
              id="upiAccountName"
              placeholder="Greenwood Residency RWA"
              {...register("upiAccountName")}
            />
            <p className="text-muted-foreground text-xs">
              Displayed below the QR code to help residents confirm the payee.
            </p>
          </div>

          <p className="text-muted-foreground text-sm">
            ⚠ Use the society&apos;s official bank account only.
          </p>

          <Button type="submit" disabled={isSubmitting || uploading}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save UPI Settings
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
