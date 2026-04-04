import { NextRequest } from "next/server";

import { beforeEach, describe, expect, it, vi } from "vitest";

const mockGetCurrentUser = vi.hoisted(() => vi.fn());
const mockGetFullAccessAdmin = vi.hoisted(() => vi.fn());

vi.mock("@/lib/get-current-user", () => ({
  getCurrentUser: mockGetCurrentUser,
  getFullAccessAdmin: mockGetFullAccessAdmin,
}));

// eslint-disable-next-line import/order
import { mockPrisma } from "../__mocks__/prisma";
// eslint-disable-next-line import/order
import { mockStorageBucket, mockSupabaseAdmin } from "../__mocks__/supabase";

vi.mock("@/lib/supabase/ensure-bucket", () => ({
  ensureBucket: vi.fn().mockResolvedValue(undefined),
}));

import { GET } from "@/app/api/v1/societies/[id]/payment-setup/route";
import { PATCH } from "@/app/api/v1/societies/[id]/payment-setup/upi/route";
import { POST } from "@/app/api/v1/societies/[id]/payment-setup/upi/upload-qr/route";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SOCIETY_ID = "soc-uuid-1";
const ADMIN_ID = "admin-uuid-1";

const mockAdmin = {
  userId: ADMIN_ID,
  authUserId: "auth-1",
  societyId: SOCIETY_ID,
  role: "RWA_ADMIN",
  adminPermission: "FULL_ACCESS",
};

const mockSociety = {
  id: SOCIETY_ID,
  upiId: "edenestate@sbi",
  upiQrUrl: "https://example.com/qr.png",
  upiAccountName: "Eden Estate RWA",
};

// ---------------------------------------------------------------------------
// Request helpers
// ---------------------------------------------------------------------------

function makeParams(id = SOCIETY_ID) {
  return { params: Promise.resolve({ id }) };
}

function makeGetRequest(id = SOCIETY_ID) {
  return new NextRequest(`http://localhost/api/v1/societies/${id}/payment-setup`);
}

function makePatchRequest(body: unknown, id = SOCIETY_ID) {
  return new NextRequest(`http://localhost/api/v1/societies/${id}/payment-setup/upi`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function makeUploadRequest(file?: File) {
  const formData = new FormData();
  if (file) formData.append("file", file);
  return {
    formData: vi.fn().mockResolvedValue(formData),
  } as unknown as NextRequest;
}

function makeFile(name = "qr.png", type = "image/png", sizeBytes = 1024): File {
  const content = new Uint8Array(sizeBytes).fill(0);
  return new File([content], name, { type });
}

// ---------------------------------------------------------------------------
// GET /api/v1/societies/[id]/payment-setup
// ---------------------------------------------------------------------------

describe("GET /api/v1/societies/[id]/payment-setup", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCurrentUser.mockResolvedValue(mockAdmin);
    mockPrisma.society.findUnique.mockResolvedValue(mockSociety);
  });

  it("returns 401 when not authenticated", async () => {
    mockGetCurrentUser.mockResolvedValue(null);
    const res = await GET(makeGetRequest(), makeParams());
    expect(res.status).toBe(401);
  });

  it("returns 404 when society not found", async () => {
    mockPrisma.society.findUnique.mockResolvedValue(null);
    const res = await GET(makeGetRequest(), makeParams());
    expect(res.status).toBe(404);
  });

  it("returns 404 when society belongs to a different admin", async () => {
    mockGetCurrentUser.mockResolvedValue({ ...mockAdmin, societyId: "other-soc" });
    const res = await GET(makeGetRequest(), makeParams());
    expect(res.status).toBe(404);
  });

  it("returns 200 with UPI fields on success", async () => {
    const res = await GET(makeGetRequest(), makeParams());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.upiId).toBe("edenestate@sbi");
    expect(body.upiQrUrl).toBe("https://example.com/qr.png");
    expect(body.upiAccountName).toBe("Eden Estate RWA");
  });

  it("returns null fields when society has no UPI configured", async () => {
    mockPrisma.society.findUnique.mockResolvedValue({
      id: SOCIETY_ID,
      upiId: null,
      upiQrUrl: null,
      upiAccountName: null,
    });
    const res = await GET(makeGetRequest(), makeParams());
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.upiId).toBeNull();
    expect(body.upiQrUrl).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// PATCH /api/v1/societies/[id]/payment-setup/upi
// ---------------------------------------------------------------------------

describe("PATCH /api/v1/societies/[id]/payment-setup/upi", () => {
  const validBody = {
    upiId: "society@hdfc",
    upiQrUrl: "https://example.com/qr.png",
    upiAccountName: "Society RWA",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetFullAccessAdmin.mockResolvedValue(mockAdmin);
    mockPrisma.society.update.mockResolvedValue({
      upiId: "society@hdfc",
      upiQrUrl: "https://example.com/qr.png",
      upiAccountName: "Society RWA",
    });
  });

  it("returns 401 when not authenticated", async () => {
    mockGetFullAccessAdmin.mockResolvedValue(null);
    const res = await PATCH(makePatchRequest(validBody), makeParams());
    expect(res.status).toBe(401);
  });

  it("returns 401 when admin has READ_ONLY permission", async () => {
    mockGetFullAccessAdmin.mockResolvedValue(null);
    const res = await PATCH(makePatchRequest(validBody), makeParams());
    expect(res.status).toBe(401);
  });

  it("returns 404 when society belongs to a different admin", async () => {
    mockGetFullAccessAdmin.mockResolvedValue({ ...mockAdmin, societyId: "other-soc" });
    const res = await PATCH(makePatchRequest(validBody), makeParams());
    expect(res.status).toBe(404);
  });

  it("returns 422 when upiId is missing", async () => {
    const res = await PATCH(makePatchRequest({}), makeParams());
    expect(res.status).toBe(422);
  });

  it("returns 422 when upiId has invalid format", async () => {
    const res = await PATCH(makePatchRequest({ upiId: "notvalidformat" }), makeParams());
    expect(res.status).toBe(422);
  });

  it("returns 200 with updated UPI settings on success", async () => {
    const res = await PATCH(makePatchRequest(validBody), makeParams());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.upiId).toBe("society@hdfc");
    expect(body.upiQrUrl).toBe("https://example.com/qr.png");
  });

  it("updates society with null upiQrUrl when not provided", async () => {
    mockPrisma.society.update.mockResolvedValue({
      upiId: "society@hdfc",
      upiQrUrl: null,
      upiAccountName: null,
    });
    await PATCH(makePatchRequest({ upiId: "society@hdfc" }), makeParams());
    expect(mockPrisma.society.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ upiQrUrl: null, upiAccountName: null }),
      }),
    );
  });

  it("passes upiAccountName to the update", async () => {
    await PATCH(makePatchRequest(validBody), makeParams());
    expect(mockPrisma.society.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ upiAccountName: "Society RWA" }),
      }),
    );
  });
});

