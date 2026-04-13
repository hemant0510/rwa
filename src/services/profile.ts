import type { CompletenessResult } from "@/types/user";

const API_BASE = "/api/v1";

export interface UpdateProfileDeclarationsInput {
  bloodGroup?: string;
  householdStatus?: "DECLARED_NONE" | "NOT_SET";
  vehicleStatus?: "DECLARED_NONE" | "NOT_SET";
}

export interface UpdateProfileDeclarationsResponse {
  bloodGroup: string | null;
  householdStatus: "NOT_SET" | "DECLARED_NONE" | "HAS_ENTRIES";
  vehicleStatus: "NOT_SET" | "DECLARED_NONE" | "HAS_ENTRIES";
  completeness: CompletenessResult;
}

export async function updateProfileDeclarations(
  data: UpdateProfileDeclarationsInput,
): Promise<UpdateProfileDeclarationsResponse> {
  const res = await fetch(`${API_BASE}/residents/me/profile`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = (await res.json()) as { error?: { message?: string } };
    throw new Error(err.error?.message ?? "Failed to update profile");
  }
  return res.json() as Promise<UpdateProfileDeclarationsResponse>;
}

export interface UpdateDirectorySettingsInput {
  showInDirectory: boolean;
  showPhoneInDirectory: boolean;
}

export interface UpdateDirectorySettingsResponse {
  showInDirectory: boolean;
  showPhoneInDirectory: boolean;
}

export async function updateDirectorySettings(
  data: UpdateDirectorySettingsInput,
): Promise<UpdateDirectorySettingsResponse> {
  const res = await fetch(`${API_BASE}/residents/me/settings/directory`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = (await res.json()) as { error?: { message?: string } };
    throw new Error(err.error?.message ?? "Failed to update directory settings");
  }
  return res.json() as Promise<UpdateDirectorySettingsResponse>;
}
