import type { SubscriptionPaymentClaim } from "@/types/payment";

export async function submitSubscriptionClaim(
  societyId: string,
  data: {
    amount: number;
    utrNumber: string;
    paymentDate: string;
    periodStart: string;
    periodEnd: string;
    screenshotUrl?: string;
  },
): Promise<{ claim: SubscriptionPaymentClaim }> {
  const res = await fetch(`/api/v1/societies/${societyId}/subscription-payment-claims`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function getMySubscriptionClaims(
  societyId: string,
): Promise<{ claims: SubscriptionPaymentClaim[] }> {
  const res = await fetch(`/api/v1/societies/${societyId}/subscription-payment-claims`);
  if (!res.ok) throw new Error("Failed to fetch sub claims");
  return res.json();
}

export async function getSaSubscriptionClaims(params?: {
  status?: string;
  page?: number;
  pageSize?: number;
}): Promise<{
  claims: SubscriptionPaymentClaim[];
  total: number;
  page: number;
  pageSize: number;
}> {
  const qs = new URLSearchParams();
  if (params?.status) qs.set("status", params.status);
  if (params?.page) qs.set("page", String(params.page));
  if (params?.pageSize) qs.set("pageSize", String(params.pageSize));
  const res = await fetch(`/api/v1/super-admin/subscription-payment-claims?${qs}`);
  if (!res.ok) throw new Error("Failed to fetch subscription claims");
  return res.json();
}

export async function getSaPendingSubClaimsCount(): Promise<{ count: number }> {
  const res = await fetch("/api/v1/super-admin/subscription-payment-claims/pending-count");
  if (!res.ok) throw new Error("Failed to fetch count");
  return res.json();
}

export async function verifySubscriptionClaim(
  claimId: string,
): Promise<{ claim: SubscriptionPaymentClaim }> {
  const res = await fetch(`/api/v1/super-admin/subscription-payment-claims/${claimId}/verify`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function rejectSubscriptionClaim(
  claimId: string,
  rejectionReason: string,
): Promise<{ claim: SubscriptionPaymentClaim }> {
  const res = await fetch(`/api/v1/super-admin/subscription-payment-claims/${claimId}/reject`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ rejectionReason }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
