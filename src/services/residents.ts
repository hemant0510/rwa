import type { BulkRecordResult } from "@/app/api/v1/residents/bulk-upload/route";
import type { User } from "@/types/user";

const API_BASE = "/api/v1";

export type BulkResidentRecord = {
  fullName: string;
  email: string;
  mobile: string;
  ownershipType: "OWNER" | "TENANT";
  unitAddress?: {
    flatNo?: string;
    towerBlock?: string;
    floorLevel?: string;
  };
  registrationYear?: number;
};

export async function getResidents(
  societyId: string,
  params?: {
    status?: string;
    search?: string;
    page?: number;
    limit?: number;
    emailVerified?: "true" | "false";
    ownershipType?: string;
    year?: string;
  },
) {
  const searchParams = new URLSearchParams();
  if (params?.status) searchParams.set("status", params.status);
  if (params?.search) searchParams.set("search", params.search);
  if (params?.page) searchParams.set("page", String(params.page));
  if (params?.limit) searchParams.set("limit", String(params.limit));
  if (params?.emailVerified) searchParams.set("emailVerified", params.emailVerified);
  if (params?.ownershipType && params.ownershipType !== "all")
    searchParams.set("ownershipType", params.ownershipType);
  if (params?.year && params.year !== "all") searchParams.set("year", params.year);

  const res = await fetch(`${API_BASE}/residents?societyId=${societyId}&${searchParams}`);
  if (!res.ok) throw new Error("Failed to fetch residents");
  return res.json() as Promise<{ data: User[]; total: number; page: number; limit: number }>;
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

export async function sendResidentVerificationEmail(id: string) {
  const res = await fetch(`${API_BASE}/residents/${id}/send-verification`, { method: "POST" });
  if (!res.ok) {
    const err = (await res.json()) as { error?: { message?: string } };
    throw new Error(err.error?.message ?? "Failed to send verification email");
  }
  return res.json() as Promise<{ success: boolean; message: string }>;
}

export async function bulkUploadResidents(
  societyCode: string,
  records: BulkResidentRecord[],
): Promise<{ results: BulkRecordResult[] }> {
  const res = await fetch(`${API_BASE}/residents/bulk-upload`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ societyCode, records }),
  });
  if (!res.ok) {
    const err = (await res.json()) as { error?: { message?: string } };
    throw new Error(err.error?.message ?? "Bulk upload failed");
  }
  return res.json() as Promise<{ results: BulkRecordResult[] }>;
}
