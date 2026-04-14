import type { UpdateCounsellorSelfInput } from "@/lib/validations/counsellor";
import type { CounsellorDetail } from "@/types/counsellor";

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
