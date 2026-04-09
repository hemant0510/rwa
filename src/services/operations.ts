const API_BASE = "/api/v1/super-admin";

// --- Platform Residents ---

export interface PlatformResidentItem {
  id: string;
  name: string;
  email: string;
  mobile: string | null;
  rwaid: string | null;
  status: string;
  ownershipType: string | null;
  createdAt: string;
  societyId: string | null;
  society: { name: string } | null;
  photoUrl: string | null;
  userUnits: { unit: { unitNumber: string } }[];
}

export interface PlatformResidentFilters {
  page?: number;
  limit?: number;
  status?: string;
  societyId?: string;
  search?: string;
}

export interface PlatformResidentResponse {
  data: PlatformResidentItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  kpis: {
    totalAll: number;
    activePaid: number;
    pending: number;
    overdue: number;
  };
}

export async function getPlatformResidents(
  filters: PlatformResidentFilters = {},
): Promise<PlatformResidentResponse> {
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(filters)) {
    if (v !== undefined && v !== "") params.set(k, String(v));
  }
  const res = await fetch(`${API_BASE}/residents?${params.toString()}`);
  if (!res.ok) throw new Error("Failed to fetch platform residents");
  return res.json() as Promise<PlatformResidentResponse>;
}

// --- Operations Summary ---

export interface OperationsSummary {
  totalResidents: number;
  collectionRate: number;
  totalExpensesThisMonth: number;
  activeEvents: number;
  activePetitions: number;
  broadcastsThisMonth: number;
}

export async function getOperationsSummary(): Promise<OperationsSummary> {
  const res = await fetch(`${API_BASE}/operations/summary`);
  if (!res.ok) throw new Error("Failed to fetch operations summary");
  return res.json() as Promise<OperationsSummary>;
}

// --- Society Health ---

export interface SocietyHealthItem {
  id: string;
  name: string;
  status: string;
  residents: number;
  collectionRate: number;
  balance: number;
  events30d: number;
  petitions30d: number;
  lastAdminLogin: string | null;
  healthScore: number;
}

export interface SocietyHealthResponse {
  societies: SocietyHealthItem[];
}

export async function getSocietyHealth(): Promise<SocietyHealthResponse> {
  const res = await fetch(`${API_BASE}/operations/health`);
  if (!res.ok) throw new Error("Failed to fetch society health");
  return res.json() as Promise<SocietyHealthResponse>;
}

// --- Activity Feed ---

export interface ActivityItem {
  type: string;
  message: string;
  societyId: string;
  societyName: string;
  timestamp: string;
  severity: "info" | "warning" | "alert";
}

export interface ActivityFeedResponse {
  activities: ActivityItem[];
}

export async function getActivityFeed(): Promise<ActivityFeedResponse> {
  const res = await fetch(`${API_BASE}/operations/activity`);
  if (!res.ok) throw new Error("Failed to fetch activity feed");
  return res.json() as Promise<ActivityFeedResponse>;
}
