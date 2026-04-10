import { NextRequest } from "next/server";

import { describe, it, expect, vi, beforeEach } from "vitest";

const mockGetCurrentUser = vi.hoisted(() => vi.fn());
const mockPrisma = vi.hoisted(() => ({
  residentTicket: { findUnique: vi.fn() },
  residentTicketAttachment: { findMany: vi.fn(), create: vi.fn() },
}));
const mockLogAudit = vi.hoisted(() => vi.fn());
const mockCreateAdminClient = vi.hoisted(() => vi.fn());
const mockEnsureBucket = vi.hoisted(() => vi.fn());

vi.mock("@/lib/get-current-user", () => ({ getCurrentUser: mockGetCurrentUser }));
vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/audit", () => ({ logAudit: mockLogAudit }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: mockCreateAdminClient }));
vi.mock("@/lib/supabase/ensure-bucket", () => ({ ensureBucket: mockEnsureBucket }));

import { GET, POST } from "@/app/api/v1/admin/resident-support/[id]/attachments/route";

const mockAdmin = {
  userId: "u-1",
  authUserId: "auth-1",
  societyId: "soc-1",
  role: "RWA_ADMIN",
  adminPermission: "FULL_ACCESS",
};

const makeParams = (id = "t-1") => ({ params: Promise.resolve({ id }) }) as never;

// ─── Supabase storage mocks ─────────────────────────────────────

const mockUpload = vi.fn().mockResolvedValue({ error: null });
const mockCreateSignedUrl = vi.fn().mockResolvedValue({
  data: { signedUrl: "https://signed" },
});

function setupStorageMock() {
  mockCreateAdminClient.mockReturnValue({
    storage: {
      from: vi.fn(() => ({
        upload: mockUpload,
        createSignedUrl: mockCreateSignedUrl,
      })),
    },
  });
}

// ─── Helpers ─────────────────────────────────────────────────────

function makeUploadReq(file?: { name: string; type: string; size: number }) {
  const formData = new FormData();
  if (file) {
    formData.append("file", new File(["x"], file.name, { type: file.type }));
  }
  return {
    formData: vi.fn().mockResolvedValue(formData),
  } as unknown as NextRequest;
}

const mockAttachments = [
  {
    id: "a-1",
    ticketId: "t-1",
    messageId: null,
    fileName: "photo.jpg",
    mimeType: "image/jpeg",
    fileSize: 1024,
    fileUrl: "soc-1/t-1/photo.jpg",
    uploadedBy: "u-1",
    createdAt: "2024-01-01T00:00:00Z",
  },
  {
    id: "a-2",
    ticketId: "t-1",
    messageId: "m-1",
    fileName: "doc.pdf",
    mimeType: "application/pdf",
    fileSize: 2048,
    fileUrl: "soc-1/t-1/doc.pdf",
    uploadedBy: "u-1",
    createdAt: "2024-01-02T00:00:00Z",
  },
];

// ─── GET Tests ───────────────────────────────────────────────────

describe("GET /api/v1/admin/resident-support/[id]/attachments", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCurrentUser.mockResolvedValue(mockAdmin);
    mockLogAudit.mockResolvedValue(undefined);
    mockEnsureBucket.mockResolvedValue(undefined);
    setupStorageMock();

    mockPrisma.residentTicket.findUnique.mockResolvedValue({ id: "t-1" });
    mockPrisma.residentTicketAttachment.findMany.mockResolvedValue(mockAttachments);
  });

  it("returns 403 when not admin", async () => {
    mockGetCurrentUser.mockResolvedValue(null);

    const res = await GET(new NextRequest("http://localhost"), makeParams());
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(body.error.code).toBe("FORBIDDEN");
  });

  it("returns 404 when ticket not found", async () => {
    mockPrisma.residentTicket.findUnique.mockResolvedValue(null);

    const res = await GET(new NextRequest("http://localhost"), makeParams());
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.error.code).toBe("NOT_FOUND");
  });

  it("returns attachments with signed URLs", async () => {
    const res = await GET(new NextRequest("http://localhost"), makeParams());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toHaveLength(2);
    expect(body[0].id).toBe("a-1");
    expect(body[0].signedUrl).toBe("https://signed");
    expect(body[1].id).toBe("a-2");
    expect(body[1].signedUrl).toBe("https://signed");

    expect(mockCreateSignedUrl).toHaveBeenCalledTimes(2);
  });

  it("returns 500 on DB error", async () => {
    mockPrisma.residentTicket.findUnique.mockRejectedValue(new Error("DB fail"));

    const res = await GET(new NextRequest("http://localhost"), makeParams());
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error.code).toBe("INTERNAL_ERROR");
  });
});

