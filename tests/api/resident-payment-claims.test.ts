import { NextRequest } from "next/server";

import { beforeEach, describe, expect, it, vi } from "vitest";

const mockGetCurrentUser = vi.hoisted(() => vi.fn());

vi.mock("@/lib/get-current-user", () => ({
  getCurrentUser: mockGetCurrentUser,
}));

import { mockPrisma } from "../__mocks__/prisma";
import { mockStorageBucket, mockSupabaseAdmin } from "../__mocks__/supabase";

vi.mock("@/lib/supabase/ensure-bucket", () => ({
  ensureBucket: vi.fn().mockResolvedValue(undefined),
}));

// eslint-disable-next-line import/order
import { GET, POST } from "@/app/api/v1/residents/me/payment-claims/route";
// eslint-disable-next-line import/order
import { POST as POST_SCREENSHOT } from "@/app/api/v1/residents/me/payment-claims/upload-screenshot/route";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const RESIDENT_ID = "00000000-0000-4000-8000-000000000001";
const SOCIETY_ID = "00000000-0000-4000-8000-000000000002";

const FEE_ID = "00000000-0000-4000-8000-000000000003";

const mockResident = {
  userId: RESIDENT_ID,
  authUserId: "auth-1",
  societyId: SOCIETY_ID,
  role: "RESIDENT",
  adminPermission: null,
};

const mockSociety = { id: SOCIETY_ID, upiId: "society@sbi" };

const mockClaim = {
  id: "00000000-0000-4000-8000-000000000010",
  societyId: SOCIETY_ID,
  userId: RESIDENT_ID,
  membershipFeeId: FEE_ID,
  claimedAmount: 2000,
  utrNumber: "ABCD1234567890",
  paymentDate: new Date("2026-04-04"),
  screenshotUrl: null,
  status: "PENDING",
  verifiedBy: null,
  verifiedAt: null,
  rejectionReason: null,
  adminNotes: null,
  createdAt: new Date("2026-04-04T10:00:00Z"),
  updatedAt: new Date("2026-04-04T10:00:00Z"),
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRequest(method: string, body?: unknown): NextRequest {
  return new NextRequest("http://localhost/api/v1/residents/me/payment-claims", {
    method,
    headers: body ? { "Content-Type": "application/json" } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
}

function makeUploadRequest(file?: File): NextRequest {
  const formData = new FormData();
  if (file) formData.append("file", file);
  return { formData: vi.fn().mockResolvedValue(formData) } as unknown as NextRequest;
}

function makeFile(name = "ss.png", type = "image/png", sizeBytes = 1024): File {
  return new File([new Uint8Array(sizeBytes).fill(0)], name, { type });
}

const validBody = {
  membershipFeeId: FEE_ID,
  claimedAmount: 2000,
  utrNumber: "ABCD1234567890",
  paymentDate: "2026-04-04",
};

// ---------------------------------------------------------------------------
// GET /api/v1/residents/me/payment-claims
// ---------------------------------------------------------------------------

describe("GET /api/v1/residents/me/payment-claims", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCurrentUser.mockResolvedValue(mockResident);
    mockPrisma.paymentClaim.findMany.mockResolvedValue([mockClaim]);
  });

  it("returns 401 when not authenticated", async () => {
    mockGetCurrentUser.mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("returns 200 with claims list", async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.claims).toHaveLength(1);
    expect(body.claims[0].utrNumber).toBe("ABCD1234567890");
  });

  it("returns claimedAmount as a number", async () => {
    const res = await GET();
    const body = await res.json();
    expect(typeof body.claims[0].claimedAmount).toBe("number");
  });

  it("returns 500 on database error", async () => {
    mockPrisma.paymentClaim.findMany.mockRejectedValue(new Error("DB error"));
    const res = await GET();
    expect(res.status).toBe(500);
  });
});

// ---------------------------------------------------------------------------
// POST /api/v1/residents/me/payment-claims
// ---------------------------------------------------------------------------

