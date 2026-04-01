const BASE = "/api/v1/super-admin/settings";

export interface SAProfile {
  id: string;
  name: string;
  email: string;
  createdAt: string;
  lastSignIn: string | null;
}

export async function getSAProfile(): Promise<SAProfile> {
  const res = await fetch(`${BASE}/profile`);
  if (!res.ok) throw new Error("Failed to fetch profile");
  return res.json();
}

export async function updateSAProfile(data: { name: string }): Promise<SAProfile> {
  const res = await fetch(`${BASE}/profile`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to update profile");
  return res.json();
}

export async function changeSAPassword(data: {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}): Promise<void> {
  const res = await fetch(`${BASE}/change-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err?.error?.message ?? "Failed to change password");
  }
}

export interface PlatformConfig {
  [key: string]: string | number;
}

export async function getPlatformConfig(): Promise<PlatformConfig> {
  const res = await fetch(`${BASE}/platform-config`);
  if (!res.ok) throw new Error("Failed to fetch config");
  return res.json();
}

export async function updatePlatformConfig(data: PlatformConfig): Promise<void> {
  const res = await fetch(`${BASE}/platform-config`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Failed to update config");
}
