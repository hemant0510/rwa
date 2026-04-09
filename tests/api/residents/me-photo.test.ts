import { describe, it, expect, vi, beforeEach } from "vitest";

import { mockPrisma } from "../../__mocks__/prisma";
import { mockSupabaseClient, mockStorageBucket } from "../../__mocks__/supabase";

const { mockGetActiveSocietyId } = vi.hoisted(() => ({
  mockGetActiveSocietyId: vi.fn(),
}));
vi.mock("@/lib/active-society-server", () => ({
  getActiveSocietyId: mockGetActiveSocietyId,
}));
vi.mock("@/lib/supabase/ensure-bucket", () => ({
  ensureBucket: vi.fn().mockResolvedValue(undefined),
}));

// eslint-disable-next-line import/order
import { DELETE, GET, POST } from "@/app/api/v1/residents/me/photo/route";

const RESIDENT_ID = "res-uuid-1";
const SOCIETY_ID = "soc-uuid-1";
const AUTH_ID = "auth-resident-1";

function makeFile(name = "photo.jpg", type = "image/jpeg", sizeBytes = 1024): File {
  return new File([new Uint8Array(sizeBytes).fill(0)], name, { type });
}

function makePostRequest(file?: File): Request {
  const formData = new FormData();
  if (file) formData.append("file", file);
  return { formData: vi.fn().mockResolvedValue(formData) } as unknown as Request;
}

const mockResident = {
  id: RESIDENT_ID,
  societyId: SOCIETY_ID,
  photoUrl: null as string | null,
};

describe("POST /api/v1/residents/me/photo", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
    mockGetActiveSocietyId.mockResolvedValue(null);
    mockSupabaseClient.auth.getUser.mockResolvedValue({
      data: { user: { id: AUTH_ID } },
      error: null,
    });
    mockPrisma.user.findFirst.mockResolvedValue({ ...mockResident });
    mockPrisma.user.update.mockResolvedValue({});
    mockStorageBucket.upload.mockResolvedValue({ error: null });
    mockStorageBucket.remove.mockResolvedValue({ error: null });
  });

  it("401 when not authenticated", async () => {
    mockSupabaseClient.auth.getUser.mockResolvedValue({
      data: { user: null },
      error: null,
    });
    const req = makePostRequest(makeFile());
    const res = await POST(req as unknown as import("next/server").NextRequest);
    expect(res.status).toBe(401);
  });

  it("401 when resident not found in DB", async () => {
    mockPrisma.user.findFirst.mockResolvedValue(null);
    const req = makePostRequest(makeFile());
    const res = await POST(req as unknown as import("next/server").NextRequest);
    expect(res.status).toBe(401);
  });

  it("403 when resident has no societyId", async () => {
    mockPrisma.user.findFirst.mockResolvedValue({ ...mockResident, societyId: null });
    const req = makePostRequest(makeFile());
    const res = await POST(req as unknown as import("next/server").NextRequest);
    expect(res.status).toBe(403);
  });

  it("400 when no file provided", async () => {
    const req = makePostRequest();
    const res = await POST(req as unknown as import("next/server").NextRequest);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.message).toContain("No file");
  });

  it("400 when file exceeds 5 MB", async () => {
    const bigFile = makeFile("photo.jpg", "image/jpeg", 6 * 1024 * 1024);
    const req = makePostRequest(bigFile);
    const res = await POST(req as unknown as import("next/server").NextRequest);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.message).toMatch(/too large/i);
  });

  it("400 for disallowed file type (PDF not allowed for photo)", async () => {
    const pdfFile = makeFile("doc.pdf", "application/pdf");
    const req = makePostRequest(pdfFile);
    const res = await POST(req as unknown as import("next/server").NextRequest);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.message).toMatch(/invalid file type/i);
  });

  it("200 for JPEG upload", async () => {
    const req = makePostRequest(makeFile("photo.jpg", "image/jpeg"));
    const res = await POST(req as unknown as import("next/server").NextRequest);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.path).toBe(`${SOCIETY_ID}/${RESIDENT_ID}/photo.jpg`);
  });

  it("200 for PNG upload", async () => {
    const req = makePostRequest(makeFile("photo.png", "image/png"));
    const res = await POST(req as unknown as import("next/server").NextRequest);
    expect(res.status).toBe(200);
  });

  it("200 for WebP upload", async () => {
    const req = makePostRequest(makeFile("photo.webp", "image/webp"));
    const res = await POST(req as unknown as import("next/server").NextRequest);
    expect(res.status).toBe(200);
  });

  it("removes old photo when photoUrl already set", async () => {
    const existingPath = `${SOCIETY_ID}/${RESIDENT_ID}/photo.jpg`;
    mockPrisma.user.findFirst.mockResolvedValue({ ...mockResident, photoUrl: existingPath });
    const req = makePostRequest(makeFile("new.jpg", "image/jpeg"));
    await POST(req as unknown as import("next/server").NextRequest);
    expect(mockStorageBucket.remove).toHaveBeenCalledWith([existingPath]);
  });

  it("does NOT call remove when photoUrl is null", async () => {
    const req = makePostRequest(makeFile("new.jpg", "image/jpeg"));
    await POST(req as unknown as import("next/server").NextRequest);
    expect(mockStorageBucket.remove).not.toHaveBeenCalled();
  });

  it("updates user photoUrl with storage path", async () => {
    const req = makePostRequest(makeFile("photo.jpg", "image/jpeg"));
    await POST(req as unknown as import("next/server").NextRequest);
    expect(mockPrisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: RESIDENT_ID },
        data: { photoUrl: `${SOCIETY_ID}/${RESIDENT_ID}/photo.jpg` },
      }),
    );
  });

  it("500 when storage upload fails", async () => {
    mockStorageBucket.upload.mockResolvedValue({ error: { message: "upload failed" } });
    const req = makePostRequest(makeFile("photo.jpg", "image/jpeg"));
    const res = await POST(req as unknown as import("next/server").NextRequest);
    expect(res.status).toBe(500);
  });

  it("500 on unexpected error", async () => {
    mockSupabaseClient.auth.getUser.mockRejectedValue(new Error("crash"));
    const req = makePostRequest(makeFile("photo.jpg", "image/jpeg"));
    const res = await POST(req as unknown as import("next/server").NextRequest);
    expect(res.status).toBe(500);
  });

  it("scopes by active society when cookie is set", async () => {
    mockGetActiveSocietyId.mockResolvedValue(SOCIETY_ID);
    const req = makePostRequest(makeFile("photo.jpg", "image/jpeg"));
    await POST(req as unknown as import("next/server").NextRequest);
    expect(mockPrisma.user.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ societyId: SOCIETY_ID }),
      }),
    );
  });

  it("handles file with no extension", async () => {
    const noExtFile = new File([new Uint8Array(1024).fill(0)], "photo", { type: "image/jpeg" });
    const req = makePostRequest(noExtFile);
    const res = await POST(req as unknown as import("next/server").NextRequest);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.path).toBe(`${SOCIETY_ID}/${RESIDENT_ID}/photo.photo`);
  });
});