describe("POST /api/v1/residents/me/payment-claims", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.paymentClaim.findFirst.mockReset(); // clear Once queue between tests
    mockGetCurrentUser.mockResolvedValue(mockResident);
    mockPrisma.society.findUnique.mockResolvedValue(mockSociety);
    mockPrisma.paymentClaim.findFirst.mockResolvedValue(null);
    mockPrisma.paymentClaim.create.mockResolvedValue(mockClaim);
  });

  it("returns 401 when not authenticated", async () => {
    mockGetCurrentUser.mockResolvedValue(null);
    const res = await POST(makeRequest("POST", validBody));
    expect(res.status).toBe(401);
  });

  it("returns 422 when body is invalid", async () => {
    const res = await POST(makeRequest("POST", {}));
    expect(res.status).toBe(422);
  });

  it("returns 422 when utrNumber is too short", async () => {
    const res = await POST(makeRequest("POST", { ...validBody, utrNumber: "SHORT" }));
    expect(res.status).toBe(422);
  });

  it("returns 422 when paymentDate is in the future", async () => {
    const res = await POST(makeRequest("POST", { ...validBody, paymentDate: "2099-01-01" }));
    expect(res.status).toBe(422);
  });

  it("returns 400 when society has no UPI configured", async () => {
    mockPrisma.society.findUnique.mockResolvedValue({ id: SOCIETY_ID, upiId: null });
    const res = await POST(makeRequest("POST", validBody));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("UPI_NOT_CONFIGURED");
  });

  it("returns 400 when a PENDING claim already exists for this fee", async () => {
    // Route returns 400 after 1st findFirst (PENDING check); 2nd call is never reached
    mockPrisma.paymentClaim.findFirst.mockResolvedValueOnce(mockClaim);
    const res = await POST(makeRequest("POST", validBody));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("CLAIM_ALREADY_PENDING");
  });

  it("returns 409 when UTR is a duplicate for same society", async () => {
    mockPrisma.paymentClaim.findFirst
      .mockResolvedValueOnce(null) // PENDING check
      .mockResolvedValueOnce(mockClaim); // UTR duplicate check
    const res = await POST(makeRequest("POST", validBody));
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error.code).toBe("UTR_DUPLICATE");
  });

  it("returns 201 with claim on success", async () => {
    const res = await POST(makeRequest("POST", validBody));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.claim.utrNumber).toBe("ABCD1234567890");
    expect(typeof body.claim.claimedAmount).toBe("number");
  });

  it("stores UTR as uppercase", async () => {
    await POST(makeRequest("POST", { ...validBody, utrNumber: "abcd1234567890" }));
    expect(mockPrisma.paymentClaim.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ utrNumber: "ABCD1234567890" }),
      }),
    );
  });

  it("returns 500 on database error", async () => {
    mockPrisma.paymentClaim.create.mockRejectedValue(new Error("DB error"));
    const res = await POST(makeRequest("POST", validBody));
    expect(res.status).toBe(500);
  });
});

// ---------------------------------------------------------------------------
// POST /api/v1/residents/me/payment-claims/upload-screenshot
// ---------------------------------------------------------------------------

describe("POST /api/v1/residents/me/payment-claims/upload-screenshot", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCurrentUser.mockResolvedValue(mockResident);
    mockStorageBucket.upload.mockResolvedValue({ error: null });
    mockStorageBucket.getPublicUrl.mockReturnValue({
      data: { publicUrl: "https://example.com/screenshot.png" },
    });
  });

  it("returns 401 when not authenticated", async () => {
    mockGetCurrentUser.mockResolvedValue(null);
    const res = await POST_SCREENSHOT(makeUploadRequest(makeFile()));
    expect(res.status).toBe(401);
  });

  it("returns 400 when no file provided", async () => {
    const res = await POST_SCREENSHOT(makeUploadRequest());
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("NO_FILE");
  });

  it("returns 400 when file exceeds 2MB", async () => {
    const bigFile = makeFile("ss.png", "image/png", 3 * 1024 * 1024);
    const res = await POST_SCREENSHOT(makeUploadRequest(bigFile));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("FILE_TOO_LARGE");
  });

  it("returns 400 for disallowed file type", async () => {
    const badFile = makeFile("ss.gif", "image/gif", 1024);
    const res = await POST_SCREENSHOT(makeUploadRequest(badFile));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("INVALID_FILE_TYPE");
  });

  it("accepts JPEG files", async () => {
    const res = await POST_SCREENSHOT(makeUploadRequest(makeFile("ss.jpg", "image/jpeg")));
    expect(res.status).toBe(200);
  });

  it("accepts PNG files", async () => {
    const res = await POST_SCREENSHOT(makeUploadRequest(makeFile("ss.png", "image/png")));
    expect(res.status).toBe(200);
  });

  it("accepts WebP files", async () => {
    const res = await POST_SCREENSHOT(makeUploadRequest(makeFile("ss.webp", "image/webp")));
    expect(res.status).toBe(200);
  });

  it("returns 500 when storage upload fails", async () => {
    mockStorageBucket.upload.mockResolvedValue({ error: new Error("Storage error") });
    const res = await POST_SCREENSHOT(makeUploadRequest(makeFile()));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error.code).toBe("UPLOAD_FAILED");
  });

  it("uploads to societies bucket with resident-scoped path", async () => {
    await POST_SCREENSHOT(makeUploadRequest(makeFile()));
    expect(mockSupabaseAdmin.storage.from).toHaveBeenCalledWith("societies");
    expect(mockStorageBucket.upload).toHaveBeenCalledWith(
      expect.stringContaining(SOCIETY_ID),
      expect.any(ArrayBuffer),
      expect.any(Object),
    );
  });

  it("returns 200 with public url on success", async () => {
    const res = await POST_SCREENSHOT(makeUploadRequest(makeFile()));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.url).toContain("screenshot");
  });
});
