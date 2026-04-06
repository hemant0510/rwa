import type { PaymentClaim } from "@/types/payment";

export async function getAdminPaymentClaims(
  societyId: string,
  params?: { status?: string; page?: number; pageSize?: number },
): Promise<{ claims: PaymentClaim[]; total: number; page: number; pageSize: number }> {
  const qs = new URLSearchParams();
  if (params?.status) qs.set("status", params.status);
  if (params?.page) qs.set("page", String(params.page));
  if (params?.pageSize) qs.set("pageSize", String(params.pageSize));
  const res = await fetch(`/api/v1/societies/${societyId}/payment-claims?${qs}`);
  if (!res.ok) throw new Error("Failed to fetch claims");
  return res.json();
}

export async function getAdminPendingClaimsCount(societyId: string): Promise<{ count: number }> {
  const res = await fetch(`/api/v1/societies/${societyId}/payment-claims/pending-count`);
  if (!res.ok) throw new Error("Failed to fetch pending count");
  return res.json();
}

export async function verifyClaim(
  societyId: string,
  claimId: string,
  adminNotes?: string,
): Promise<{ claim: PaymentClaim }> {
  const res = await fetch(`/api/v1/societies/${societyId}/payment-claims/${claimId}/verify`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ adminNotes }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function rejectClaim(
  societyId: string,
  claimId: string,
  rejectionReason: string,
): Promise<{ claim: PaymentClaim }> {
  const res = await fetch(`/api/v1/societies/${societyId}/payment-claims/${claimId}/reject`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ rejectionReason }),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
