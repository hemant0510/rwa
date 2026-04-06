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
import { platformUpiSchema } from "@/lib/validations/payment-setup";
import { updatePlatformUpiSetup, uploadPlatformQr } from "@/services/payment-setup";
import type { PlatformUpiSettings } from "@/types/payment";

import type { z } from "zod";

type FormValues = z.infer<typeof platformUpiSchema>;

interface PlatformPaymentSetupFormProps {
  initialValues: PlatformUpiSettings;
}

export function PlatformPaymentSetupForm({ initialValues }: PlatformPaymentSetupFormProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [qrPreview, setQrPreview] = useState<string | null>(initialValues.platformUpiQrUrl);
  const [uploading, setUploading] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(platformUpiSchema),
    defaultValues: {
      platformUpiId: initialValues.platformUpiId ?? "",
      platformUpiQrUrl: initialValues.platformUpiQrUrl ?? undefined,
      platformUpiAccountName: initialValues.platformUpiAccountName ?? undefined,
    },
  });

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files![0];
    if (!file) return;

    setUploading(true);
    try {
      const { url } = await uploadPlatformQr(file);
      setValue("platformUpiQrUrl", url, { shouldValidate: true });
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
      await updatePlatformUpiSetup(values);
      toast.success("Platform UPI settings saved");
    } catch {
      toast.error("Failed to save platform UPI settings");
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Platform Payment Collection</CardTitle>
        <CardDescription>
          Configure the platform&apos;s UPI details for subscription payment collection from RWA
          admins.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Platform UPI ID */}
          <div className="space-y-2">
            <Label htmlFor="platformUpiId">
              Platform UPI ID <span className="text-destructive">*</span>
            </Label>
            <Input
              id="platformUpiId"
              placeholder="rwaconnect@icici"
              {...register("platformUpiId")}
            />
            {errors.platformUpiId && (
              <p className="text-destructive text-sm">{errors.platformUpiId.message}</p>
            )}
            <p className="text-muted-foreground text-xs">
              Format: name@bank (e.g. rwaconnect@icici)
            </p>
          </div>

          {/* QR Code Upload */}
          <div className="space-y-2">
            <Label>Platform UPI QR Code</Label>
            <div className="flex items-start gap-4">
              {qrPreview && (
                <div className="relative">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={qrPreview}
                    alt="Platform UPI QR code preview"
                    className="h-32 w-32 rounded border object-contain"
                  />
                  <button
                    type="button"
                    aria-label="Remove QR image"
                    onClick={() => {
                      setQrPreview(null);
                      setValue("platformUpiQrUrl", undefined);
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

          {/* Account Holder Name */}
          <div className="space-y-2">
            <Label htmlFor="platformUpiAccountName">Account Holder Name (optional)</Label>
            <Input
              id="platformUpiAccountName"
              placeholder="RWA Connect Technologies Pvt Ltd"
              {...register("platformUpiAccountName")}
            />
            <p className="text-muted-foreground text-xs">
              Displayed below the QR code for payment confirmation.
            </p>
          </div>

          <Button type="submit" disabled={isSubmitting || uploading}>
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Save
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
