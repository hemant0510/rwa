import { NextRequest } from "next/server";

import { describe, it, expect, vi, beforeEach } from "vitest";

const mockPrisma = vi.hoisted(() => ({
  petition: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
}));
const mockGetCurrentUser = vi.hoisted(() => vi.fn());
const mockLogAudit = vi.hoisted(() => vi.fn());
const mockBlob = vi.hoisted(() => ({
  arrayBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(8)),
}));
const mockSupabaseStorage = vi.hoisted(() => ({
  from: vi.fn().mockReturnValue({
    remove: vi.fn().mockResolvedValue({}),
    upload: vi.fn().mockResolvedValue({ error: null }),
    download: vi.fn().mockResolvedValue({ data: mockBlob, error: null }),
  }),
}));
const mockCreateClient = vi.hoisted(() =>
  vi.fn().mockReturnValue({ storage: mockSupabaseStorage }),
);

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/get-current-user", () => ({ getCurrentUser: mockGetCurrentUser }));
vi.mock("@/lib/audit", () => ({ logAudit: mockLogAudit }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: mockCreateClient }));
vi.mock("@/lib/supabase/ensure-bucket", () => ({
  ensureBucket: vi.fn().mockResolvedValue(undefined),
}));

import { GET, POST } from "@/app/api/v1/societies/[id]/petitions/[petitionId]/document/route";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeParams(societyId = "soc-1", petitionId = "pet-1") {
  return { params: Promise.resolve({ id: societyId, petitionId }) };
}

