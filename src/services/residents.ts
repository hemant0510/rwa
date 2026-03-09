import type { User } from "@/types/user";

const API_BASE = "/api/v1";

export async function getResidents(
  societyId: string,
  params?: { status?: string; search?: string; page?: number },
) {
  const searchParams = new URLSearchParams();
  if (params?.status) searchParams.set("status", params.status);
  if (params?.search) searchParams.set("search", params.search);
  if (params?.page) searchParams.set("page", String(params.page));
  const res = await fetch(`${API_BASE}/residents?societyId=${societyId}&${searchParams}`);
  if (!res.ok) throw new Error("Failed to fetch residents");
  return res.json() as Promise<{ data: User[]; total: number }>;
}

export async function getResident(id: string) {
  const res = await fetch(`${API_BASE}/residents/${id}`);
  if (!res.ok) throw new Error("Failed to fetch resident");
  return res.json() as Promise<User>;
}

export async function approveResident(id: string) {
  const res = await fetch(`${API_BASE}/residents/${id}/approve`, { method: "PATCH" });
  if (!res.ok) throw new Error("Failed to approve resident");
  return res.json();
}

export async function rejectResident(id: string, reason: string) {
  const res = await fetch(`${API_BASE}/residents/${id}/reject`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ reason }),
  });
  if (!res.ok) throw new Error("Failed to reject resident");
  return res.json();
}

export async function updateResident(
  id: string,
  data: {
    name?: string;
    mobile?: string;
    email?: string;
    ownershipType?: string;
    otherOwnershipDetail?: string;
  },
) {
  const res = await fetch(`${API_BASE}/residents/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error?.message ?? "Failed to update resident");
  }
  return res.json() as Promise<User>;
}

export async function deleteResident(id: string, reason: string) {
  const res = await fetch(`${API_BASE}/residents/${id}`, {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ reason }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error?.message ?? "Failed to deactivate resident");
  }
  return res.json() as Promise<{ message: string }>;
}

export async function permanentDeleteResident(id: string) {
  const res = await fetch(`${API_BASE}/residents/${id}/permanent-delete`, {
    method: "POST",
  });
  if (!res.ok) {
    const err = (await res.json()) as { error?: { message?: string } };
    throw new Error(err.error?.message ?? "Failed to permanently delete resident");
  }
  return res.json() as Promise<{ message: string }>;
}
