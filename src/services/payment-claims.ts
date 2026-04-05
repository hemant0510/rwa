import type { PaymentClaim } from "@/types/payment";

export async function submitPaymentClaim(data: {
  membershipFeeId: string;
  claimedAmount: number;
  utrNumber: string;
  paymentDate: string;
  screenshotUrl?: string;
}): Promise<{ claim: PaymentClaim }> {
  const res = await fetch("/api/v1/residents/me/payment-claims", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json() as Promise<{ claim: PaymentClaim }>;
}

export async function getMyPaymentClaims(): Promise<{ claims: PaymentClaim[] }> {
  const res = await fetch("/api/v1/residents/me/payment-claims");
  if (!res.ok) throw new Error("Failed to fetch claims");
  return res.json() as Promise<{ claims: PaymentClaim[] }>;
}

export async function uploadClaimScreenshot(file: File): Promise<{ url: string }> {
  const form = new FormData();
  form.append("file", file);
  const res = await fetch("/api/v1/residents/me/payment-claims/upload-screenshot", {
    method: "POST",
    body: form,
  });
  if (!res.ok) throw new Error("Upload failed");
  return res.json() as Promise<{ url: string }>;
}

export async function getPaymentClaimsPendingCount(societyId: string): Promise<{ count: number }> {
  const res = await fetch(`/api/v1/societies/${societyId}/payment-claims/pending-count`);
  if (!res.ok) throw new Error("Failed to fetch count");
  return res.json() as Promise<{ count: number }>;
}