function makeFormDataRequest(file: File | string | null) {
  const formData = new FormData();
  if (file !== null) {
    formData.set("file", file);
  }
  return { formData: vi.fn().mockResolvedValue(formData) } as unknown as NextRequest;
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const mockAdmin = {
  userId: "admin-1",
  authUserId: "auth-admin-1",
  societyId: "soc-1",
  role: "RWA_ADMIN" as const,
  adminPermission: "FULL_ACCESS" as const,
};

const mockDraftPetition = {
  id: "pet-1",
  societyId: "soc-1",
  title: "Fix the playground",
  description: "The playground equipment is broken",
  type: "PETITION",
  targetAuthority: "Municipal Corporation",
  minSignatures: 50,
  deadline: new Date("2026-06-01"),
  status: "DRAFT",
  documentUrl: null,
  publishedAt: null,
  submittedAt: null,
  closedReason: null,
  createdBy: "admin-1",
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockFile = new File(["pdf content"], "petition.pdf", { type: "application/pdf" });

// ---------------------------------------------------------------------------
// POST /societies/[id]/petitions/[petitionId]/document
// ---------------------------------------------------------------------------

describe("POST /api/v1/societies/[id]/petitions/[petitionId]/document", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCurrentUser.mockResolvedValue(mockAdmin);
    mockPrisma.petition.findUnique.mockResolvedValue(mockDraftPetition);
    mockPrisma.petition.update.mockResolvedValue({
      ...mockDraftPetition,
      documentUrl: "soc-1/pet-1/123.pdf",
    });
    mockSupabaseStorage.from.mockReturnValue({
      remove: vi.fn().mockResolvedValue({}),
      upload: vi.fn().mockResolvedValue({ error: null }),
    });
  });

  it("returns 401 when not authenticated", async () => {
    mockGetCurrentUser.mockResolvedValue(null);
    const res = await POST(makeFormDataRequest(mockFile), makeParams());
    expect(res.status).toBe(401);
  });

  it("returns 404 when petition does not exist", async () => {
    mockPrisma.petition.findUnique.mockResolvedValue(null);
    const res = await POST(makeFormDataRequest(mockFile), makeParams());
    expect(res.status).toBe(404);
  });

  it("returns 404 when petition belongs to a different society", async () => {
    mockPrisma.petition.findUnique.mockResolvedValue({
      ...mockDraftPetition,
      societyId: "other-soc",
    });
    const res = await POST(makeFormDataRequest(mockFile), makeParams("soc-1", "pet-1"));
    expect(res.status).toBe(404);
  });

  it("returns 400 with NOT_DRAFT when petition is PUBLISHED", async () => {
    mockPrisma.petition.findUnique.mockResolvedValue({ ...mockDraftPetition, status: "PUBLISHED" });
    const res = await POST(makeFormDataRequest(mockFile), makeParams());
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("NOT_DRAFT");
  });

  it("returns 400 with NOT_DRAFT when petition is SUBMITTED", async () => {
    mockPrisma.petition.findUnique.mockResolvedValue({ ...mockDraftPetition, status: "SUBMITTED" });
    const res = await POST(makeFormDataRequest(mockFile), makeParams());
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("NOT_DRAFT");
  });

  it("returns 400 with NOT_DRAFT when petition is CLOSED", async () => {
    mockPrisma.petition.findUnique.mockResolvedValue({ ...mockDraftPetition, status: "CLOSED" });
    const res = await POST(makeFormDataRequest(mockFile), makeParams());
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("NOT_DRAFT");
  });

  it("returns 400 with NO_FILE when no file is in the form data", async () => {
    const res = await POST(makeFormDataRequest(null), makeParams());
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("NO_FILE");
  });

  it("returns 400 with INVALID_FILE when file field is a plain string", async () => {
    const res = await POST(makeFormDataRequest("not-a-file"), makeParams());
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("INVALID_FILE");
  });

  it("uploads document and updates petition when no existing documentUrl", async () => {
    const res = await POST(makeFormDataRequest(mockFile), makeParams());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.documentUrl).toBeDefined();
    expect(mockPrisma.petition.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "pet-1" },
        data: expect.objectContaining({ documentUrl: expect.any(String) }),
      }),
    );
  });

  it("skips storage removal when petition has no existing documentUrl", async () => {
    const mockRemove = vi.fn().mockResolvedValue({});
    mockSupabaseStorage.from.mockReturnValue({
      remove: mockRemove,
      upload: vi.fn().mockResolvedValue({ error: null }),
    });

    await POST(makeFormDataRequest(mockFile), makeParams());

    // remove should NOT be called because documentUrl is null
    expect(mockRemove).not.toHaveBeenCalled();
  });

  it("removes old document from storage before uploading when documentUrl exists", async () => {
    const mockRemove = vi.fn().mockResolvedValue({});
    const mockUpload = vi.fn().mockResolvedValue({ error: null });
    mockSupabaseStorage.from.mockReturnValue({ remove: mockRemove, upload: mockUpload });

    mockPrisma.petition.findUnique.mockResolvedValue({
      ...mockDraftPetition,
      documentUrl: "soc-1/pet-1/old-doc.pdf",
    });

    const res = await POST(makeFormDataRequest(mockFile), makeParams());

    expect(res.status).toBe(200);
    expect(mockSupabaseStorage.from).toHaveBeenCalledWith("petition-docs");
    expect(mockRemove).toHaveBeenCalledWith(["soc-1/pet-1/old-doc.pdf"]);
    expect(mockUpload).toHaveBeenCalled();
  });

  it("returns 500 when storage upload fails", async () => {
    mockSupabaseStorage.from.mockReturnValue({
      remove: vi.fn().mockResolvedValue({}),
      upload: vi.fn().mockResolvedValue({ error: { message: "bucket full" } }),
    });

    const res = await POST(makeFormDataRequest(mockFile), makeParams());
    expect(res.status).toBe(500);
  });

  it("stores the correct storage path with societyId and petitionId prefix", async () => {
    const mockUpload = vi.fn().mockResolvedValue({ error: null });
    mockSupabaseStorage.from.mockReturnValue({
      remove: vi.fn().mockResolvedValue({}),
      upload: mockUpload,
    });

    await POST(makeFormDataRequest(mockFile), makeParams("soc-1", "pet-1"));

    const [path] = mockUpload.mock.calls[0];
    expect(path).toMatch(/^soc-1\/pet-1\/\d+\.pdf$/);
  });

  it("fires audit log PETITION_DOCUMENT_UPLOADED on success", async () => {
    await POST(makeFormDataRequest(mockFile), makeParams());
    expect(mockLogAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        actionType: "PETITION_DOCUMENT_UPLOADED",
        userId: "admin-1",
        societyId: "soc-1",
        entityType: "Petition",
        entityId: "pet-1",
        newValue: expect.objectContaining({ documentUrl: expect.any(String) }),
      }),
    );
  });

  it("returns 400 with INVALID_TYPE when file type is not PDF or DOCX", async () => {
    const imageFile = new File(["image bytes"], "photo.jpg", { type: "image/jpeg" });
    const res = await POST(makeFormDataRequest(imageFile), makeParams());
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("INVALID_TYPE");
  });

  it("accepts a DOCX file and uploads with .docx extension", async () => {
    const mockUpload = vi.fn().mockResolvedValue({ error: null });
    mockSupabaseStorage.from.mockReturnValue({
      remove: vi.fn().mockResolvedValue({}),
      upload: mockUpload,
    });
    const docxFile = new File(["docx bytes"], "petition.docx", {
      type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    });
    const res = await POST(makeFormDataRequest(docxFile), makeParams());
    expect(res.status).toBe(200);
    const [path, , options] = mockUpload.mock.calls[0];
    expect(path).toMatch(/^soc-1\/pet-1\/\d+\.docx$/);
    expect(options.contentType).toBe(
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    );
  });

  it("returns 500 on database error", async () => {
    mockPrisma.petition.findUnique.mockRejectedValue(new Error("DB crash"));
    const res = await POST(makeFormDataRequest(mockFile), makeParams());
    expect(res.status).toBe(500);
  });
});

