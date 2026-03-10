const BASE = (societyId: string) => `/api/v1/societies/${societyId}/subscription`;

export async function getSubscription(societyId: string) {
  const res = await fetch(BASE(societyId));
  if (res.status === 404) return null;
  if (!res.ok) throw new Error("Failed to fetch subscription");
  return res.json();
}

export async function assignPlan(
  societyId: string,
  data: { planId: string; billingOptionId: string; discountId?: string | null; notes?: string },
) {
  const res = await fetch(BASE(societyId), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err?.error?.message ?? "Failed to assign plan");
  }
  return res.json();
}

export async function switchPlan(
  societyId: string,
  data: { planId: string; billingOptionId: string; notes?: string },
) {
  const res = await fetch(`${BASE(societyId)}/switch`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err?.error?.message ?? "Failed to switch plan");
  }
  return res.json();
}

export async function applyDiscount(
  societyId: string,
  data: { discountId?: string | null; customDiscountPct?: number | null; notes?: string },
) {
  const res = await fetch(`${BASE(societyId)}/apply-discount`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err?.error?.message ?? "Failed to apply discount");
  }
  return res.json();
}

export async function getSubscriptionHistory(societyId: string) {
  const res = await fetch(`${BASE(societyId)}/history`);
  if (!res.ok) throw new Error("Failed to fetch subscription history");
  return res.json();
}
