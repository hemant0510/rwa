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

import { GET, POST } from "@/app/api/v1/residents/me/support/[id]/attachments/route";

const mockResident = {
  userId: "u-1",
  authUserId: "auth-1",
  societyId: "soc-1",
  role: "RESIDENT",
  adminPermission: null,
};

const makeParams = (id = "t-1") => ({ params: Promise.resolve({ id }) });

const mockUpload = vi.fn().mockResolvedValue({ error: null });
const mockCreateSignedUrl = vi.fn().mockResolvedValue({
  data: { signedUrl: "https://signed-url" },
});
const mockStorage = {
  from: vi.fn(() => ({
    upload: mockUpload,
    createSignedUrl: mockCreateSignedUrl,
  })),
};

function makeGetReq() {
  return new Request("http://localhost/api/v1/residents/me/support/t-1/attachments");
}

function makeUploadReq(file?: File, messageId?: string) {
  const formData = new FormData();
  if (file) formData.append("file", file);
  if (messageId) formData.append("messageId", messageId);
  return { formData: vi.fn().mockResolvedValue(formData) } as unknown as Request;
}

const baseTicket = {
  id: "t-1",
  societyId: "soc-1",
  createdBy: "u-1",
  status: "OPEN",
};

const baseAttachment = {
  id: "att-1",
  ticketId: "t-1",
  messageId: null,
  fileName: "photo.jpg",
  mimeType: "image/jpeg",
  fileSize: 1024,
  fileUrl: "soc-1/t-1/12345-photo.jpg",
  uploadedBy: "u-1",
  createdAt: new Date("2026-01-01"),
};