// ─── POST Tests ──────────────────────────────────────────────────

describe("POST /api/v1/admin/resident-support/[id]/attachments", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCurrentUser.mockResolvedValue(mockAdmin);
    mockLogAudit.mockResolvedValue(undefined);
    mockEnsureBucket.mockResolvedValue(undefined);
    setupStorageMock();

    mockPrisma.residentTicket.findUnique.mockResolvedValue({
      id: "t-1",
      societyId: "soc-1",
    });
    mockPrisma.residentTicketAttachment.create.mockResolvedValue({
      id: "a-new",
      ticketId: "t-1",
      fileName: "photo.jpg",
      mimeType: "image/jpeg",
      fileSize: 1,
      fileUrl: "soc-1/t-1/123-photo.jpg",
      uploadedBy: "u-1",
    });
  });

  it("returns 403 when not admin", async () => {
    mockGetCurrentUser.mockResolvedValue(null);

    const req = makeUploadReq({ name: "photo.jpg", type: "image/jpeg", size: 1024 });
    const res = await POST(req, makeParams());
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(body.error.code).toBe("FORBIDDEN");
  });

  it("returns 403 for READ_NOTIFY", async () => {
    mockGetCurrentUser.mockResolvedValue({ ...mockAdmin, adminPermission: "READ_NOTIFY" });

    const req = makeUploadReq({ name: "photo.jpg", type: "image/jpeg", size: 1024 });
    const res = await POST(req, makeParams());
    const body = await res.json();

    expect(res.status).toBe(403);
    expect(body.error.code).toBe("FORBIDDEN");
  });

  it("returns 404 when ticket not found", async () => {
    mockPrisma.residentTicket.findUnique.mockResolvedValue(null);

    const req = makeUploadReq({ name: "photo.jpg", type: "image/jpeg", size: 1024 });
    const res = await POST(req, makeParams());
    const body = await res.json();

    expect(res.status).toBe(404);
    expect(body.error.code).toBe("NOT_FOUND");
  });

  it("returns 400 when no file", async () => {
    const req = makeUploadReq(); // no file
    const res = await POST(req, makeParams());
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error.message).toBe("No file provided");
  });

  it("returns 400 for invalid MIME type", async () => {
    const req = makeUploadReq({ name: "script.exe", type: "application/x-msdownload", size: 100 });
    const res = await POST(req, makeParams());
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error.message).toContain("Invalid file type");
  });

  it("returns 400 when file too large", async () => {
    // Create a FormData with an oversized file mock
    const formData = new FormData();
    const bigFile = new File(["x"], "big.jpg", { type: "image/jpeg" });
    Object.defineProperty(bigFile, "size", { value: 6 * 1024 * 1024 });
    formData.append("file", bigFile);

    const req = {
      formData: vi.fn().mockResolvedValue(formData),
    } as unknown as NextRequest;

    const res = await POST(req, makeParams());
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error.message).toContain("5MB limit");
  });

  it("successfully uploads and creates attachment", async () => {
    const req = makeUploadReq({ name: "photo.jpg", type: "image/jpeg", size: 1024 });
    const res = await POST(req, makeParams());
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.id).toBe("a-new");
    expect(body.fileName).toBe("photo.jpg");

    expect(mockEnsureBucket).toHaveBeenCalled();
    expect(mockUpload).toHaveBeenCalledWith(
      expect.stringContaining("soc-1/t-1/"),
      expect.any(ArrayBuffer),
      expect.objectContaining({ contentType: "image/jpeg", upsert: false }),
    );

    expect(mockPrisma.residentTicketAttachment.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        ticketId: "t-1",
        fileName: "photo.jpg",
        mimeType: "image/jpeg",
        uploadedBy: "u-1",
      }),
    });

    expect(mockLogAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        actionType: "RESIDENT_TICKET_ATTACHMENT_UPLOADED",
        entityType: "ResidentTicketAttachment",
        entityId: "a-new",
      }),
    );
  });

  it("returns 500 when storage upload fails", async () => {
    mockUpload.mockResolvedValueOnce({ error: { message: "Storage quota exceeded" } });

    const req = makeUploadReq({ name: "photo.jpg", type: "image/jpeg", size: 1024 });
    const res = await POST(req, makeParams());
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error.message).toContain("Storage error");
  });

  it("returns 500 on DB error", async () => {
    mockPrisma.residentTicket.findUnique.mockRejectedValue(new Error("DB fail"));

    const req = makeUploadReq({ name: "photo.jpg", type: "image/jpeg", size: 1024 });
    const res = await POST(req, makeParams());
    const body = await res.json();

    expect(res.status).toBe(500);
    expect(body.error.code).toBe("INTERNAL_ERROR");
  });
});
