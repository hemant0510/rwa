import type {
  ClosePetitionInput,
  CreatePetitionInput,
  SignPetitionInput,
  UpdatePetitionInput,
} from "@/lib/validations/petition";

const API_BASE = "/api/v1";

// ── Types ──

export interface Petition {
  id: string;
  societyId: string;
  title: string;
  description: string | null;
  type: string;
  documentUrl: string | null;
  targetAuthority: string | null;
  minSignatures: number | null;
  deadline: string | null;
  status: string;
  closedReason: string | null;
  submittedAt: string | null;
  publishedAt: string | null;
  createdAt: string;
  creator: { name: string };
  _count?: { signatures: number };
  // Resident list only — whether the current resident has signed this petition
  mySignature?: { id: string; method: string; signedAt: string } | null;
}

export interface PetitionSignature {
  id: string;
  petitionId: string;
  userId: string;
  method: string;
  signatureUrl: string;
  signedAt: string;
  user: { name: string; email: string; mobile: string | null };
}

// ── Admin: Petitions ──

export async function getPetitions(
  societyId: string,
  params?: { status?: string; type?: string; page?: number; limit?: number },
) {
  const searchParams = new URLSearchParams();
  if (params?.status) searchParams.set("status", params.status);
  if (params?.type) searchParams.set("type", params.type);
  if (params?.page) searchParams.set("page", String(params.page));
  if (params?.limit) searchParams.set("limit", String(params.limit));
  const res = await fetch(`${API_BASE}/societies/${societyId}/petitions?${searchParams}`);
  if (!res.ok) throw new Error("Failed to fetch petitions");
  return res.json() as Promise<{
    data: Petition[];
    total: number;
    page: number;
    limit: number;
  }>;
}

export async function createPetition(societyId: string, data: CreatePetitionInput) {
  const res = await fetch(`${API_BASE}/societies/${societyId}/petitions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error?.message || "Failed to create petition");
  }
  return res.json() as Promise<Petition>;
}

export async function getPetition(societyId: string, petitionId: string) {
  const res = await fetch(`${API_BASE}/societies/${societyId}/petitions/${petitionId}`);
  if (!res.ok) throw new Error("Failed to fetch petition");
  return res.json() as Promise<
    Petition & { signatureCount: number; documentSignedUrl: string | null }
  >;
}

export async function updatePetition(
  societyId: string,
  petitionId: string,
  data: UpdatePetitionInput,
) {
  const res = await fetch(`${API_BASE}/societies/${societyId}/petitions/${petitionId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error?.message || "Failed to update petition");
  }
  return res.json() as Promise<Petition>;
}

export async function extendDeadline(
  societyId: string,
  petitionId: string,
  deadline: string | null,
) {
  const res = await fetch(`${API_BASE}/societies/${societyId}/petitions/${petitionId}/deadline`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ deadline }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(
      (err as { error?: { message?: string } }).error?.message ?? "Failed to update deadline",
    );
  }
  return res.json() as Promise<Petition>;
}

export async function deletePetition(societyId: string, petitionId: string) {
  const res = await fetch(`${API_BASE}/societies/${societyId}/petitions/${petitionId}`, {
    method: "DELETE",
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error?.message || "Failed to delete petition");
  }
  return res.json() as Promise<{ message: string }>;
}

// ── Admin: Actions ──

export async function uploadDocument(societyId: string, petitionId: string, file: File) {
  const formData = new FormData();
  formData.append("file", file);
  const res = await fetch(`${API_BASE}/societies/${societyId}/petitions/${petitionId}/document`, {
    method: "POST",
    body: formData,
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error?.message || "Failed to upload document");
  }
  return res.json() as Promise<{ documentUrl: string }>;
}

export async function publishPetition(societyId: string, petitionId: string) {
  const res = await fetch(`${API_BASE}/societies/${societyId}/petitions/${petitionId}/publish`, {
    method: "POST",
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error?.message || "Failed to publish petition");
  }
  return res.json() as Promise<Petition>;
}

export async function submitPetition(societyId: string, petitionId: string) {
  const res = await fetch(`${API_BASE}/societies/${societyId}/petitions/${petitionId}/submit`, {
    method: "POST",
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error?.message || "Failed to submit petition");
  }
  return res.json() as Promise<Petition>;
}

export async function closePetition(
  societyId: string,
  petitionId: string,
  data: ClosePetitionInput,
) {
  const res = await fetch(`${API_BASE}/societies/${societyId}/petitions/${petitionId}/close`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error?.message || "Failed to close petition");
  }
  return res.json() as Promise<Petition>;
}

// ── Admin: Signatures ──

export async function getSignatures(
  societyId: string,
  petitionId: string,
  params?: { page?: number; limit?: number },
) {
  const searchParams = new URLSearchParams();
  if (params?.page) searchParams.set("page", String(params.page));
  if (params?.limit) searchParams.set("limit", String(params.limit));
  const res = await fetch(
    `${API_BASE}/societies/${societyId}/petitions/${petitionId}/signatures?${searchParams}`,
  );
  if (!res.ok) throw new Error("Failed to fetch signatures");
  return res.json() as Promise<{
    data: PetitionSignature[];
    total: number;
    page: number;
    limit: number;
  }>;
}

export async function removeSignature(societyId: string, petitionId: string, signatureId: string) {
  const res = await fetch(
    `${API_BASE}/societies/${societyId}/petitions/${petitionId}/signatures/${signatureId}`,
    { method: "DELETE" },
  );
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error?.message || "Failed to remove signature");
  }
  return res.json() as Promise<{ message: string }>;
}

export async function downloadReport(societyId: string, petitionId: string) {
  const res = await fetch(`${API_BASE}/societies/${societyId}/petitions/${petitionId}/report`);
  if (!res.ok) throw new Error("Failed to download report");
  return res.blob();
}

export async function downloadSignedDoc(societyId: string, petitionId: string) {
  const res = await fetch(`${API_BASE}/societies/${societyId}/petitions/${petitionId}/signed-doc`);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(
      (err as { error?: { message?: string } }).error?.message ??
        "Failed to download signed document",
    );
  }
  return res.blob();
}

// ── Resident: Petitions ──

export async function getResidentPetitions() {
  const res = await fetch(`${API_BASE}/residents/me/petitions`);
  if (!res.ok) throw new Error("Failed to fetch petitions");
  return res.json() as Promise<{ data: Petition[] }>;
}

export async function getResidentPetition(petitionId: string) {
  const res = await fetch(`${API_BASE}/residents/me/petitions/${petitionId}`);
  if (!res.ok) throw new Error("Failed to fetch petition");
  return res.json() as Promise<
    Petition & {
      signatureCount: number;
      documentSignedUrl: string | null;
      mySignature: PetitionSignature | null;
    }
  >;
}

export async function signPetition(petitionId: string, data: SignPetitionInput) {
  const res = await fetch(`${API_BASE}/residents/me/petitions/${petitionId}/sign`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error?.message || "Failed to sign petition");
  }
  return res.json() as Promise<{ signedAt: string }>;
}
