import type { UpdateCounsellorSelfInput } from "@/lib/validations/counsellor";
import type {
  CounsellorDashboard,
  CounsellorDetail,
  CounsellorGoverningBodyMember,
  CounsellorResidentDetail,
  CounsellorSocietyDetail,
  CounsellorSocietySummary,
  PaginatedCounsellorResidents,
} from "@/types/counsellor";

const BASE = "/api/v1/counsellor";

async function parseOk<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error?.message ?? "Request failed");
  }
  return res.json();
}

export async function getMe(): Promise<CounsellorDetail> {
  const res = await fetch(`${BASE}/me`);
  return parseOk<CounsellorDetail>(res);
}

export async function updateMe(data: UpdateCounsellorSelfInput): Promise<{
  id: string;
  name: string;
  email: string;
  mobile: string | null;
  bio: string | null;
  publicBlurb: string | null;
  photoUrl: string | null;
}> {
  const res = await fetch(`${BASE}/me`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  return parseOk(res);
}

export async function getDashboard(): Promise<CounsellorDashboard> {
  const res = await fetch(`${BASE}/dashboard`);
  return parseOk<CounsellorDashboard>(res);
}

export async function getSocieties(): Promise<{ societies: CounsellorSocietySummary[] }> {
  const res = await fetch(`${BASE}/societies`);
  return parseOk<{ societies: CounsellorSocietySummary[] }>(res);
}

export async function getSociety(societyId: string): Promise<CounsellorSocietyDetail> {
  const res = await fetch(`${BASE}/societies/${societyId}`);
  return parseOk<CounsellorSocietyDetail>(res);
}

export async function getSocietyResidents(
  societyId: string,
  params: { page?: number; pageSize?: number; search?: string } = {},
): Promise<PaginatedCounsellorResidents> {
  const qs = new URLSearchParams();
  if (params.page) qs.set("page", String(params.page));
  if (params.pageSize) qs.set("pageSize", String(params.pageSize));
  if (params.search) qs.set("search", params.search);
  const query = qs.toString();
  const url = `${BASE}/societies/${societyId}/residents${query ? `?${query}` : ""}`;
  const res = await fetch(url);
  return parseOk<PaginatedCounsellorResidents>(res);
}

export async function getSocietyResident(
  societyId: string,
  residentId: string,
): Promise<CounsellorResidentDetail> {
  const res = await fetch(`${BASE}/societies/${societyId}/residents/${residentId}`);
  return parseOk<CounsellorResidentDetail>(res);
}

export async function getSocietyGoverningBody(
  societyId: string,
): Promise<{ members: CounsellorGoverningBodyMember[] }> {
  const res = await fetch(`${BASE}/societies/${societyId}/governing-body`);
  return parseOk<{ members: CounsellorGoverningBodyMember[] }>(res);
}
