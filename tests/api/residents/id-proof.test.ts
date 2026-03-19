import { NextRequest } from "next/server";

import { beforeEach, describe, expect, it, vi } from "vitest";

import { mockPrisma } from "../../__mocks__/prisma";
import { mockStorageBucket, mockSupabaseAdmin, mockSupabaseClient } from "../../__mocks__/supabase";

// eslint-disable-next-line import/order
import { DELETE, GET, POST } from "@/app/api/v1/residents/[id]/id-proof/route";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const RESIDENT_ID = "res-uuid-1";
const ADMIN_ID = "admin-uuid-1";
const SOCIETY_ID = "soc-uuid-1";
const AUTH_ID = "auth-admin-1";

function makeParams(id = RESIDENT_ID) {
  return { params: Promise.resolve({ id }) };
}

function makeGetRequest(id = RESIDENT_ID) {
  return new NextRequest(`http://localhost/api/v1/residents/${id}/id-proof`, { method: "GET" });
}

function makeDeleteRequest(id = RESIDENT_ID) {
  return new NextRequest(`http://localhost/api/v1/residents/${id}/id-proof`, { method: "DELETE" });
}

function makePostRequest(file?: File, _id = RESIDENT_ID) {
  const formData = new FormData();
  if (file) formData.append("file", file);
  return {
    formData: vi.fn().mockResolvedValue(formData),
  } as unknown as NextRequest;
}

function makeFile(name = "id.jpg", type = "image/jpeg", sizeBytes = 1024): File {
  const content = new Uint8Array(sizeBytes).fill(0);
  return new File([content], name, { type });
}

function authAs(userId: string | null) {
  mockSupabaseClient.auth.getUser.mockResolvedValueOnce({
    data: { user: userId ? { id: userId } : null },
    error: null,
  });
}

function setupAdmin() {
  authAs(AUTH_ID);
  mockPrisma.user.findFirst.mockResolvedValueOnce({
    id: ADMIN_ID,
    societyId: SOCIETY_ID,
  });
}

function setupAdminAndResident(idProofUrl: string | null = null) {
  setupAdmin();
  mockPrisma.user.findFirst.mockResolvedValueOnce({
    id: RESIDENT_ID,
    idProofUrl,
  });
}

// ---------------------------------------------------------------------------
// POST — upload
// ---------------------------------------------------------------------------

