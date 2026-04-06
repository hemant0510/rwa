import { NextRequest } from "next/server";

import { beforeEach, describe, expect, it, vi } from "vitest";

const mockRequireSuperAdmin = vi.hoisted(() => vi.fn());

vi.mock("@/lib/auth-guard", () => ({
  requireSuperAdmin: mockRequireSuperAdmin,
}));

// eslint-disable-next-line import/order
import { mockPrisma } from "../__mocks__/prisma";
// eslint-disable-next-line import/order
import { mockStorageBucket, mockSupabaseAdmin } from "../__mocks__/supabase";

vi.mock("@/lib/supabase/ensure-bucket", () => ({
  ensureBucket: vi.fn().mockResolvedValue(undefined),
}));

import { GET } from "@/app/api/v1/super-admin/platform-payment-setup/route";
import { PATCH } from "@/app/api/v1/super-admin/platform-payment-setup/upi/route";
import { POST } from "@/app/api/v1/super-admin/platform-payment-setup/upload-qr/route";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const SA_CONTEXT = {
  superAdminId: "sa-uuid-1",
  authUserId: "auth-sa-1",
  email: "sa@example.com",
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makePatchRequest(body: unknown) {
  return new Request("http://localhost/api/v1/super-admin/platform-payment-setup", {
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
// Setup
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
  mockRequireSuperAdmin.mockResolvedValue({ data: SA_CONTEXT, error: null });
});

// ───────────────────────────────────────────────────────────────────────────
// GET /api/v1/super-admin/platform-payment-setup
// ───────────────────────────────────────────────────────────────────────────

describe("GET /api/v1/super-admin/platform-payment-setup", () => {
  it("returns 401 when not authenticated", async () => {
    mockRequireSuperAdmin.mockResolvedValue({
      data: null,
      error: new Response(JSON.stringify({ error: { code: "UNAUTHORIZED" } }), { status: 401 }),
    });

    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("returns 403 when not super admin", async () => {
    mockRequireSuperAdmin.mockResolvedValue({
      data: null,
      error: new Response(JSON.stringify({ error: { code: "FORBIDDEN" } }), { status: 403 }),
    });

    const res = await GET();
    expect(res.status).toBe(403);
  });

  it("returns platform UPI settings with values", async () => {
    mockPrisma.platformSetting.findMany.mockResolvedValue([
      { settingKey: "platform_upi_id", settingValue: "rwaconnect@icici" },
      { settingKey: "platform_upi_qr_url", settingValue: "https://example.com/qr.png" },
      { settingKey: "platform_upi_account_name", settingValue: "RWA Connect" },
    ]);

    const res = await GET();
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.platformUpiId).toBe("rwaconnect@icici");
    expect(data.platformUpiQrUrl).toBe("https://example.com/qr.png");
    expect(data.platformUpiAccountName).toBe("RWA Connect");
  });

  it("returns null for empty settings", async () => {
    mockPrisma.platformSetting.findMany.mockResolvedValue([]);

    const res = await GET();
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.platformUpiId).toBeNull();
    expect(data.platformUpiQrUrl).toBeNull();
    expect(data.platformUpiAccountName).toBeNull();
  });

  it("returns null for empty-string setting values", async () => {
    mockPrisma.platformSetting.findMany.mockResolvedValue([
      { settingKey: "platform_upi_id", settingValue: "" },
      { settingKey: "platform_upi_qr_url", settingValue: "" },
      { settingKey: "platform_upi_account_name", settingValue: "" },
    ]);

    const res = await GET();
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.platformUpiId).toBeNull();
    expect(data.platformUpiQrUrl).toBeNull();
    expect(data.platformUpiAccountName).toBeNull();
  });

  it("returns 500 on database error", async () => {
    mockPrisma.platformSetting.findMany.mockRejectedValue(new Error("DB error"));

    const res = await GET();
    expect(res.status).toBe(500);
  });
});

// ───────────────────────────────────────────────────────────────────────────
// PATCH /api/v1/super-admin/platform-payment-setup
// ───────────────────────────────────────────────────────────────────────────

describe("PATCH /api/v1/super-admin/platform-payment-setup", () => {
  it("returns 401 when not authenticated", async () => {
    mockRequireSuperAdmin.mockResolvedValue({
      data: null,
      error: new Response(JSON.stringify({ error: { code: "UNAUTHORIZED" } }), { status: 401 }),
    });

    const res = await PATCH(makePatchRequest({ platformUpiId: "rwa@sbi" }));
    expect(res.status).toBe(401);
  });

  it("returns 422 when platformUpiId missing", async () => {
    const res = await PATCH(makePatchRequest({}));
    expect(res.status).toBe(422);
  });

  it("returns 422 when platformUpiId format is invalid", async () => {
    const res = await PATCH(makePatchRequest({ platformUpiId: "invalid-format" }));
    expect(res.status).toBe(422);
  });

  it("updates settings on valid request", async () => {
    mockPrisma.platformSetting.upsert.mockResolvedValue({});

    const res = await PATCH(
      makePatchRequest({
        platformUpiId: "rwaconnect@icici",
        platformUpiAccountName: "RWA Connect",
      }),
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.platformUpiId).toBe("rwaconnect@icici");
    expect(data.platformUpiAccountName).toBe("RWA Connect");
    expect(data.platformUpiQrUrl).toBeNull();
  });

  it("upserts all three setting keys", async () => {
    mockPrisma.platformSetting.upsert.mockResolvedValue({});

    await PATCH(
      makePatchRequest({
        platformUpiId: "test@bank",
        platformUpiQrUrl: "https://example.com/qr.png",
        platformUpiAccountName: "Test",
      }),
    );

    expect(mockPrisma.platformSetting.upsert).toHaveBeenCalledTimes(3);
    const keys = mockPrisma.platformSetting.upsert.mock.calls.map(
      (c: Array<{ where: { settingKey: string } }>) => c[0].where.settingKey,
    );
    expect(keys).toContain("platform_upi_id");
    expect(keys).toContain("platform_upi_qr_url");
    expect(keys).toContain("platform_upi_account_name");
  });

  it("returns 500 on database error", async () => {
    mockPrisma.platformSetting.upsert.mockRejectedValue(new Error("DB error"));

    const res = await PATCH(makePatchRequest({ platformUpiId: "rwa@sbi" }));
    expect(res.status).toBe(500);
  });

  it("returns 500 on invalid JSON body", async () => {
    const req = new Request("http://localhost/api/v1/super-admin/platform-payment-setup", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: "not valid json{{{",
    });
    const res = await PATCH(req);
    expect(res.status).toBe(500);
  });

  it("stores empty string for missing optional fields", async () => {
    mockPrisma.platformSetting.upsert.mockResolvedValue({});

    const res = await PATCH(makePatchRequest({ platformUpiId: "rwa@sbi" }));
    expect(res.status).toBe(200);

    // Verify the QR URL and account name upserts use empty string for undefined values
    const calls = mockPrisma.platformSetting.upsert.mock.calls;
    const qrCall = calls.find(
      (c: Array<{ where: { settingKey: string } }>) =>
        c[0].where.settingKey === "platform_upi_qr_url",
    );
    expect(qrCall![0].update.settingValue).toBe("");
    expect(qrCall![0].create.settingValue).toBe("");

    const nameCall = calls.find(
      (c: Array<{ where: { settingKey: string } }>) =>
        c[0].where.settingKey === "platform_upi_account_name",
    );
    expect(nameCall![0].update.settingValue).toBe("");
    expect(nameCall![0].create.settingValue).toBe("");
  });
});

