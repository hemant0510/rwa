import { describe, it, expect, vi, beforeEach } from "vitest";

import { mockPrisma } from "../../../../../../../../__mocks__/prisma";
import { mockStorageBucket, mockSupabaseClient } from "../../../../../../../../__mocks__/supabase";

const { mockGetActiveSocietyId } = vi.hoisted(() => ({
  mockGetActiveSocietyId: vi.fn(),
}));

vi.mock("@/lib/active-society-server", () => ({
  getActiveSocietyId: mockGetActiveSocietyId,
}));

import { POST } from "@/app/api/v1/residents/me/family/[id]/photo/route";

const mockResident = { id: "user-1", societyId: "society-1" };
const mockDependent = { id: "dep-1", userId: "user-1", societyId: "society-1", isActive: true };

const makeFormRequest = (file?: File) => {
  const formData = new FormData();
  if (file) formData.append("file", file);
  return new Request("http://localhost/api/v1/residents/me/family/dep-1/photo", {
    method: "POST",
    body: formData,
  });
};

const makeParams = (id = "dep-1") => ({ params: Promise.resolve({ id }) });

const makeImageFile = (size = 1024, type = "image/jpeg") =>
  new File([new Uint8Array(size)], "photo.jpg", { type });

describe("POST /api/v1/residents/me/family/[id]/photo", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetActiveSocietyId.mockResolvedValue(null);
    mockSupabaseClient.auth.getUser.mockResolvedValue({
      data: { user: { id: "auth-1" } },
      error: null,
    });
    mockPrisma.user.findFirst.mockResolvedValue(mockResident);
    mockPrisma.dependent.findUnique.mockResolvedValue(mockDependent);
    mockStorageBucket.upload.mockResolvedValue({ error: null });
    mockStorageBucket.getPublicUrl.mockReturnValue({
      data: { publicUrl: "https://cdn.example.com/photo.jpg" },
    });
    mockPrisma.dependent.update.mockResolvedValue({});
  });

  it("returns 401 when not authenticated", async () => {
    mockSupabaseClient.auth.getUser.mockResolvedValueOnce({ data: { user: null }, error: null });
    const res = await POST(makeFormRequest(makeImageFile()) as never, makeParams());
    expect(res.status).toBe(401);
  });

  it("returns 404 when dependent not found", async () => {
    mockPrisma.dependent.findUnique.mockResolvedValueOnce(null);
    const res = await POST(makeFormRequest(makeImageFile()) as never, makeParams());
    expect(res.status).toBe(404);
  });

  it("returns 404 when dependent belongs to another user", async () => {
    mockPrisma.dependent.findUnique.mockResolvedValueOnce({ ...mockDependent, userId: "other" });
    const res = await POST(makeFormRequest(makeImageFile()) as never, makeParams());
    expect(res.status).toBe(404);
  });

  it("returns 400 when no file provided", async () => {
    const res = await POST(makeFormRequest() as never, makeParams());
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("MISSING_FILE");
  });

  it("returns 400 for non-image file", async () => {
    const file = new File(["data"], "doc.pdf", { type: "application/pdf" });
    const res = await POST(makeFormRequest(file) as never, makeParams());
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("INVALID_TYPE");
  });

  it("returns 400 when file exceeds 5 MB", async () => {
    // Use a mock request to bypass FormData serialization which doesn't preserve size overrides
    const largeFile = { type: "image/jpeg", size: 6 * 1024 * 1024 };
    const fakeReq = {
      formData: vi.fn().mockResolvedValue({ get: vi.fn().mockReturnValue(largeFile) }),
    };
    const res = await POST(fakeReq as never, makeParams());
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("FILE_TOO_LARGE");
  });

  it("uploads file and returns public URL on success", async () => {
    const res = await POST(makeFormRequest(makeImageFile()) as never, makeParams());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.url).toBe("https://cdn.example.com/photo.jpg");
  });

  it("uploads to correct bucket path", async () => {
    await POST(makeFormRequest(makeImageFile()) as never, makeParams());
    expect(mockStorageBucket.upload).toHaveBeenCalledWith(
      "society-1/dep-1/photo",
      expect.anything(),
      expect.objectContaining({ upsert: true }),
    );
  });

  it("updates photoUrl on dependent after upload", async () => {
    await POST(makeFormRequest(makeImageFile()) as never, makeParams());
    expect(mockPrisma.dependent.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "dep-1" },
        data: { photoUrl: "https://cdn.example.com/photo.jpg" },
      }),
    );
  });

  it("returns 500 when storage upload fails", async () => {
    mockStorageBucket.upload.mockResolvedValueOnce({ error: { message: "Storage error" } });
    const res = await POST(makeFormRequest(makeImageFile()) as never, makeParams());
    expect(res.status).toBe(500);
  });

  it("filters by societyId when activeSocietyId is set", async () => {
    mockGetActiveSocietyId.mockResolvedValueOnce("society-1");
    const res = await POST(makeFormRequest(makeImageFile()) as never, makeParams());
    expect(res.status).toBe(200);
    expect(mockPrisma.user.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ societyId: "society-1" }) }),
    );
  });

  it("returns 500 on unexpected error", async () => {
    mockPrisma.dependent.findUnique.mockRejectedValue(new Error("DB error"));
    const res = await POST(makeFormRequest(makeImageFile()) as never, makeParams());
    expect(res.status).toBe(500);
  });
});