describe("GET /api/v1/residents/me/photo", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
    mockGetActiveSocietyId.mockResolvedValue(null);
    mockSupabaseClient.auth.getUser.mockResolvedValue({
      data: { user: { id: AUTH_ID } },
      error: null,
    });
    mockPrisma.user.findFirst.mockResolvedValue({ ...mockResident });
    mockStorageBucket.createSignedUrl.mockResolvedValue({
      data: { signedUrl: "https://example.com/signed-photo" },
      error: null,
    });
  });

  it("401 when not authenticated", async () => {
    mockSupabaseClient.auth.getUser.mockResolvedValue({ data: { user: null }, error: null });
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("401 when resident not found", async () => {
    mockPrisma.user.findFirst.mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("200 with url:null when photoUrl is null", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.url).toBeNull();
  });

  it("200 with signed URL when photoUrl set", async () => {
    const path = `${SOCIETY_ID}/${RESIDENT_ID}/photo.jpg`;
    mockPrisma.user.findFirst.mockResolvedValue({ ...mockResident, photoUrl: path });
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.url).toBe("https://example.com/signed-photo");
  });

  it("signed URL uses 1hr expiry (3600 seconds)", async () => {
    const path = `${SOCIETY_ID}/${RESIDENT_ID}/photo.jpg`;
    mockPrisma.user.findFirst.mockResolvedValue({ ...mockResident, photoUrl: path });
    await GET();
    expect(mockStorageBucket.createSignedUrl).toHaveBeenCalledWith(path, 3600);
  });

  it("500 when createSignedUrl returns error", async () => {
    mockPrisma.user.findFirst.mockResolvedValue({
      ...mockResident,
      photoUrl: `${SOCIETY_ID}/${RESIDENT_ID}/photo.jpg`,
    });
    mockStorageBucket.createSignedUrl.mockResolvedValue({
      data: null,
      error: { message: "sign error" },
    });
    const res = await GET();
    expect(res.status).toBe(500);
  });

  it("500 on unexpected error", async () => {
    mockSupabaseClient.auth.getUser.mockRejectedValue(new Error("crash"));
    const res = await GET();
    expect(res.status).toBe(500);
  });
});

describe("DELETE /api/v1/residents/me/photo", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
    mockGetActiveSocietyId.mockResolvedValue(null);
    mockSupabaseClient.auth.getUser.mockResolvedValue({
      data: { user: { id: AUTH_ID } },
      error: null,
    });
    mockPrisma.user.findFirst.mockResolvedValue({
      ...mockResident,
      photoUrl: `${SOCIETY_ID}/${RESIDENT_ID}/photo.jpg`,
    });
    mockPrisma.user.update.mockResolvedValue({});
    mockStorageBucket.remove.mockResolvedValue({ error: null });
  });

  it("401 when not authenticated", async () => {
    mockSupabaseClient.auth.getUser.mockResolvedValue({ data: { user: null }, error: null });
    const res = await DELETE();
    expect(res.status).toBe(401);
  });

  it("401 when resident not found", async () => {
    mockPrisma.user.findFirst.mockResolvedValue(null);
    const res = await DELETE();
    expect(res.status).toBe(401);
  });

  it("403 when photoUrl is null", async () => {
    mockPrisma.user.findFirst.mockResolvedValue({ ...mockResident, photoUrl: null });
    const res = await DELETE();
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error.message).toContain("No photo on file");
  });

  it("removes file from storage with correct path", async () => {
    const path = `${SOCIETY_ID}/${RESIDENT_ID}/photo.jpg`;
    await DELETE();
    expect(mockStorageBucket.remove).toHaveBeenCalledWith([path]);
  });

  it("sets photoUrl: null on user record", async () => {
    await DELETE();
    expect(mockPrisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: RESIDENT_ID },
        data: { photoUrl: null },
      }),
    );
  });

  it("200 success response", async () => {
    const res = await DELETE();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  it("500 on unexpected error", async () => {
    mockSupabaseClient.auth.getUser.mockRejectedValue(new Error("crash"));
    const res = await DELETE();
    expect(res.status).toBe(500);
  });
});