describe("POST /api/v1/residents/[id]/id-proof", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStorageBucket.upload.mockResolvedValue({ error: null });
    mockStorageBucket.remove.mockResolvedValue({ error: null });
  });

  it("returns 401 when not authenticated", async () => {
    authAs(null);

    const res = await POST(makePostRequest(), makeParams());

    expect(res.status).toBe(401);
  });

  it("returns 401 when no admin user found for auth session", async () => {
    authAs(AUTH_ID);
    mockPrisma.user.findFirst.mockResolvedValueOnce(null); // admin lookup fails

    const res = await POST(makePostRequest(), makeParams());

    expect(res.status).toBe(401);
  });

  it("returns 404 when resident not found in society", async () => {
    setupAdmin();
    mockPrisma.user.findFirst.mockResolvedValueOnce(null); // resident not found

    const res = await POST(makePostRequest(makeFile()), makeParams());

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error.code).toBe("NOT_FOUND");
  });

  it("returns 400 when no file in form data", async () => {
    setupAdminAndResident();

    const res = await POST(makePostRequest(), makeParams());

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.message).toContain("No file");
  });

  it("returns 400 when file exceeds 5 MB", async () => {
    setupAdminAndResident();
    const bigFile = makeFile("large.jpg", "image/jpeg", 6 * 1024 * 1024);

    const res = await POST(makePostRequest(bigFile), makeParams());

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.message).toContain("5 MB");
  });

  it("returns 400 for disallowed file types", async () => {
    setupAdminAndResident();
    const badFile = makeFile("script.exe", "application/octet-stream", 1024);

    const res = await POST(makePostRequest(badFile), makeParams());

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.message).toContain("Invalid file type");
  });

  it("accepts JPEG files", async () => {
    setupAdminAndResident();
    mockPrisma.user.update.mockResolvedValue({});

    const res = await POST(makePostRequest(makeFile("doc.jpg", "image/jpeg")), makeParams());

    expect(res.status).toBe(200);
  });

  it("accepts PNG files", async () => {
    setupAdminAndResident();
    mockPrisma.user.update.mockResolvedValue({});

    const res = await POST(makePostRequest(makeFile("doc.png", "image/png")), makeParams());

    expect(res.status).toBe(200);
  });

  it("accepts PDF files", async () => {
    setupAdminAndResident();
    mockPrisma.user.update.mockResolvedValue({});

    const res = await POST(makePostRequest(makeFile("doc.pdf", "application/pdf")), makeParams());

    expect(res.status).toBe(200);
  });

  it("deletes old file from storage when resident already has id proof", async () => {
    setupAdminAndResident("soc-uuid-1/res-uuid-1/id-proof.jpg");
    mockPrisma.user.update.mockResolvedValue({});

    await POST(makePostRequest(makeFile()), makeParams());

    expect(mockStorageBucket.remove).toHaveBeenCalledWith(["soc-uuid-1/res-uuid-1/id-proof.jpg"]);
  });

  it("does not call remove when resident has no existing id proof", async () => {
    setupAdminAndResident(null);
    mockPrisma.user.update.mockResolvedValue({});

    await POST(makePostRequest(makeFile()), makeParams());

    expect(mockStorageBucket.remove).not.toHaveBeenCalled();
  });

  it("uploads to storage bucket 'id-proofs'", async () => {
    setupAdminAndResident();
    mockPrisma.user.update.mockResolvedValue({});

    await POST(makePostRequest(makeFile()), makeParams());

    expect(mockSupabaseAdmin.storage.from).toHaveBeenCalledWith("id-proofs");
  });

  it("uploads with upsert:true", async () => {
    setupAdminAndResident();
    mockPrisma.user.update.mockResolvedValue({});

    await POST(makePostRequest(makeFile()), makeParams());

    expect(mockStorageBucket.upload).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(ArrayBuffer),
      expect.objectContaining({ upsert: true }),
    );
  });

  it("updates user idProofUrl with storage path after upload", async () => {
    setupAdminAndResident();
    mockPrisma.user.update.mockResolvedValue({});

    await POST(makePostRequest(makeFile("aadhaar.jpg", "image/jpeg")), makeParams());

    expect(mockPrisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: RESIDENT_ID },
        data: expect.objectContaining({
          idProofUrl: expect.stringContaining("id-proof.jpg"),
        }),
      }),
    );
  });

  it("storage path includes societyId and residentId", async () => {
    setupAdminAndResident();
    mockPrisma.user.update.mockResolvedValue({});

    await POST(makePostRequest(makeFile("doc.jpg", "image/jpeg")), makeParams());

    expect(mockPrisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          idProofUrl: expect.stringContaining(SOCIETY_ID),
        }),
      }),
    );
  });

  it("returns 500 when storage upload fails", async () => {
    setupAdminAndResident();
    mockStorageBucket.upload.mockResolvedValueOnce({ error: new Error("Storage full") });

    const res = await POST(makePostRequest(makeFile()), makeParams());

    expect(res.status).toBe(500);
  });

  it("returns 500 on unexpected error", async () => {
    mockSupabaseClient.auth.getUser.mockRejectedValueOnce(new Error("DB down"));

    const res = await POST(makePostRequest(makeFile()), makeParams());

    expect(res.status).toBe(500);
  });
});

// ---------------------------------------------------------------------------
// GET — view signed URL
// ---------------------------------------------------------------------------