describe("Resident Support Attachments API — GET + POST", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCurrentUser.mockResolvedValue(mockResident);
    mockPrisma.residentTicket.findUnique.mockResolvedValue(baseTicket);
    mockPrisma.residentTicketAttachment.findMany.mockResolvedValue([]);
    mockPrisma.residentTicketAttachment.create.mockResolvedValue(baseAttachment);
    mockLogAudit.mockResolvedValue(undefined);
    mockEnsureBucket.mockResolvedValue(undefined);
    mockCreateAdminClient.mockReturnValue({ storage: mockStorage });
    mockUpload.mockResolvedValue({ error: null });
    mockCreateSignedUrl.mockResolvedValue({
      data: { signedUrl: "https://signed-url" },
    });
  });

  // ── GET ──────────────────────────────────────────────────────────

  it("GET returns 401 when not authenticated", async () => {
    mockGetCurrentUser.mockResolvedValue(null);
    const res = await GET(makeGetReq() as never, makeParams());
    expect(res.status).toBe(401);
  });

  it("GET returns 404 when ticket not found", async () => {
    mockPrisma.residentTicket.findUnique.mockResolvedValue(null);
    const res = await GET(makeGetReq() as never, makeParams());
    expect(res.status).toBe(404);
  });

  it("GET returns attachments with signed URLs", async () => {
    mockPrisma.residentTicketAttachment.findMany.mockResolvedValue([baseAttachment]);
    const res = await GET(makeGetReq() as never, makeParams());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveLength(1);
    expect(body[0]).toMatchObject({
      id: "att-1",
      ticketId: "t-1",
      fileName: "photo.jpg",
      signedUrl: "https://signed-url",
    });
    expect(mockStorage.from).toHaveBeenCalledWith("resident-ticket-attachments");
  });

  it("GET returns empty array when no attachments", async () => {
    mockPrisma.residentTicketAttachment.findMany.mockResolvedValue([]);
    const res = await GET(makeGetReq() as never, makeParams());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual([]);
  });

  it("GET returns 500 on DB error", async () => {
    mockPrisma.residentTicket.findUnique.mockRejectedValue(new Error("DB down"));
    const res = await GET(makeGetReq() as never, makeParams());
    expect(res.status).toBe(500);
  });

  // ── POST ─────────────────────────────────────────────────────────

  it("POST returns 401 when not authenticated", async () => {
    mockGetCurrentUser.mockResolvedValue(null);
    const file = new File(["test"], "test.jpg", { type: "image/jpeg" });
    const res = await POST(makeUploadReq(file) as never, makeParams());
    expect(res.status).toBe(401);
  });

  it("POST returns 404 when ticket not found", async () => {
    mockPrisma.residentTicket.findUnique.mockResolvedValue(null);
    const file = new File(["test"], "test.jpg", { type: "image/jpeg" });
    const res = await POST(makeUploadReq(file) as never, makeParams());
    expect(res.status).toBe(404);
  });

  it("POST returns 403 when not ticket creator", async () => {
    mockPrisma.residentTicket.findUnique.mockResolvedValue({
      ...baseTicket,
      createdBy: "other-user",
    });
    const file = new File(["test"], "test.jpg", { type: "image/jpeg" });
    const res = await POST(makeUploadReq(file) as never, makeParams());
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error.message).toContain("Only ticket creator");
  });

  it("POST returns 400 when ticket is CLOSED", async () => {
    mockPrisma.residentTicket.findUnique.mockResolvedValue({
      ...baseTicket,
      status: "CLOSED",
    });
    const file = new File(["test"], "test.jpg", { type: "image/jpeg" });
    const res = await POST(makeUploadReq(file) as never, makeParams());
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.message).toContain("closed ticket");
  });

  it("POST returns 400 when no file provided", async () => {
    const res = await POST(makeUploadReq() as never, makeParams());
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.message).toContain("No file provided");
  });

  it("POST returns 400 for invalid MIME type", async () => {
    const file = new File(["test"], "archive.zip", { type: "application/zip" });
    const res = await POST(makeUploadReq(file) as never, makeParams());
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.message).toContain("Invalid file type");
  });

  it("POST returns 400 when file exceeds 5MB", async () => {
    const file = new File(["test"], "large.jpg", { type: "image/jpeg" });
    Object.defineProperty(file, "size", { value: 6 * 1024 * 1024 });
    const res = await POST(makeUploadReq(file) as never, makeParams());
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.message).toContain("5MB");
  });

  it("POST successfully uploads file and creates attachment record", async () => {
    const file = new File(["test content"], "test.jpg", { type: "image/jpeg" });
    const res = await POST(makeUploadReq(file) as never, makeParams());
    expect(res.status).toBe(201);
    expect(mockEnsureBucket).toHaveBeenCalled();
    expect(mockStorage.from).toHaveBeenCalledWith("resident-ticket-attachments");
    expect(mockUpload).toHaveBeenCalledWith(
      expect.stringContaining("soc-1/t-1/"),
      expect.any(ArrayBuffer),
      { contentType: "image/jpeg", upsert: false },
    );
    expect(mockPrisma.residentTicketAttachment.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        ticketId: "t-1",
        uploadedBy: "u-1",
        fileName: "test.jpg",
        mimeType: "image/jpeg",
      }),
    });
  });

  it("POST includes optional messageId in attachment", async () => {
    const file = new File(["test content"], "test.jpg", { type: "image/jpeg" });
    const res = await POST(makeUploadReq(file, "msg-1") as never, makeParams());
    expect(res.status).toBe(201);
    expect(mockPrisma.residentTicketAttachment.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        messageId: "msg-1",
      }),
    });
  });

  it("POST calls logAudit on success", async () => {
    const file = new File(["test content"], "test.jpg", { type: "image/jpeg" });
    await POST(makeUploadReq(file) as never, makeParams());
    expect(mockLogAudit).toHaveBeenCalledWith({
      actionType: "RESIDENT_TICKET_ATTACHMENT_UPLOADED",
      userId: "u-1",
      societyId: "soc-1",
      entityType: "ResidentTicketAttachment",
      entityId: "att-1",
    });
  });

  it("POST returns 500 when storage upload fails", async () => {
    mockUpload.mockResolvedValue({ error: { message: "Storage full" } });
    const file = new File(["test content"], "test.jpg", { type: "image/jpeg" });
    const res = await POST(makeUploadReq(file) as never, makeParams());
    expect(res.status).toBe(500);
  });

  it("POST returns 500 on DB error", async () => {
    mockPrisma.residentTicketAttachment.create.mockRejectedValue(new Error("DB down"));
    const file = new File(["test content"], "test.jpg", { type: "image/jpeg" });
    const res = await POST(makeUploadReq(file) as never, makeParams());
    expect(res.status).toBe(500);
  });
});
