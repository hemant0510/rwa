import type { PlanDiscount } from "@/types/discount";

const BASE = "/api/v1/super-admin/discounts";

export async function getDiscounts(): Promise<PlanDiscount[]> {
  const res = await fetch(BASE);
  if (!res.ok) throw new Error("Failed to fetch discounts");
  return res.json();
}

export async function createDiscount(data: unknown): Promise<PlanDiscount> {
  const res = await fetch(BASE, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err?.error?.message ?? "Failed to create discount");
  }
  return res.json();
}

export async function updateDiscount(id: string, data: unknown): Promise<PlanDiscount> {
  const res = await fetch(`${BASE}/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err?.error?.message ?? "Failed to update discount");
  }
  return res.json();
}

export async function deactivateDiscount(id: string): Promise<void> {
  const res = await fetch(`${BASE}/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error("Failed to deactivate discount");
}

export async function validateCoupon(
  couponCode: string,
  planId: string,
  billingCycle: string,
): Promise<{
  valid: boolean;
  discountId: string;
  name: string;
  discountType: string;
  discountValue: number;
}> {
  const res = await fetch(`${BASE}/validate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ couponCode: couponCode.toUpperCase(), planId, billingCycle }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err?.error?.message ?? "Invalid coupon code");
  }
  return res.json();
}
