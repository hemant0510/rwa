import { describe, it, expect, vi, beforeEach } from "vitest";

import {
  getFamilyMembers,
  createFamilyMember,
  updateFamilyMember,
  deleteFamilyMember,
  uploadFamilyMemberPhoto,
  uploadFamilyMemberIdProof,
} from "@/services/family";

const mockMember = {
  id: "dep-1",
  memberId: "EDN-DLH-0042-M1",
  memberSeq: 1,
  name: "Priya Bhagat",
  relationship: "SPOUSE",
  otherRelationship: null,
  dateOfBirth: "1990-05-15",
  age: 35,
  bloodGroup: "O_POS",
  mobile: "9876543210",
  email: null,
  occupation: null,
  photoUrl: null,
  idProofSignedUrl: null,
  isEmergencyContact: true,
  emergencyPriority: 1,
  medicalNotes: null,
  isActive: true,
  createdAt: "2026-04-12T10:00:00Z",
  updatedAt: "2026-04-12T10:00:00Z",
};

describe("getFamilyMembers", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("returns members array on success", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ members: [mockMember] }), { status: 200 }),
    );
    const result = await getFamilyMembers();
    expect(result).toEqual([mockMember]);
  });

  it("throws on non-ok response", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ error: { message: "fail" } }), { status: 500 }),
    );
    await expect(getFamilyMembers()).rejects.toThrow("Failed to fetch family members");
  });
});

describe("createFamilyMember", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("returns created member on success", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ member: mockMember }), { status: 201 }),
    );
    const input = {
      name: "Priya Bhagat",
      relationship: "SPOUSE" as const,
      isEmergencyContact: false,
    };
    const result = await createFamilyMember(input);
    expect(result).toEqual(mockMember);
  });

  it("throws with API error message on failure", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ error: { message: "Limit reached" } }), { status: 400 }),
    );
    await expect(
      createFamilyMember({ name: "Test", relationship: "SON" as const, isEmergencyContact: false }),
    ).rejects.toThrow("Limit reached");
  });

  it("throws generic message when no error.message in response", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response("bad json{{{", { status: 500 }),
    );
    await expect(
      createFamilyMember({ name: "Test", relationship: "SON" as const, isEmergencyContact: false }),
    ).rejects.toThrow("Failed to create family member");
  });
});

describe("updateFamilyMember", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("returns updated member on success", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ member: { ...mockMember, name: "Updated" } }), { status: 200 }),
    );
    const result = await updateFamilyMember("dep-1", { name: "Updated" });
    expect(result.name).toBe("Updated");
  });

  it("throws with API error message on failure", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ error: { message: "Not found" } }), { status: 404 }),
    );
    await expect(updateFamilyMember("dep-1", { name: "X" })).rejects.toThrow("Not found");
  });

  it("throws generic message when response body is not JSON", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response("bad json{{{", { status: 500 }),
    );
    await expect(updateFamilyMember("dep-1", {})).rejects.toThrow("Failed to update family member");
  });
});

describe("deleteFamilyMember", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("resolves on success", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ success: true }), { status: 200 }),
    );
    await expect(deleteFamilyMember("dep-1")).resolves.toBeUndefined();
  });

  it("throws with API error message on failure", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ error: { message: "Forbidden" } }), { status: 403 }),
    );
    await expect(deleteFamilyMember("dep-1")).rejects.toThrow("Forbidden");
  });

  it("throws generic message when response body is not JSON", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response("bad json{{{", { status: 500 }),
    );
    await expect(deleteFamilyMember("dep-1")).rejects.toThrow("Failed to delete family member");
  });
});

describe("uploadFamilyMemberPhoto", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("returns url on success", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ url: "https://cdn.example.com/photo.jpg" }), { status: 200 }),
    );
    const file = new File(["data"], "photo.jpg", { type: "image/jpeg" });
    const result = await uploadFamilyMemberPhoto("dep-1", file);
    expect(result.url).toBe("https://cdn.example.com/photo.jpg");
  });

  it("throws with API error message on failure", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ error: { message: "Too large" } }), { status: 400 }),
    );
    const file = new File(["data"], "photo.jpg", { type: "image/jpeg" });
    await expect(uploadFamilyMemberPhoto("dep-1", file)).rejects.toThrow("Too large");
  });

  it("throws generic message when response body is not JSON", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response("bad json{{{", { status: 500 }),
    );
    const file = new File(["data"], "photo.jpg", { type: "image/jpeg" });
    await expect(uploadFamilyMemberPhoto("dep-1", file)).rejects.toThrow("Failed to upload photo");
  });
});

describe("uploadFamilyMemberIdProof", () => {
  beforeEach(() => vi.restoreAllMocks());

  it("returns url on success", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ url: "https://cdn.example.com/proof.pdf" }), { status: 200 }),
    );
    const file = new File(["data"], "proof.pdf", { type: "application/pdf" });
    const result = await uploadFamilyMemberIdProof("dep-1", file);
    expect(result.url).toBe("https://cdn.example.com/proof.pdf");
  });

  it("throws with API error message on failure", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ error: { message: "Invalid type" } }), { status: 400 }),
    );
    const file = new File(["data"], "proof.txt", { type: "text/plain" });
    await expect(uploadFamilyMemberIdProof("dep-1", file)).rejects.toThrow("Invalid type");
  });

  it("throws generic message when response body is not JSON", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response("bad json{{{", { status: 500 }),
    );
    const file = new File(["data"], "proof.pdf", { type: "application/pdf" });
    await expect(uploadFamilyMemberIdProof("dep-1", file)).rejects.toThrow(
      "Failed to upload ID proof",
    );
  });
});