describe("GET /api/v1/residents/[id]/id-proof", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStorageBucket.createSignedUrl.mockResolvedValue({
      data: { signedUrl: "https://example.com/signed-url" },
      error: null,
    });
  });

  it("returns 401 when not authenticated", async () => {
    authAs(null);

    const res = await GET(makeGetRequest(), makeParams());

    expect(res.status).toBe(401);
  });

  it("returns 401 when no admin found", async () => {
    authAs(AUTH_ID);
    mockPrisma.user.findFirst.mockResolvedValueOnce(null);

    const res = await GET(makeGetRequest(), makeParams());

    expect(res.status).toBe(401);
  });

  it("returns 404 when resident not found", async () => {
    setupAdmin();
    mockPrisma.user.findFirst.mockResolvedValueOnce(null);

    const res = await GET(makeGetRequest(), makeParams());

    expect(res.status).toBe(404);
  });

  it("returns null url when resident has no id proof", async () => {
    setupAdmin();
    mockPrisma.user.findFirst.mockResolvedValueOnce({ idProofUrl: null });

    const res = await GET(makeGetRequest(), makeParams());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.url).toBeNull();
  });

  it("returns signed URL when resident has id proof", async () => {
    setupAdmin();
    mockPrisma.user.findFirst.mockResolvedValueOnce({
      idProofUrl: `${SOCIETY_ID}/${RESIDENT_ID}/id-proof.jpg`,
    });

    const res = await GET(makeGetRequest(), makeParams());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.url).toBe("https://example.com/signed-url");
  });

  it("creates signed URL with 1-hour expiry", async () => {
    setupAdmin();
    mockPrisma.user.findFirst.mockResolvedValueOnce({
      idProofUrl: `${SOCIETY_ID}/${RESIDENT_ID}/id-proof.jpg`,
    });

    await GET(makeGetRequest(), makeParams());

    expect(mockStorageBucket.createSignedUrl).toHaveBeenCalledWith(expect.any(String), 60 * 60);
  });

  it("returns 500 when signed URL generation fails", async () => {
    setupAdmin();
    mockPrisma.user.findFirst.mockResolvedValueOnce({
      idProofUrl: `${SOCIETY_ID}/${RESIDENT_ID}/id-proof.jpg`,
    });
    mockStorageBucket.createSignedUrl.mockResolvedValueOnce({
      data: null,
      error: new Error("Signing failed"),
    });

    const res = await GET(makeGetRequest(), makeParams());

    expect(res.status).toBe(500);
  });

  it("returns 500 on unexpected error", async () => {
    mockSupabaseClient.auth.getUser.mockRejectedValueOnce(new Error("Timeout"));

    const res = await GET(makeGetRequest(), makeParams());

    expect(res.status).toBe(500);
  });
});

// ---------------------------------------------------------------------------
// DELETE — remove id proof
// ---------------------------------------------------------------------------

describe("DELETE /api/v1/residents/[id]/id-proof", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockStorageBucket.remove.mockResolvedValue({ error: null });
  });

  it("returns 401 when not authenticated", async () => {
    authAs(null);

    const res = await DELETE(makeDeleteRequest(), makeParams());

    expect(res.status).toBe(401);
  });

  it("returns 401 when no admin found", async () => {
    authAs(AUTH_ID);
    mockPrisma.user.findFirst.mockResolvedValueOnce(null);

    const res = await DELETE(makeDeleteRequest(), makeParams());

    expect(res.status).toBe(401);
  });

  it("returns 404 when resident not found", async () => {
    setupAdmin();
    mockPrisma.user.findFirst.mockResolvedValueOnce(null);

    const res = await DELETE(makeDeleteRequest(), makeParams());

    expect(res.status).toBe(404);
  });

  it("returns 403 when resident has no id proof to delete", async () => {
    setupAdmin();
    mockPrisma.user.findFirst.mockResolvedValueOnce({ idProofUrl: null });

    const res = await DELETE(makeDeleteRequest(), makeParams());

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error.code).toBe("FORBIDDEN");
  });

  it("removes file from storage", async () => {
    const storagePath = `${SOCIETY_ID}/${RESIDENT_ID}/id-proof.jpg`;
    setupAdmin();
    mockPrisma.user.findFirst.mockResolvedValueOnce({ idProofUrl: storagePath });
    mockPrisma.user.update.mockResolvedValue({});

    await DELETE(makeDeleteRequest(), makeParams());

    expect(mockStorageBucket.remove).toHaveBeenCalledWith([storagePath]);
  });

  it("clears idProofUrl on user record after delete", async () => {
    setupAdmin();
    mockPrisma.user.findFirst.mockResolvedValueOnce({
      idProofUrl: `${SOCIETY_ID}/${RESIDENT_ID}/id-proof.jpg`,
    });
    mockPrisma.user.update.mockResolvedValue({});

    await DELETE(makeDeleteRequest(), makeParams());

    expect(mockPrisma.user.update).toHaveBeenCalledWith({
      where: { id: RESIDENT_ID },
      data: { idProofUrl: null },
    });
  });

  it("returns success response after delete", async () => {
    setupAdmin();
    mockPrisma.user.findFirst.mockResolvedValueOnce({
      idProofUrl: `${SOCIETY_ID}/${RESIDENT_ID}/id-proof.jpg`,
    });
    mockPrisma.user.update.mockResolvedValue({});

    const res = await DELETE(makeDeleteRequest(), makeParams());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.success).toBe(true);
  });

  it("returns 500 on unexpected error", async () => {
    mockSupabaseClient.auth.getUser.mockRejectedValueOnce(new Error("Network error"));

    const res = await DELETE(makeDeleteRequest(), makeParams());

    expect(res.status).toBe(500);
  });
});
