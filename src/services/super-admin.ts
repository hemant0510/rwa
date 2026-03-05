const API_BASE = "/api/v1";

export interface SuperAdminStats {
  total: number;
  active: number;
  trial: number;
  suspended: number;
  recentSocieties: {
    id: string;
    name: string;
    city: string;
    status: string;
    onboardingDate: string;
  }[];
}

export async function getSuperAdminStats() {
  const res = await fetch(`${API_BASE}/super-admin/stats`);
  if (!res.ok) throw new Error("Failed to fetch stats");
  return res.json() as Promise<SuperAdminStats>;
}
