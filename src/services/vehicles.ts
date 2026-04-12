import type { VehicleInput, VehicleUpdateInput } from "@/lib/validations/vehicle";

const BASE = "/api/v1/residents/me/vehicles";

export interface Vehicle {
  id: string;
  unitId: string;
  societyId: string;
  vehicleType: string;
  registrationNumber: string;
  make: string | null;
  model: string | null;
  colour: string | null;
  parkingSlot: string | null;
  fastagId: string | null;
  notes: string | null;
  ownerId: string;
  dependentOwnerId: string | null;
  vehiclePhotoUrl: string | null;
  rcDocUrl: string | null;
  rcDocSignedUrl: string | null;
  rcExpiry: string | null;
  rcStatus: string;
  insuranceUrl: string | null;
  insuranceSignedUrl: string | null;
  insuranceExpiry: string | null;
  insuranceStatus: string;
  pucExpiry: string | null;
  pucStatus: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  owner: { name: string } | null;
  dependentOwner: { name: string } | null;
}

export interface VehicleListResponse {
  vehicles: Vehicle[];
  total: number;
  page: number;
  limit: number;
}

export interface PaginationParams {
  page?: number;
  limit?: number;
}

export async function getVehicles(params?: PaginationParams): Promise<VehicleListResponse> {
  const url = new URL(BASE, "http://localhost");
  if (params?.page) url.searchParams.set("page", String(params.page));
  if (params?.limit) url.searchParams.set("limit", String(params.limit));
  const res = await fetch(url.pathname + url.search);
  if (!res.ok) throw new Error("Failed to fetch vehicles");
  return res.json();
}

export async function createVehicle(data: VehicleInput): Promise<Vehicle> {
  const res = await fetch(BASE, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message ?? "Failed to create vehicle");
  }
  const body = await res.json();
  return body.vehicle;
}

export async function updateVehicle(id: string, data: VehicleUpdateInput): Promise<Vehicle> {
  const res = await fetch(`${BASE}/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message ?? "Failed to update vehicle");
  }
  const body = await res.json();
  return body.vehicle;
}

export async function deleteVehicle(id: string): Promise<void> {
  const res = await fetch(`${BASE}/${id}`, { method: "DELETE" });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message ?? "Failed to delete vehicle");
  }
}

export async function uploadVehiclePhoto(id: string, file: File): Promise<{ url: string }> {
  const formData = new FormData();
  formData.append("file", file);
  const res = await fetch(`${BASE}/${id}/photo`, { method: "POST", body: formData });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message ?? "Failed to upload vehicle photo");
  }
  return res.json();
}

export async function uploadVehicleRc(id: string, file: File): Promise<{ url: string }> {
  const formData = new FormData();
  formData.append("file", file);
  const res = await fetch(`${BASE}/${id}/rc`, { method: "POST", body: formData });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message ?? "Failed to upload RC document");
  }
  return res.json();
}

export interface VehicleSearchResult {
  id: string;
  registrationNumber: string;
  vehicleType: string;
  make: string | null;
  model: string | null;
  colour: string | null;
  unit: { displayLabel: string } | null;
  owner: { name: string } | null;
  dependentOwner: { name: string } | null;
}

export async function searchVehicles(q: string): Promise<VehicleSearchResult[]> {
  const url = new URL("/api/v1/residents/me/vehicles/search", "http://localhost");
  url.searchParams.set("q", q);
  const res = await fetch(url.pathname + url.search);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message ?? "Failed to search vehicles");
  }
  const body = await res.json();
  return body.vehicles;
}

export async function uploadVehicleInsurance(id: string, file: File): Promise<{ url: string }> {
  const formData = new FormData();
  formData.append("file", file);
  const res = await fetch(`${BASE}/${id}/insurance`, { method: "POST", body: formData });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message ?? "Failed to upload insurance document");
  }
  return res.json();
}
