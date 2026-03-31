const API_BASE = "/api/v1/super-admin/settings";

export interface SuperAdminProfile {
  id: string;
  name: string;
  email: string;
  createdAt: string;
  lastLogin: string | null;
}

export interface PlatformConfigItem {
  key: string;
  value: string;
  type: string;
  label: string;
}

async function handleResponse<T>(res: Response): Promise<T> {
  const json = await res.json();
  if (!res.ok) throw new Error(json?.error?.message ?? "Request failed");
  return json as T;
}

export async function getProfile(): Promise<SuperAdminProfile> {
  const res = await fetch(`${API_BASE}/profile`);
  return handleResponse<SuperAdminProfile>(res);
}

export async function updateProfile(data: { name: string }): Promise<SuperAdminProfile> {
  const res = await fetch(`${API_BASE}/profile`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return handleResponse<SuperAdminProfile>(res);
}

export async function changePassword(data: {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}): Promise<void> {
  const res = await fetch(`${API_BASE}/change-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const json = await res.json();
    throw new Error(json?.error?.message ?? "Failed to change password");
  }
}

export async function getPlatformConfig(): Promise<PlatformConfigItem[]> {
  const res = await fetch(`${API_BASE}/platform-config`);
  return handleResponse<PlatformConfigItem[]>(res);
}

export async function updatePlatformConfig(
  data: Record<string, string | number>,
): Promise<PlatformConfigItem[]> {
  const res = await fetch(`${API_BASE}/platform-config`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return handleResponse<PlatformConfigItem[]>(res);
}
