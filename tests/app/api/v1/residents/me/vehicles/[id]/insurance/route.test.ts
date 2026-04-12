import { describe, it, expect, vi, beforeEach } from "vitest";

import { mockPrisma } from "../../../../../../../../__mocks__/prisma";
import { mockStorageBucket, mockSupabaseClient } from "../../../../../../../../__mocks__/supabase";

const { mockGetActiveSocietyId } = vi.hoisted(() => ({
  mockGetActiveSocietyId: vi.fn(),
}));

vi.mock("@/lib/active-society-server", () => ({
  getActiveSocietyId: mockGetActiveSocietyId,
}));

import { POST } from "@/app/api/v1/residents/me/vehicles/[id]/insurance/route";

const mockResident = { id: "user-1", societyId: "soc-1" };

const mockVehicle = {
  id: "veh-1",
  ownerId: "user-1",
  societyId: "soc-1",
};

const makeContext = (id = "veh-1") => ({ params: Promise.resolve({ id }) });

function makeMultipartRequest(file: File) {
  const formData = new FormData();
  formData.append("file", file);
  return new Request("http://localhost/api/v1/residents/me/vehicles/veh-1/insurance", {
    method: "POST",
    body: formData,
  }) as never;
}

function makeEmptyRequest() {
  const formData = new FormData();
  return new Request("http://localhost/api/v1/residents/me/vehicles/veh-1/insurance", {
    method: "POST",
    body: formData,
  }) as never;
}

describe("POST /api/v1/residents/me/vehicles/[id]/insurance", () => {
  const pdfFile = new File(["insurance-content"], "insurance.pdf", { type: "application/pdf" });

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
      data: { signedUrl: "https://example.com/signed/insurance.pdf" },
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
    const textFile = new File(["text"], "doc.txt", { type: "text/plain" });
    const res = await POST(makeMultipartRequest(textFile), makeContext());
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("INVALID_TYPE");
  });

  it("returns 400 when file exceeds 10 MB", async () => {
    // FormData serialization doesn't preserve size overrides in JSDOM — use fake request
    const largeFile = { type: "application/pdf", size: 11 * 1024 * 1024 };
    const fakeReq = {
      formData: vi.fn().mockResolvedValue({ get: vi.fn().mockReturnValue(largeFile) }),
    };
    const res = await POST(fakeReq as never, makeContext());
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("FILE_TOO_LARGE");
  });

  it("uploads insurance and returns signed URL", async () => {
    const res = await POST(makeMultipartRequest(pdfFile), makeContext());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.url).toBe("https://example.com/signed/insurance.pdf");
  });

  it("stores storage path in insuranceUrl (not signed URL)", async () => {
    await POST(makeMultipartRequest(pdfFile), makeContext());
    expect(mockPrisma.vehicle.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "veh-1" },
        data: { insuranceUrl: "soc-1/veh-1/insurance" },
      }),
    );
  });

  it("uploads to correct path in vehicle-docs bucket", async () => {
    await POST(makeMultipartRequest(pdfFile), makeContext());
    expect(mockStorageBucket.upload).toHaveBeenCalledWith(
      "soc-1/veh-1/insurance",
      expect.anything(),
      expect.objectContaining({ upsert: true }),
    );
  });

  it("accepts image files (jpeg, png, webp)", async () => {
    const pngFile = new File(["img"], "insurance.png", { type: "image/png" });
    const res = await POST(makeMultipartRequest(pngFile), makeContext());
    expect(res.status).toBe(200);
  });

  it("falls back to path when signed URL generation fails", async () => {
    mockStorageBucket.createSignedUrl.mockResolvedValue({ data: null, error: { message: "fail" } });
    const res = await POST(makeMultipartRequest(pdfFile), makeContext());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.url).toBe("soc-1/veh-1/insurance");
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
