export interface CommitteeMember {
  id: string;
  name: string;
  email: string;
  mobile: string;
  designation: string;
  assignedAt: string;
}

export interface DirectoryResident {
  id: string;
  name: string;
  email: string;
  mobile: string;
  ownershipType: string | null;
  unit: string | null;
}

interface CommitteeResponse {
  members: CommitteeMember[];
}

interface DirectoryResponse {
  residents: DirectoryResident[];
  total: number;
  page: number;
  limit: number;
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const err = (await res.json()) as { error?: { message?: string } };
    throw new Error(err.error?.message ?? "Request failed");
  }
  return res.json() as Promise<T>;
}

export async function fetchCommitteeMembers(): Promise<CommitteeResponse> {
  const res = await fetch("/api/v1/residents/me/governing-body");
  return handleResponse<CommitteeResponse>(res);
}

export async function fetchResidentDirectory(
  params: { search?: string; page?: number; limit?: number } = {},
): Promise<DirectoryResponse> {
  const query = new URLSearchParams();
  if (params.search) query.set("search", params.search);
  if (params.page) query.set("page", String(params.page));
  if (params.limit) query.set("limit", String(params.limit));

  const qs = query.toString();
  const res = await fetch(`/api/v1/residents/me/directory${qs ? `?${qs}` : ""}`);
  return handleResponse<DirectoryResponse>(res);
}
