import type { RecordPaymentInput, GrantExemptionInput } from "@/lib/validations/fee";
import type { MembershipFee, FeePayment } from "@/types/fee";

const API_BASE = "/api/v1";

export interface FeeDashboardData {
  sessionYear: string;
  totalResidents: number;
  stats: { status: string; _count: number }[];
  totalDue: number;
  totalCollected: number;
  collectionRate: number;
  fees: (MembershipFee & {
    user: { name: string; mobile: string; rwaid: string | null };
  })[];
}

export async function getFeeDashboard(societyId: string, session?: string) {
  const params = session ? `?session=${session}` : "";
  const res = await fetch(`${API_BASE}/societies/${societyId}/fees/dashboard${params}`);
  if (!res.ok) throw new Error("Failed to fetch fee dashboard");
  return res.json() as Promise<FeeDashboardData>;
}

export async function recordPayment(societyId: string, feeId: string, data: RecordPaymentInput) {
  const res = await fetch(`${API_BASE}/societies/${societyId}/fees/${feeId}/payments`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error?.message || "Failed to record payment");
  }
  return res.json() as Promise<FeePayment>;
}

export async function grantExemption(societyId: string, feeId: string, data: GrantExemptionInput) {
  const res = await fetch(`${API_BASE}/societies/${societyId}/fees/${feeId}/exempt`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error?.message || "Failed to grant exemption");
  }
  return res.json();
}

export async function getFeeSessions(): Promise<{ id: string; sessionYear: string }[]> {
  const res = await fetch(`${API_BASE}/admin/fee-sessions`);
  if (!res.ok) return [];
  return res.json();
}

export async function getResidentPayments(residentId: string) {
  const res = await fetch(`${API_BASE}/residents/${residentId}/payments`);
  if (!res.ok) throw new Error("Failed to fetch payments");
  return res.json() as Promise<{ fees: MembershipFee[]; payments: FeePayment[] }>;
}
