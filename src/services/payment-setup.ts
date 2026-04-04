import type { PlatformUpiSettings, UpiSettings } from "@/types/payment";

export async function getPaymentSetup(societyId: string): Promise<UpiSettings> {
  const res = await fetch(`/api/v1/societies/${societyId}/payment-setup`);
  if (!res.ok) throw new Error("Failed to fetch payment setup");
  return res.json() as Promise<UpiSettings>;
}

export async function updateUpiSetup(
  societyId: string,
  data: { upiId: string; upiQrUrl?: string; upiAccountName?: string },
): Promise<UpiSettings> {
  const res = await fetch(`/api/v1/societies/${societyId}/payment-setup/upi`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<UpiSettings>;
}

export async function uploadSocietyQr(societyId: string, file: File): Promise<{ url: string }> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch(`/api/v1/societies/${societyId}/payment-setup/upi/upload-qr`, {
    method: "POST",
    body: form,
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<{ url: string }>;
}

export async function getPlatformPaymentSetup(): Promise<PlatformUpiSettings> {
  const res = await fetch("/api/v1/super-admin/platform-payment-setup");
  if (!res.ok) throw new Error("Failed to fetch platform payment setup");
  return res.json() as Promise<PlatformUpiSettings>;
}

export async function updatePlatformUpiSetup(data: {
  platformUpiId: string;
  platformUpiQrUrl?: string;
  platformUpiAccountName?: string;
}): Promise<PlatformUpiSettings> {
  const res = await fetch("/api/v1/super-admin/platform-payment-setup/upi", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<PlatformUpiSettings>;
}

export async function uploadPlatformQr(file: File): Promise<{ url: string }> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch("/api/v1/super-admin/platform-payment-setup/upload-qr", {
    method: "POST",
    body: form,
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<{ url: string }>;
}
