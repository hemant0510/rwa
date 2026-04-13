/**
 * Admin-only service layer for resident family + vehicle management.
 * Endpoints live under /api/v1/residents/[id]/... and /api/v1/admin/vehicles/...
 */

export interface AdminFamilyMember {
  id: string;
  memberId: string | null;
  memberSeq: number;
  name: string;
  relationship: string;
  otherRelationship: string | null;
  dateOfBirth: string | null;
  age: number | null;
  bloodGroup: string | null;
  mobile: string | null;
  email: string | null;
  occupation: string | null;
  photoUrl: string | null;
  idProofSignedUrl: string | null;
  isEmergencyContact: boolean;
  emergencyPriority: number | null;
  medicalNotes: string | null;
  isActive: boolean;
  deactivatedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface AdminVehicle {
  id: string;
  unitId: string;
  unit: { displayLabel: string } | null;
  societyId: string;
  vehicleType: string;
  registrationNumber: string;
  make: string | null;
  model: string | null;
  colour: string | null;
  parkingSlot: string | null;
  stickerNumber: string | null;
  evSlot: string | null;
  validFrom: string | null;
  validTo: string | null;
  fastagId: string | null;
  notes: string | null;
  ownerId: string;
  owner: { id: string; name: string } | null;
  dependentOwnerId: string | null;
  dependentOwner: { id: string; name: string } | null;
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
}

export interface AdminVehicleSearchResult {
  id: string;
  registrationNumber: string;
  vehicleType: string;
  make: string | null;
  model: string | null;
  colour: string | null;
  unit: { displayLabel: string } | null;
  owner: { name: string; mobile: string | null; email: string | null } | null;
  dependentOwner: { name: string } | null;
}

export interface AdminVehicleSearchResponse {
  vehicles: AdminVehicleSearchResult[];
  total: number;
  page: number;
  limit: number;
}

export interface AdminVehicleUpdateInput {
  parkingSlot?: string | null;
  stickerNumber?: string | null;
  evSlot?: string | null;
  validFrom?: string | null;
  validTo?: string | null;
}

export async function getResidentFamily(residentId: string): Promise<AdminFamilyMember[]> {
  const res = await fetch(`/api/v1/residents/${residentId}/family`);
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
    throw new Error(err.error?.message ?? "Failed to load family members");
  }
  const body = (await res.json()) as { members: AdminFamilyMember[] };
  return body.members;
}

export async function getResidentVehicles(residentId: string): Promise<AdminVehicle[]> {
  const res = await fetch(`/api/v1/residents/${residentId}/vehicles`);
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
    throw new Error(err.error?.message ?? "Failed to load vehicles");
  }
  const body = (await res.json()) as { vehicles: AdminVehicle[] };
  return body.vehicles;
}

export async function updateAdminVehicle(
  vehicleId: string,
  data: AdminVehicleUpdateInput,
): Promise<AdminVehicle> {
  const res = await fetch(`/api/v1/admin/vehicles/${vehicleId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
    throw new Error(err.error?.message ?? "Failed to update vehicle");
  }
  const body = (await res.json()) as { vehicle: AdminVehicle };
  return body.vehicle;
}

export async function searchAdminVehicles(
  q: string,
  params?: { page?: number; limit?: number },
): Promise<AdminVehicleSearchResponse> {
  const url = new URL("/api/v1/admin/vehicles/search", "http://localhost");
  url.searchParams.set("q", q);
  if (params?.page) url.searchParams.set("page", String(params.page));
  if (params?.limit) url.searchParams.set("limit", String(params.limit));
  const res = await fetch(url.pathname + url.search);
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: { message?: string } };
    throw new Error(err.error?.message ?? "Failed to search vehicles");
  }
  return res.json() as Promise<AdminVehicleSearchResponse>;
}