// ---------------------------------------------------------------------------
// POST /api/v1/societies/[id]/payment-setup/upi/upload-qr
// ---------------------------------------------------------------------------

describe("POST /api/v1/societies/[id]/payment-setup/upi/upload-qr", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetFullAccessAdmin.mockResolvedValue(mockAdmin);
    mockStorageBucket.upload.mockResolvedValue({ error: null });
    mockStorageBucket.getPublicUrl.mockReturnValue({
      data: { publicUrl: "https://example.com/societies/soc-uuid-1/upi-qr.png" },
    });
    mockPrisma.society.update.mockResolvedValue({});
  });

  it("returns 401 when not authenticated", async () => {
    mockGetFullAccessAdmin.mockResolvedValue(null);
    const res = await POST(makeUploadRequest(makeFile()), makeParams());
    expect(res.status).toBe(401);
  });

  it("returns 404 when society belongs to a different admin", async () => {
    mockGetFullAccessAdmin.mockResolvedValue({ ...mockAdmin, societyId: "other-soc" });
    const res = await POST(makeUploadRequest(makeFile()), makeParams());
    expect(res.status).toBe(404);
  });

  it("returns 400 when no file provided", async () => {
    const res = await POST(makeUploadRequest(), makeParams());
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("NO_FILE");
  });

  it("returns 400 when file exceeds 2 MB", async () => {
    const bigFile = makeFile("qr.png", "image/png", 3 * 1024 * 1024);
    const res = await POST(makeUploadRequest(bigFile), makeParams());
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("FILE_TOO_LARGE");
  });

  it("returns 400 for disallowed file type", async () => {
    const badFile = makeFile("qr.gif", "image/gif", 1024);
    const res = await POST(makeUploadRequest(badFile), makeParams());
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("INVALID_FILE_TYPE");
  });

  it("accepts JPEG files", async () => {
    const res = await POST(makeUploadRequest(makeFile("qr.jpg", "image/jpeg")), makeParams());
    expect(res.status).toBe(200);
  });

  it("accepts PNG files", async () => {
    const res = await POST(makeUploadRequest(makeFile("qr.png", "image/png")), makeParams());
    expect(res.status).toBe(200);
  });

  it("accepts WebP files", async () => {
    const res = await POST(makeUploadRequest(makeFile("qr.webp", "image/webp")), makeParams());
    expect(res.status).toBe(200);
  });

  it("returns 500 when storage upload fails", async () => {
    mockStorageBucket.upload.mockResolvedValue({ error: new Error("Storage error") });
    const res = await POST(makeUploadRequest(makeFile()), makeParams());
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error.code).toBe("UPLOAD_FAILED");
  });

  it("uploads to the societies bucket", async () => {
    await POST(makeUploadRequest(makeFile()), makeParams());
    expect(mockSupabaseAdmin.storage.from).toHaveBeenCalledWith("societies");
  });

  it("uploads with upsert:true", async () => {
    await POST(makeUploadRequest(makeFile()), makeParams());
    expect(mockStorageBucket.upload).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(ArrayBuffer),
      expect.objectContaining({ upsert: true }),
    );
  });

  it("uses societyId in storage path", async () => {
    await POST(makeUploadRequest(makeFile()), makeParams());
    expect(mockStorageBucket.upload).toHaveBeenCalledWith(
      expect.stringContaining(SOCIETY_ID),
      expect.any(ArrayBuffer),
      expect.any(Object),
    );
  });

  it("persists the public URL to society.upiQrUrl", async () => {
    await POST(makeUploadRequest(makeFile()), makeParams());
    expect(mockPrisma.society.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: SOCIETY_ID },
        data: expect.objectContaining({ upiQrUrl: expect.any(String) }),
      }),
    );
  });

  it("returns 200 with public url on success", async () => {
    const res = await POST(makeUploadRequest(makeFile()), makeParams());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.url).toContain("societies");
  });
});
