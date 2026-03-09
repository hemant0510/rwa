export interface Designation {
  id: string;
  name: string;
  sortOrder: number;
  memberCount: number;
}

export interface GoverningBodyMember {
  id: string;
  userId: string;
  name: string;
  email: string;
  mobile: string | null;
  designation: string;
  designationId: string;
  assignedAt: string;
}

interface GoverningBodyResponse {
  members: GoverningBodyMember[];
  designations: { id: string; name: string; sortOrder: number }[];
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const err = (await res.json()) as { error?: { message?: string } };
    throw new Error(err.error?.message ?? "Request failed");
  }
  return res.json() as Promise<T>;
}

export async function fetchGoverningBody(): Promise<GoverningBodyResponse> {
  const res = await fetch("/api/v1/admin/governing-body");
  return handleResponse<GoverningBodyResponse>(res);
}

export async function assignMember(userId: string, designationId: string) {
  const res = await fetch("/api/v1/admin/governing-body", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId, designationId }),
  });
  return handleResponse<{ id: string; message: string }>(res);
}

export async function removeMember(memberId: string) {
  const res = await fetch(`/api/v1/admin/governing-body/${memberId}`, {
    method: "DELETE",
  });
  return handleResponse<{ message: string }>(res);
}

export async function fetchDesignations(): Promise<Designation[]> {
  const res = await fetch("/api/v1/admin/designations");
  return handleResponse<Designation[]>(res);
}

export async function createDesignation(name: string) {
  const res = await fetch("/api/v1/admin/designations", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });
  return handleResponse<Designation & { message: string }>(res);
}

export async function renameDesignation(id: string, name: string) {
  const res = await fetch(`/api/v1/admin/designations/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name }),
  });
  return handleResponse<{ id: string; name: string; message: string }>(res);
}

export async function deleteDesignation(id: string, force = false) {
  const url = force
    ? `/api/v1/admin/designations/${id}?force=true`
    : `/api/v1/admin/designations/${id}`;
  const res = await fetch(url, { method: "DELETE" });
  return handleResponse<{ message: string }>(res);
}
