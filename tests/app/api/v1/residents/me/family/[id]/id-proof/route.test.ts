import { describe, it, expect, vi, beforeEach } from "vitest";

import { mockPrisma } from "../../../../../../../../__mocks__/prisma";
import { mockStorageBucket, mockSupabaseClient } from "../../../../../../../../__mocks__/supabase";

const { mockGetActiveSocietyId } = vi.hoisted(() => ({
  mockGetActiveSocietyId: vi.fn(),
}));

vi.mock("@/lib/active-society-server", () => ({
  getActiveSocietyId: mockGetActiveSocietyId,
}));

import { POST } from "@/app/api/v1/residents/me/family/[id]/id-proof/route";

const mockResident = { id: "user-1", societyId: "society-1" };
const mockDependent = { id: "dep-1", userId: "user-1", societyId: "society-1", isActive: true };

type FakeFile = { type: string; size: number };

const makeFormRequest = (file?: FakeFile | null) => ({
  formData: vi.fn().mockResolvedValue({ get: vi.fn().mockReturnValue(file ?? null) }),
});

const makeParams = (id = "dep-1") => ({ params: Promise.resolve({ id }) });

const makePdfFile = (): FakeFile => ({ type: "application/pdf", size: 256 });

describe("POST /api/v1/residents/me/family/[id]/id-proof", () => {
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
    mockPrisma.dependent.update.mockResolvedValue({});
  });

  it("returns 401 when not authenticated", async () => {
    mockSupabaseClient.auth.getUser.mockResolvedValueOnce({ data: { user: null }, error: null });
    const res = await POST(makeFormRequest(makePdfFile()) as never, makeParams());
    expect(res.status).toBe(401);
  });

  it("returns 404 when dependent not found", async () => {
    mockPrisma.dependent.findUnique.mockResolvedValueOnce(null);
    const res = await POST(makeFormRequest(makePdfFile()) as never, makeParams());
    expect(res.status).toBe(404);
  });

  it("returns 404 when dependent belongs to another user", async () => {
    mockPrisma.dependent.findUnique.mockResolvedValueOnce({ ...mockDependent, userId: "other" });
    const res = await POST(makeFormRequest(makePdfFile()) as never, makeParams());
    expect(res.status).toBe(404);
  });

  it("returns 400 when no file provided", async () => {
    const res = await POST(makeFormRequest() as never, makeParams());
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("MISSING_FILE");
  });

  it("returns 400 for disallowed file type", async () => {
    const file: FakeFile = { type: "text/plain", size: 256 };
    const res = await POST(makeFormRequest(file) as never, makeParams());
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("INVALID_TYPE");
  });

  it("returns 400 when file exceeds 10 MB", async () => {
    const largeFile: FakeFile = { type: "application/pdf", size: 11 * 1024 * 1024 };
    const res = await POST(makeFormRequest(largeFile) as never, makeParams());
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("FILE_TOO_LARGE");
  });

  it("accepts PDF file and returns path on success", async () => {
    const res = await POST(makeFormRequest(makePdfFile()) as never, makeParams());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.path).toBe("society-1/dep-1/id-proof");
  });

  it("accepts image files (jpeg, png, webp)", async () => {
    for (const type of ["image/jpeg", "image/png", "image/webp"]) {
      vi.clearAllMocks();
      mockGetActiveSocietyId.mockResolvedValue(null);
      mockSupabaseClient.auth.getUser.mockResolvedValue({
        data: { user: { id: "auth-1" } },
        error: null,
      });
      mockPrisma.user.findFirst.mockResolvedValue(mockResident);
      mockPrisma.dependent.findUnique.mockResolvedValue(mockDependent);
      mockStorageBucket.upload.mockResolvedValue({ error: null });
      mockPrisma.dependent.update.mockResolvedValue({});

      const file: FakeFile = { type, size: 512 };
      const res = await POST(makeFormRequest(file) as never, makeParams());
      expect(res.status).toBe(200);
    }
  });

  it("uploads to private bucket at correct path", async () => {
    await POST(makeFormRequest(makePdfFile()) as never, makeParams());
    expect(mockStorageBucket.upload).toHaveBeenCalledWith(
      "society-1/dep-1/id-proof",
      expect.anything(),
      expect.objectContaining({ upsert: true }),
    );
  });

  it("saves path (not URL) to idProofUrl", async () => {
    await POST(makeFormRequest(makePdfFile()) as never, makeParams());
    expect(mockPrisma.dependent.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "dep-1" },
        data: { idProofUrl: "society-1/dep-1/id-proof" },
      }),
    );
  });

  it("filters by societyId when activeSocietyId is set", async () => {
    mockGetActiveSocietyId.mockResolvedValueOnce("society-1");
    const res = await POST(makeFormRequest(makePdfFile()) as never, makeParams());
    expect(res.status).toBe(200);
    expect(mockPrisma.user.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ societyId: "society-1" }) }),
    );
  });

  it("returns 500 when storage upload fails", async () => {
    mockStorageBucket.upload.mockResolvedValueOnce({ error: { message: "Storage error" } });
    const res = await POST(makeFormRequest(makePdfFile()) as never, makeParams());
    expect(res.status).toBe(500);
  });

  it("returns 500 on unexpected error", async () => {
    mockPrisma.dependent.findUnique.mockRejectedValue(new Error("DB error"));
    const res = await POST(makeFormRequest(makePdfFile()) as never, makeParams());
    expect(res.status).toBe(500);
  });
});
