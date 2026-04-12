import type { FamilyMemberInput } from "@/lib/validations/family";

const BASE = "/api/v1/residents/me/family";

export interface FamilyMember {
  id: string;
  memberId: string | null;
  memberSeq: number;
  name: string;
  relationship: string;
  otherRelationship: string | null;
  dateOfBirth: string | null;
  age: number | null;
  bloodGroup: string | null;
  mobile: string | null;
  email: string | null;
  occupation: string | null;
  photoUrl: string | null;
  idProofSignedUrl: string | null;
  isEmergencyContact: boolean;
  emergencyPriority: number | null;
  medicalNotes: string | null;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export async function getFamilyMembers(): Promise<FamilyMember[]> {
  const res = await fetch(BASE);
  if (!res.ok) throw new Error("Failed to fetch family members");
  const data = await res.json();
  return data.members;
}

export async function createFamilyMember(data: FamilyMemberInput): Promise<FamilyMember> {
  const res = await fetch(BASE, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message ?? "Failed to create family member");
  }
  const body = await res.json();
  return body.member;
}

export async function updateFamilyMember(
  id: string,
  data: Partial<FamilyMemberInput>,
): Promise<FamilyMember> {
  const res = await fetch(`${BASE}/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message ?? "Failed to update family member");
  }
  const body = await res.json();
  return body.member;
}

export async function deleteFamilyMember(id: string): Promise<void> {
  const res = await fetch(`${BASE}/${id}`, { method: "DELETE" });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message ?? "Failed to delete family member");
  }
}

export async function uploadFamilyMemberPhoto(id: string, file: File): Promise<{ url: string }> {
  const formData = new FormData();
  formData.append("file", file);
  const res = await fetch(`${BASE}/${id}/photo`, { method: "POST", body: formData });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message ?? "Failed to upload photo");
  }
  return res.json();
}

export async function uploadFamilyMemberIdProof(id: string, file: File): Promise<{ url: string }> {
  const formData = new FormData();
  formData.append("file", file);
  const res = await fetch(`${BASE}/${id}/id-proof`, { method: "POST", body: formData });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.error?.message ?? "Failed to upload ID proof");
  }
  return res.json();
}
