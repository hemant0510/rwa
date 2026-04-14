import { describe, it, expect, vi, beforeEach } from "vitest";

import { mockPrisma } from "../../../../../../../../__mocks__/prisma";
import { mockStorageBucket, mockSupabaseClient } from "../../../../../../../../__mocks__/supabase";

const { mockGetActiveSocietyId } = vi.hoisted(() => ({
  mockGetActiveSocietyId: vi.fn(),
}));

vi.mock("@/lib/active-society-server", () => ({
  getActiveSocietyId: mockGetActiveSocietyId,
}));

import { POST } from "@/app/api/v1/residents/me/vehicles/[id]/rc/route";

const mockResident = { id: "user-1", societyId: "soc-1" };

const mockVehicle = {
  id: "veh-1",
  ownerId: "user-1",
  societyId: "soc-1",
};

const makeContext = (id = "veh-1") => ({ params: Promise.resolve({ id }) });

type FakeFile = { type: string; size: number };

function makeMultipartRequest(file: FakeFile) {
  return {
    formData: vi.fn().mockResolvedValue({ get: vi.fn().mockReturnValue(file) }),
  } as never;
}

function makeEmptyRequest() {
  return {
    formData: vi.fn().mockResolvedValue({ get: vi.fn().mockReturnValue(null) }),
  } as never;
}

describe("POST /api/v1/residents/me/vehicles/[id]/rc", () => {
  const pdfFile: FakeFile = { type: "application/pdf", size: 256 };

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetActiveSocietyId.mockResolvedValue(null);
    mockSupabaseClient.auth.getUser.mockResolvedValue({
      data: { user: { id: "auth-1" } },
      error: null,
    });
    mockPrisma.user.findFirst.mockResolvedValue(mockResident);
    mockPrisma.vehicle.findUnique.mockResolvedValue(mockVehicle);
    mockStorageBucket.upload.mockResolvedValue({ error: null });
    mockStorageBucket.createSignedUrl.mockResolvedValue({
      data: { signedUrl: "https://example.com/signed/rc.pdf" },
      error: null,
    });
    mockPrisma.vehicle.update.mockResolvedValue({});
  });

  it("returns 401 when not authenticated", async () => {
    mockSupabaseClient.auth.getUser.mockResolvedValueOnce({ data: { user: null }, error: null });
    const res = await POST(makeMultipartRequest(pdfFile), makeContext());
    expect(res.status).toBe(401);
  });

  it("returns 404 when vehicle not found", async () => {
    mockPrisma.vehicle.findUnique.mockResolvedValue(null);
    const res = await POST(makeMultipartRequest(pdfFile), makeContext());
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error.code).toBe("NOT_FOUND");
  });

  it("returns 404 when vehicle belongs to another user", async () => {
    mockPrisma.vehicle.findUnique.mockResolvedValue({ ...mockVehicle, ownerId: "other-user" });
    const res = await POST(makeMultipartRequest(pdfFile), makeContext());
    expect(res.status).toBe(404);
  });

  it("returns 400 when no file provided", async () => {
    const res = await POST(makeEmptyRequest(), makeContext());
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("MISSING_FILE");
  });

  it("returns 400 for disallowed file type", async () => {
    const textFile: FakeFile = { type: "text/plain", size: 256 };
    const res = await POST(makeMultipartRequest(textFile), makeContext());
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("INVALID_TYPE");
  });

  it("returns 400 when file exceeds 10 MB", async () => {
    const largeFile: FakeFile = { type: "application/pdf", size: 11 * 1024 * 1024 };
    const res = await POST(makeMultipartRequest(largeFile), makeContext());
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("FILE_TOO_LARGE");
  });

  it("uploads RC and returns signed URL", async () => {
    const res = await POST(makeMultipartRequest(pdfFile), makeContext());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.url).toBe("https://example.com/signed/rc.pdf");
  });

  it("stores storage path in rcDocUrl (not signed URL)", async () => {
    await POST(makeMultipartRequest(pdfFile), makeContext());
    expect(mockPrisma.vehicle.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "veh-1" },
        data: { rcDocUrl: "soc-1/veh-1/rc" },
      }),
    );
  });

  it("uploads to correct path in vehicle-docs bucket", async () => {
    await POST(makeMultipartRequest(pdfFile), makeContext());
    expect(mockStorageBucket.upload).toHaveBeenCalledWith(
      "soc-1/veh-1/rc",
      expect.anything(),
      expect.objectContaining({ upsert: true }),
    );
  });

  it("accepts image files (jpeg, png, webp)", async () => {
    const jpegFile: FakeFile = { type: "image/jpeg", size: 512 };
    const res = await POST(makeMultipartRequest(jpegFile), makeContext());
    expect(res.status).toBe(200);
  });

  it("falls back to path when signed URL generation fails", async () => {
    mockStorageBucket.createSignedUrl.mockResolvedValue({ data: null, error: { message: "fail" } });
    const res = await POST(makeMultipartRequest(pdfFile), makeContext());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.url).toBe("soc-1/veh-1/rc");
  });

  it("returns 500 when storage upload fails", async () => {
    mockStorageBucket.upload.mockResolvedValue({ error: { message: "Storage error" } });
    const res = await POST(makeMultipartRequest(pdfFile), makeContext());
    expect(res.status).toBe(500);
  });

  it("returns 500 on unexpected error", async () => {
    mockPrisma.vehicle.findUnique.mockRejectedValue(new Error("DB error"));
    const res = await POST(makeMultipartRequest(pdfFile), makeContext());
    expect(res.status).toBe(500);
  });
});
