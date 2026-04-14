import type { CreateCounsellorInput, UpdateCounsellorInput } from "@/lib/validations/counsellor";
import type { CounsellorDetail, PaginatedCounsellors } from "@/types/counsellor";

const BASE = "/api/v1/super-admin/counsellors";

async function parseOk<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error?.message ?? "Request failed");
  }
  return res.json();
}

export interface CounsellorListFilters {
  search?: string;
  status?: "active" | "inactive";
  page?: number;
  pageSize?: number;
}

export async function listCounsellors(
  filters: CounsellorListFilters = {},
): Promise<PaginatedCounsellors> {
  const params = new URLSearchParams();
  if (filters.search) params.set("search", filters.search);
  if (filters.status) params.set("status", filters.status);
  if (filters.page) params.set("page", String(filters.page));
  if (filters.pageSize) params.set("pageSize", String(filters.pageSize));
  const qs = params.toString();
  const res = await fetch(`${BASE}${qs ? `?${qs}` : ""}`);
  return parseOk<PaginatedCounsellors>(res);
}

export async function getCounsellor(id: string): Promise<CounsellorDetail> {
  const res = await fetch(`${BASE}/${id}`);
  return parseOk<CounsellorDetail>(res);
}

export async function createCounsellor(
  data: CreateCounsellorInput,
): Promise<{ id: string; email: string; name: string; inviteSent: boolean }> {
  const res = await fetch(BASE, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return parseOk(res);
}

export async function updateCounsellor(
  id: string,
  data: UpdateCounsellorInput,
): Promise<{ id: string; name: string; email: string; isActive: boolean }> {
  const res = await fetch(`${BASE}/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return parseOk(res);
}

export async function deleteCounsellor(id: string): Promise<{ id: string; deleted: boolean }> {
  const res = await fetch(`${BASE}/${id}`, { method: "DELETE" });
  return parseOk(res);
}

export async function resendCounsellorInvite(id: string): Promise<{ id: string; sent: boolean }> {
  const res = await fetch(`${BASE}/${id}/resend-invite`, { method: "POST" });
  return parseOk(res);
}
