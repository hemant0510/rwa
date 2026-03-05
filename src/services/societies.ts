import type { CreateSocietyInput, UpdateSocietyInput } from "@/lib/validations/society";
import type { Society, SocietyType } from "@/types/society";

const API_BASE = "/api/v1";

export async function getSocieties(params?: { status?: string; search?: string; page?: number }) {
  const searchParams = new URLSearchParams();
  if (params?.status) searchParams.set("status", params.status);
  if (params?.search) searchParams.set("search", params.search);
  if (params?.page) searchParams.set("page", String(params.page));
  const res = await fetch(`${API_BASE}/societies?${searchParams}`);
  if (!res.ok) throw new Error("Failed to fetch societies");
  return res.json() as Promise<{ data: Society[]; total: number }>;
}

export async function getSociety(id: string) {
  const res = await fetch(`${API_BASE}/societies/${id}`);
  if (!res.ok) throw new Error("Failed to fetch society");
  return res.json() as Promise<Society>;
}

export async function createSociety(data: CreateSocietyInput) {
  const res = await fetch(`${API_BASE}/societies`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to create society");
  return res.json() as Promise<Society>;
}

export async function checkSocietyCode(code: string) {
  const res = await fetch(`${API_BASE}/societies/check-code?code=${encodeURIComponent(code)}`);
  if (!res.ok) throw new Error("Failed to check code");
  return res.json() as Promise<{ available: boolean }>;
}

export async function getSocietyByCode(code: string) {
  const res = await fetch(`${API_BASE}/societies/by-code/${encodeURIComponent(code)}`);
  if (!res.ok) throw new Error("Society not found");
  return res.json() as Promise<{ name: string; type: SocietyType; city: string; state: string }>;
}

export async function updateSociety(id: string, data: UpdateSocietyInput) {
  const res = await fetch(`${API_BASE}/societies/${id}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error?.message ?? "Failed to update society");
  }
  return res.json() as Promise<Society>;
}

export async function deleteSociety(id: string) {
  const res = await fetch(`${API_BASE}/societies/${id}`, { method: "DELETE" });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error?.message ?? "Failed to delete society");
  }
  return res.json() as Promise<{ message: string }>;
}
