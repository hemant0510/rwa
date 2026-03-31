const API_BASE = "/api/v1";
const STATS_BASE = `${API_BASE}/super-admin/stats`;

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

export interface RevenueStats {
  mrr: number;
  totalRevenueThisMonth: number;
  overdueCount: number;
  expiring30d: number;
}

export interface GrowthDataPoint {
  month: string;
  count: number;
}

export interface GrowthStats {
  data: GrowthDataPoint[];
  totalBefore: number;
}

export interface PlanDistributionItem {
  planId: string;
  planName: string;
  count: number;
  percentage: number;
}

export async function getSuperAdminStats() {
  const res = await fetch(`${STATS_BASE}`);
  if (!res.ok) throw new Error("Failed to fetch stats");
  return res.json() as Promise<SuperAdminStats>;
}

export async function getRevenueStats() {
  const res = await fetch(`${STATS_BASE}/revenue`);
  if (!res.ok) throw new Error("Failed to fetch revenue stats");
  return res.json() as Promise<RevenueStats>;
}

export async function getGrowthStats() {
  const res = await fetch(`${STATS_BASE}/growth`);
  if (!res.ok) throw new Error("Failed to fetch growth stats");
  return res.json() as Promise<GrowthStats>;
}

export async function getPlanDistribution() {
  const res = await fetch(`${STATS_BASE}/plan-distribution`);
  if (!res.ok) throw new Error("Failed to fetch plan distribution");
  return res.json() as Promise<PlanDistributionItem[]>;
}
