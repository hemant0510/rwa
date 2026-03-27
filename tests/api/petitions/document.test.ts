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
const mockSupabaseStorage = vi.hoisted(() => ({
  from: vi.fn().mockReturnValue({
    remove: vi.fn().mockResolvedValue({}),
    upload: vi.fn().mockResolvedValue({ error: null }),
  }),
}));
const mockCreateClient = vi.hoisted(() =>
  vi.fn().mockResolvedValue({ storage: mockSupabaseStorage }),
);

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/get-current-user", () => ({ getCurrentUser: mockGetCurrentUser }));
vi.mock("@/lib/audit", () => ({ logAudit: mockLogAudit }));
vi.mock("@/lib/supabase/server", () => ({ createClient: mockCreateClient }));

import { POST } from "@/app/api/v1/societies/[id]/petitions/[petitionId]/document/route";

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

  it("returns 500 on database error", async () => {
    mockPrisma.petition.findUnique.mockRejectedValue(new Error("DB crash"));
    const res = await POST(makeFormDataRequest(mockFile), makeParams());
    expect(res.status).toBe(500);
  });
});
