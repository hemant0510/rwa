import { describe, it, expect, vi, beforeEach } from "vitest";

import { mockPrisma } from "../../../../../../../../__mocks__/prisma";
import { mockStorageBucket, mockSupabaseClient } from "../../../../../../../../__mocks__/supabase";

const { mockGetActiveSocietyId } = vi.hoisted(() => ({
  mockGetActiveSocietyId: vi.fn(),
}));

vi.mock("@/lib/active-society-server", () => ({
  getActiveSocietyId: mockGetActiveSocietyId,
}));

import { POST } from "@/app/api/v1/residents/me/vehicles/[id]/photo/route";

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
  return new Request("http://localhost/api/v1/residents/me/vehicles/veh-1/photo", {
    method: "POST",
    body: formData,
  }) as never;
}

function makeEmptyRequest() {
  const formData = new FormData();
  return new Request("http://localhost/api/v1/residents/me/vehicles/veh-1/photo", {
    method: "POST",
    body: formData,
  }) as never;
}

describe("POST /api/v1/residents/me/vehicles/[id]/photo", () => {
  const imageFile = new File(["image-content"], "photo.jpg", { type: "image/jpeg" });

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
    mockStorageBucket.getPublicUrl.mockReturnValue({
      data: { publicUrl: "https://example.com/vehicle-photos/soc-1/veh-1/photo" },
    });
    mockPrisma.vehicle.update.mockResolvedValue({});
  });

  it("returns 401 when not authenticated", async () => {
    mockSupabaseClient.auth.getUser.mockResolvedValueOnce({ data: { user: null }, error: null });
    const res = await POST(makeMultipartRequest(imageFile), makeContext());
    expect(res.status).toBe(401);
  });

  it("returns 404 when vehicle not found", async () => {
    mockPrisma.vehicle.findUnique.mockResolvedValue(null);
    const res = await POST(makeMultipartRequest(imageFile), makeContext());
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error.code).toBe("NOT_FOUND");
  });

  it("returns 404 when vehicle belongs to another user", async () => {
    mockPrisma.vehicle.findUnique.mockResolvedValue({ ...mockVehicle, ownerId: "other-user" });
    const res = await POST(makeMultipartRequest(imageFile), makeContext());
    expect(res.status).toBe(404);
  });

  it("returns 400 when no file is provided", async () => {
    const res = await POST(makeEmptyRequest(), makeContext());
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("MISSING_FILE");
  });

  it("returns 400 when file is not an image", async () => {
    const pdfFile = new File(["pdf-content"], "doc.pdf", { type: "application/pdf" });
    const res = await POST(makeMultipartRequest(pdfFile), makeContext());
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("INVALID_TYPE");
  });

  it("returns 400 when file exceeds 5 MB", async () => {
    // FormData serialization doesn't preserve size overrides in JSDOM — use fake request
    const largeFile = { type: "image/jpeg", size: 6 * 1024 * 1024 };
    const fakeReq = {
      formData: vi.fn().mockResolvedValue({ get: vi.fn().mockReturnValue(largeFile) }),
    };
    const res = await POST(fakeReq as never, makeContext());
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("FILE_TOO_LARGE");
  });

  it("uploads photo and returns public URL", async () => {
    const res = await POST(makeMultipartRequest(imageFile), makeContext());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.url).toBe("https://example.com/vehicle-photos/soc-1/veh-1/photo");
  });

  it("updates vehiclePhotoUrl in the database", async () => {
    await POST(makeMultipartRequest(imageFile), makeContext());
    expect(mockPrisma.vehicle.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "veh-1" },
        data: { vehiclePhotoUrl: "https://example.com/vehicle-photos/soc-1/veh-1/photo" },
      }),
    );
  });

  it("uploads to correct path in vehicle-photos bucket", async () => {
    await POST(makeMultipartRequest(imageFile), makeContext());
    expect(mockStorageBucket.upload).toHaveBeenCalledWith(
      "soc-1/veh-1/photo",
      expect.anything(),
      expect.objectContaining({ upsert: true }),
    );
  });

  it("applies societyId filter when activeSocietyId is set", async () => {
    mockGetActiveSocietyId.mockResolvedValueOnce("soc-1");
    const res = await POST(makeMultipartRequest(imageFile), makeContext());
    expect(res.status).toBe(200);
    expect(mockPrisma.user.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({ where: expect.objectContaining({ societyId: "soc-1" }) }),
    );
  });

  it("returns 500 when storage upload fails", async () => {
    mockStorageBucket.upload.mockResolvedValue({ error: { message: "Storage error" } });
    const res = await POST(makeMultipartRequest(imageFile), makeContext());
    expect(res.status).toBe(500);
  });

  it("returns 500 on unexpected error", async () => {
    mockPrisma.vehicle.findUnique.mockRejectedValue(new Error("DB error"));
    const res = await POST(makeMultipartRequest(imageFile), makeContext());
    expect(res.status).toBe(500);
  });
});