// ---------------------------------------------------------------------------
// GET /societies/[id]/petitions/[petitionId]/document
// ---------------------------------------------------------------------------

function makeGetRequest() {
  return new NextRequest("http://localhost/test", { method: "GET" });
}

const mockUser = {
  userId: "user-1",
  authUserId: "auth-user-1",
  societyId: "soc-1",
  role: "RESIDENT" as const,
};

const mockPetitionWithDoc = {
  id: "pet-1",
  societyId: "soc-1",
  title: "Test",
  status: "PUBLISHED",
  documentUrl: "soc-1/pet-1/123.pdf",
};

describe("GET /api/v1/societies/[id]/petitions/[petitionId]/document", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCurrentUser.mockResolvedValue(mockUser);
    mockPrisma.petition.findUnique.mockResolvedValue(mockPetitionWithDoc);
    mockSupabaseStorage.from.mockReturnValue({
      remove: vi.fn().mockResolvedValue({}),
      upload: vi.fn().mockResolvedValue({ error: null }),
      download: vi.fn().mockResolvedValue({ data: mockBlob, error: null }),
    });
  });

  it("returns 401 when not authenticated", async () => {
    mockGetCurrentUser.mockResolvedValue(null);
    const res = await GET(makeGetRequest(), makeParams());
    expect(res.status).toBe(401);
  });

  it("returns 404 when petition does not exist", async () => {
    mockPrisma.petition.findUnique.mockResolvedValue(null);
    const res = await GET(makeGetRequest(), makeParams());
    expect(res.status).toBe(404);
  });

  it("returns 404 when petition belongs to a different society", async () => {
    mockPrisma.petition.findUnique.mockResolvedValue({
      ...mockPetitionWithDoc,
      societyId: "other-soc",
    });
    const res = await GET(makeGetRequest(), makeParams());
    expect(res.status).toBe(404);
  });

  it("returns 404 when petition has no documentUrl", async () => {
    mockPrisma.petition.findUnique.mockResolvedValue({
      ...mockPetitionWithDoc,
      documentUrl: null,
    });
    const res = await GET(makeGetRequest(), makeParams());
    expect(res.status).toBe(404);
  });

  it("returns 500 when storage download fails", async () => {
    mockSupabaseStorage.from.mockReturnValue({
      download: vi.fn().mockResolvedValue({ data: null, error: { message: "not found" } }),
    });
    const res = await GET(makeGetRequest(), makeParams());
    expect(res.status).toBe(500);
  });

  it("returns 200 with PDF content type for a .pdf document", async () => {
    const res = await GET(makeGetRequest(), makeParams());
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("application/pdf");
    expect(res.headers.get("Content-Disposition")).toBe("inline");
  });

  it("returns 200 with DOCX content type for a .docx document", async () => {
    mockPrisma.petition.findUnique.mockResolvedValue({
      ...mockPetitionWithDoc,
      documentUrl: "soc-1/pet-1/123.docx",
    });
    const res = await GET(makeGetRequest(), makeParams());
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe(
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    );
  });

  it("returns 500 on unexpected error", async () => {
    mockPrisma.petition.findUnique.mockRejectedValue(new Error("DB crash"));
    const res = await GET(makeGetRequest(), makeParams());
    expect(res.status).toBe(500);
  });
});
