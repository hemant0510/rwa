import type {
  AssignSocietiesInput,
  CreateCounsellorInput,
  TransferPortfolioInput,
  UpdateCounsellorInput,
} from "@/lib/validations/counsellor";
import type {
  CounsellorDetail,
  CounsellorSocietyAssignmentItem,
  PaginatedCounsellorAuditLogs,
  PaginatedCounsellors,
} from "@/types/counsellor";

const BASE = "/api/v1/super-admin/counsellors";

async function parseOk<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error?.message ?? "Request failed");
  }
  return res.json();
}

export interface CounsellorListFilters {
  search?: string;
  status?: "active" | "inactive";
  page?: number;
  pageSize?: number;
}

export async function listCounsellors(
  filters: CounsellorListFilters = {},
): Promise<PaginatedCounsellors> {
  const params = new URLSearchParams();
  if (filters.search) params.set("search", filters.search);
  if (filters.status) params.set("status", filters.status);
  if (filters.page) params.set("page", String(filters.page));
  if (filters.pageSize) params.set("pageSize", String(filters.pageSize));
  const qs = params.toString();
  const res = await fetch(`${BASE}${qs ? `?${qs}` : ""}`);
  return parseOk<PaginatedCounsellors>(res);
}

export async function getCounsellor(id: string): Promise<CounsellorDetail> {
  const res = await fetch(`${BASE}/${id}`);
  return parseOk<CounsellorDetail>(res);
}

export async function createCounsellor(
  data: CreateCounsellorInput,
): Promise<{ id: string; email: string; name: string; inviteSent: boolean }> {
  const res = await fetch(BASE, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return parseOk(res);
}

export async function updateCounsellor(
  id: string,
  data: UpdateCounsellorInput,
): Promise<{ id: string; name: string; email: string; isActive: boolean }> {
  const res = await fetch(`${BASE}/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return parseOk(res);
}

export async function deleteCounsellor(id: string): Promise<{ id: string; deleted: boolean }> {
  const res = await fetch(`${BASE}/${id}`, { method: "DELETE" });
  return parseOk(res);
}

export async function resendCounsellorInvite(id: string): Promise<{ id: string; sent: boolean }> {
  const res = await fetch(`${BASE}/${id}/resend-invite`, { method: "POST" });
  return parseOk(res);
}

// ─── Assignments ───────────────────────────────────────────────────

export async function listCounsellorAssignments(
  counsellorId: string,
): Promise<{ assignments: CounsellorSocietyAssignmentItem[] }> {
  const res = await fetch(`${BASE}/${counsellorId}/assignments`);
  return parseOk(res);
}

export async function listAvailableSocieties(
  counsellorId: string,
  search?: string,
): Promise<{
  societies: Array<{
    id: string;
    name: string;
    societyCode: string;
    city: string;
    state: string;
    totalUnits: number;
    plan: string;
  }>;
}> {
  const params = new URLSearchParams();
  if (search) params.set("search", search);
  const qs = params.toString();
  const res = await fetch(`${BASE}/${counsellorId}/available-societies${qs ? `?${qs}` : ""}`);
  return parseOk(res);
}

export async function assignSocieties(
  counsellorId: string,
  data: AssignSocietiesInput,
): Promise<{
  assigned: number;
  reactivated: number;
  alreadyActive: number;
  societyIds: string[];
}> {
  const res = await fetch(`${BASE}/${counsellorId}/assignments`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return parseOk(res);
}

export async function revokeAssignment(
  counsellorId: string,
  societyId: string,
): Promise<{ id: string; revoked: boolean }> {
  const res = await fetch(`${BASE}/${counsellorId}/assignments/${societyId}`, {
    method: "DELETE",
  });
  return parseOk(res);
}

export async function transferPortfolio(
  sourceCounsellorId: string,
  data: TransferPortfolioInput,
): Promise<{ transferred: number; skipped: number }> {
  const res = await fetch(`${BASE}/${sourceCounsellorId}/transfer-portfolio`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return parseOk(res);
}

// ─── Audit log (SA views per-counsellor audit trail) ─────────────

export async function getCounsellorAuditLog(
  counsellorId: string,
  params: { page?: number; pageSize?: number } = {},
): Promise<PaginatedCounsellorAuditLogs> {
  const qs = new URLSearchParams();
  if (params.page !== undefined) qs.set("page", String(params.page));
  if (params.pageSize !== undefined) qs.set("pageSize", String(params.pageSize));
  const query = qs.toString();
  const res = await fetch(`${BASE}/${counsellorId}/audit${query ? `?${query}` : ""}`);
  return parseOk<PaginatedCounsellorAuditLogs>(res);
}

// ─── Admin-facing (RWA admin sees their society's counsellor) ─────

export async function getMyCounsellor(): Promise<{
  counsellor: {
    id: string;
    name: string;
    email: string;
    publicBlurb: string | null;
    photoUrl: string | null;
    assignedAt: string;
  } | null;
}> {
  const res = await fetch(`/api/v1/admin/counsellor`);
  return parseOk(res);
}
