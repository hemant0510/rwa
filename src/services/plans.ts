import type { PlatformPlan } from "@/types/plan";

const BASE = "/api/v1/super-admin/plans";

export async function getPlans(): Promise<PlatformPlan[]> {
  const res = await fetch(BASE);
  if (!res.ok) throw new Error("Failed to fetch plans");
  return res.json();
}

export async function getPlan(id: string): Promise<PlatformPlan> {
  const res = await fetch(`${BASE}/${id}`);
  if (!res.ok) throw new Error("Failed to fetch plan");
  return res.json();
}

export async function createPlan(data: unknown): Promise<PlatformPlan> {
  const res = await fetch(BASE, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err?.error?.message ?? "Failed to create plan");
  }
  return res.json();
}

export async function updatePlan(id: string, data: unknown): Promise<PlatformPlan> {
  const res = await fetch(`${BASE}/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err?.error?.message ?? "Failed to update plan");
  }
  return res.json();
}

export async function archivePlan(id: string): Promise<void> {
  const res = await fetch(`${BASE}/${id}`, { method: "DELETE" });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err?.error?.message ?? "Failed to archive plan");
  }
}

export async function addBillingOption(
  planId: string,
  data: { billingCycle: string; price: number },
) {
  const res = await fetch(`${BASE}/${planId}/billing-options`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err?.error?.message ?? "Failed to add billing option");
  }
  return res.json();
}

export async function updateBillingOption(
  planId: string,
  billingOptionId: string,
  data: { price: number },
) {
  const res = await fetch(`${BASE}/${planId}/billing-options/${billingOptionId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err?.error?.message ?? "Failed to update billing option");
  }
  return res.json();
}

export async function reorderPlans(order: { id: string; displayOrder: number }[]) {
  const res = await fetch(`${BASE}/reorder`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ order }),
  });
  if (!res.ok) throw new Error("Failed to reorder plans");
}