// ───────────────────────────────────────────────────────────────────────────
// POST /api/v1/super-admin/platform-payment-setup/upload-qr
// ───────────────────────────────────────────────────────────────────────────

describe("POST /api/v1/super-admin/platform-payment-setup/upload-qr", () => {
  it("returns 401 when not authenticated", async () => {
    mockRequireSuperAdmin.mockResolvedValue({
      data: null,
      error: new Response(JSON.stringify({ error: { code: "UNAUTHORIZED" } }), { status: 401 }),
    });

    const res = await POST(makeUploadRequest(makeFile()));
    expect(res.status).toBe(401);
  });

  it("returns 400 when no file provided", async () => {
    const res = await POST(makeUploadRequest());
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error.code).toBe("NO_FILE");
  });

  it("returns 400 when file exceeds 2MB", async () => {
    const bigFile = makeFile("big.png", "image/png", 3 * 1024 * 1024);
    const res = await POST(makeUploadRequest(bigFile));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error.code).toBe("FILE_TOO_LARGE");
  });

  it("returns 400 for invalid file type", async () => {
    const gifFile = makeFile("anim.gif", "image/gif", 1024);
    const res = await POST(makeUploadRequest(gifFile));
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error.code).toBe("INVALID_FILE_TYPE");
  });

  it("accepts JPEG file", async () => {
    mockStorageBucket.upload.mockResolvedValue({ error: null });
    mockStorageBucket.getPublicUrl.mockReturnValue({
      data: { publicUrl: "https://storage.example.com/platform/upi-qr.png" },
    });
    mockPrisma.platformSetting.upsert.mockResolvedValue({});

    const res = await POST(makeUploadRequest(makeFile("qr.jpg", "image/jpeg")));
    expect(res.status).toBe(200);
  });

  it("accepts WebP file", async () => {
    mockStorageBucket.upload.mockResolvedValue({ error: null });
    mockStorageBucket.getPublicUrl.mockReturnValue({
      data: { publicUrl: "https://storage.example.com/platform/upi-qr.png" },
    });
    mockPrisma.platformSetting.upsert.mockResolvedValue({});

    const res = await POST(makeUploadRequest(makeFile("qr.webp", "image/webp")));
    expect(res.status).toBe(200);
  });

  it("returns 500 when storage upload fails", async () => {
    mockStorageBucket.upload.mockResolvedValue({ error: { message: "Storage error" } });

    const res = await POST(makeUploadRequest(makeFile()));
    expect(res.status).toBe(500);
    const data = await res.json();
    expect(data.error.code).toBe("UPLOAD_FAILED");
  });

  it("uploads to platform-assets bucket with correct path", async () => {
    mockStorageBucket.upload.mockResolvedValue({ error: null });
    mockStorageBucket.getPublicUrl.mockReturnValue({
      data: { publicUrl: "https://storage.example.com/platform/upi-qr.png" },
    });
    mockPrisma.platformSetting.upsert.mockResolvedValue({});

    await POST(makeUploadRequest(makeFile()));

    expect(mockSupabaseAdmin.storage.from).toHaveBeenCalledWith("platform-assets");
    expect(mockStorageBucket.upload).toHaveBeenCalledWith(
      "platform/upi-qr.png",
      expect.any(ArrayBuffer),
      expect.objectContaining({ contentType: "image/png", upsert: true }),
    );
  });

  it("persists URL in platform_settings", async () => {
    mockStorageBucket.upload.mockResolvedValue({ error: null });
    mockStorageBucket.getPublicUrl.mockReturnValue({
      data: { publicUrl: "https://storage.example.com/platform/upi-qr.png" },
    });
    mockPrisma.platformSetting.upsert.mockResolvedValue({});

    await POST(makeUploadRequest(makeFile()));

    expect(mockPrisma.platformSetting.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { settingKey: "platform_upi_qr_url" },
        update: { settingValue: "https://storage.example.com/platform/upi-qr.png" },
      }),
    );
  });

  it("returns public URL on success", async () => {
    mockStorageBucket.upload.mockResolvedValue({ error: null });
    mockStorageBucket.getPublicUrl.mockReturnValue({
      data: { publicUrl: "https://storage.example.com/platform/upi-qr.png" },
    });
    mockPrisma.platformSetting.upsert.mockResolvedValue({});

    const res = await POST(makeUploadRequest(makeFile()));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.url).toBe("https://storage.example.com/platform/upi-qr.png");
  });

  it("returns 500 on unexpected error in try block", async () => {
    mockStorageBucket.upload.mockResolvedValue({ error: null });
    mockStorageBucket.getPublicUrl.mockReturnValue({
      data: { publicUrl: "https://storage.example.com/platform/upi-qr.png" },
    });
    mockPrisma.platformSetting.upsert.mockRejectedValue(new Error("DB error"));

    const res = await POST(makeUploadRequest(makeFile()));
    expect(res.status).toBe(500);
  });
});
