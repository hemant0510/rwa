import { NextRequest } from "next/server";

import { describe, it, expect, vi, beforeEach } from "vitest";

const mockPrisma = vi.hoisted(() => ({
  petition: {
    findMany: vi.fn(),
    count: vi.fn(),
    create: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  petitionSignature: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    count: vi.fn(),
    create: vi.fn(),
    delete: vi.fn(),
  },
}));
const mockGetCurrentUser = vi.hoisted(() => vi.fn());
const mockLogAudit = vi.hoisted(() => vi.fn());
const mockSupabaseStorage = vi.hoisted(() => ({
  from: vi.fn().mockReturnValue({
    remove: vi.fn().mockResolvedValue({}),
    upload: vi.fn().mockResolvedValue({ error: null }),
    createSignedUrl: vi.fn().mockResolvedValue({ data: { signedUrl: "https://signed.url" } }),
  }),
}));
const mockCreateClient = vi.hoisted(() =>
  vi.fn().mockResolvedValue({ storage: mockSupabaseStorage }),
);

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/get-current-user", () => ({ getCurrentUser: mockGetCurrentUser }));
vi.mock("@/lib/audit", () => ({ logAudit: mockLogAudit }));
vi.mock("@/lib/supabase/server", () => ({ createClient: mockCreateClient }));

import { GET as GET_DETAIL } from "@/app/api/v1/residents/me/petitions/[petitionId]/route";
import {
  POST as POST_SIGN,
  DELETE as DELETE_REVOKE,
} from "@/app/api/v1/residents/me/petitions/[petitionId]/sign/route";
import { GET as GET_LIST } from "@/app/api/v1/residents/me/petitions/route";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeGetRequest(query = "") {
  return new NextRequest(`http://localhost/test${query ? "?" + query : ""}`);
}

function makeRequest(body: unknown) {
  return new NextRequest("http://localhost/test", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

function makeDeleteRequest() {
  return new NextRequest("http://localhost/test", { method: "DELETE" });
}

function makePetitionParams(petitionId = "pet-1") {
  return { params: Promise.resolve({ petitionId }) };
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const mockResident = {
  userId: "user-1",
  authUserId: "auth-user-1",
  societyId: "soc-1",
  role: "RESIDENT" as const,
};

const mockPublishedPetition = {
  id: "pet-1",
  societyId: "soc-1",
  title: "Fix the playground",
  description: "The playground equipment is broken",
  type: "PETITION",
  targetAuthority: "Municipal Corporation",
  minSignatures: 50,
  deadline: new Date("2026-06-01"),
  status: "PUBLISHED",
  documentUrl: "soc-1/pet-1/document.pdf",
  publishedAt: new Date(),
  submittedAt: null,
  closedReason: null,
  createdBy: "admin-1",
  createdAt: new Date(),
  updatedAt: new Date(),
  _count: { signatures: 12 },
  signatures: [],
};

const mockSubmittedPetition = {
  ...mockPublishedPetition,
  status: "SUBMITTED",
  submittedAt: new Date(),
};

const mockSignature = {
  id: "sig-1",
  petitionId: "pet-1",
  userId: "user-1",
  societyId: "soc-1",
  method: "DRAWN",
  signatureUrl: "soc-1/pet-1/user-1.png",
  signedAt: new Date(),
};

const validSignData = {
  method: "DRAWN",
  signatureDataUrl: "data:image/png;base64,iVBORw0KGgo=",
};

// ---------------------------------------------------------------------------
// GET /residents/me/petitions — list petitions
// ---------------------------------------------------------------------------

describe("GET /api/v1/residents/me/petitions — list petitions for resident", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCurrentUser.mockResolvedValue(mockResident);
    mockPrisma.petition.findMany.mockResolvedValue([
      {
        ...mockPublishedPetition,
        signatures: [{ id: "sig-1", method: "DRAWN", signedAt: new Date() }],
      },
    ]);
  });

  it("returns 401 when not authenticated", async () => {
    mockGetCurrentUser.mockResolvedValue(null);
    const res = await GET_LIST(makeGetRequest());
    expect(res.status).toBe(401);
  });

  it("returns 200 with petitions list", async () => {
    const res = await GET_LIST(makeGetRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toHaveLength(1);
  });

  it("filters petitions to PUBLISHED and SUBMITTED statuses only", async () => {
    await GET_LIST(makeGetRequest());
    expect(mockPrisma.petition.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: { in: ["PUBLISHED", "SUBMITTED"] },
        }),
      }),
    );
  });

  it("queries by resident's societyId", async () => {
    await GET_LIST(makeGetRequest());
    expect(mockPrisma.petition.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ societyId: "soc-1" }),
      }),
    );
  });

  it("includes mySignature from resident's own signatures", async () => {
    const res = await GET_LIST(makeGetRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data[0].mySignature).toMatchObject({ id: "sig-1", method: "DRAWN" });
  });

  it("sets mySignature to null when resident has not signed", async () => {
    mockPrisma.petition.findMany.mockResolvedValue([{ ...mockPublishedPetition, signatures: [] }]);
    const res = await GET_LIST(makeGetRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data[0].mySignature).toBeNull();
  });

  it("removes raw signatures array from response", async () => {
    const res = await GET_LIST(makeGetRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data[0].signatures).toBeUndefined();
  });

  it("filters signatures to current user only", async () => {
    await GET_LIST(makeGetRequest());
    expect(mockPrisma.petition.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        include: expect.objectContaining({
          signatures: expect.objectContaining({
            where: { userId: "user-1" },
          }),
        }),
      }),
    );
  });

  it("includes signature count", async () => {
    await GET_LIST(makeGetRequest());
    expect(mockPrisma.petition.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        include: expect.objectContaining({
          _count: { select: { signatures: true } },
        }),
      }),
    );
  });

  it("orders by createdAt descending", async () => {
    await GET_LIST(makeGetRequest());
    expect(mockPrisma.petition.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { createdAt: "desc" } }),
    );
  });

  it("returns empty list when no published petitions exist", async () => {
    mockPrisma.petition.findMany.mockResolvedValue([]);
    const res = await GET_LIST(makeGetRequest());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toHaveLength(0);
  });

  it("returns 500 on database error", async () => {
    mockPrisma.petition.findMany.mockRejectedValue(new Error("DB crash"));
    const res = await GET_LIST(makeGetRequest());
    expect(res.status).toBe(500);
  });
});

// ---------------------------------------------------------------------------
// GET /residents/me/petitions/[petitionId] — detail
// ---------------------------------------------------------------------------

describe("GET /api/v1/residents/me/petitions/[petitionId] — petition detail for resident", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCurrentUser.mockResolvedValue(mockResident);
    mockPrisma.petition.findUnique.mockResolvedValue(mockPublishedPetition);
    mockSupabaseStorage.from.mockReturnValue({
      remove: vi.fn().mockResolvedValue({}),
      upload: vi.fn().mockResolvedValue({ error: null }),
      createSignedUrl: vi
        .fn()
        .mockResolvedValue({ data: { signedUrl: "https://signed.url/doc.pdf" } }),
    });
  });

  it("returns 401 when not authenticated", async () => {
    mockGetCurrentUser.mockResolvedValue(null);
    const res = await GET_DETAIL(makeGetRequest(), makePetitionParams());
    expect(res.status).toBe(401);
  });

  it("returns 404 when petition does not exist", async () => {
    mockPrisma.petition.findUnique.mockResolvedValue(null);
    const res = await GET_DETAIL(makeGetRequest(), makePetitionParams());
    expect(res.status).toBe(404);
  });

  it("returns 404 when petition belongs to a different society", async () => {
    mockPrisma.petition.findUnique.mockResolvedValue({
      ...mockPublishedPetition,
      societyId: "other-soc",
    });
    const res = await GET_DETAIL(makeGetRequest(), makePetitionParams());
    expect(res.status).toBe(404);
  });

  it("returns 404 when petition is DRAFT", async () => {
    mockPrisma.petition.findUnique.mockResolvedValue({
      ...mockPublishedPetition,
      status: "DRAFT",
    });
    const res = await GET_DETAIL(makeGetRequest(), makePetitionParams());
    expect(res.status).toBe(404);
  });

  it("returns 404 when petition is CLOSED", async () => {
    mockPrisma.petition.findUnique.mockResolvedValue({
      ...mockPublishedPetition,
      status: "CLOSED",
    });
    const res = await GET_DETAIL(makeGetRequest(), makePetitionParams());
    expect(res.status).toBe(404);
  });

  it("returns 200 for PUBLISHED petition", async () => {
    const res = await GET_DETAIL(makeGetRequest(), makePetitionParams());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe("pet-1");
  });

  it("returns 200 for SUBMITTED petition", async () => {
    mockPrisma.petition.findUnique.mockResolvedValue(mockSubmittedPetition);
    const res = await GET_DETAIL(makeGetRequest(), makePetitionParams());
    expect(res.status).toBe(200);
  });

  it("includes signatureCount in response", async () => {
    const res = await GET_DETAIL(makeGetRequest(), makePetitionParams());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.signatureCount).toBe(12);
  });

  it("generates and includes documentSignedUrl when documentUrl exists", async () => {
    const res = await GET_DETAIL(makeGetRequest(), makePetitionParams());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.documentSignedUrl).toBe("https://signed.url/doc.pdf");
    expect(mockSupabaseStorage.from).toHaveBeenCalledWith("petition-docs");
  });

  it("sets documentSignedUrl to null when petition has no documentUrl", async () => {
    mockPrisma.petition.findUnique.mockResolvedValue({
      ...mockPublishedPetition,
      documentUrl: null,
    });
    const res = await GET_DETAIL(makeGetRequest(), makePetitionParams());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.documentSignedUrl).toBeNull();
    // storage.createSignedUrl should not be called when there is no documentUrl
    const storageFromCalls = mockSupabaseStorage.from.mock.calls;
    const signedUrlCallsForDocs = storageFromCalls.filter(
      (c: unknown[]) => c[0] === "petition-docs",
    );
    expect(signedUrlCallsForDocs).toHaveLength(0);
  });

  it("sets documentSignedUrl to null when storage createSignedUrl returns no data", async () => {
    mockSupabaseStorage.from.mockReturnValue({
      createSignedUrl: vi.fn().mockResolvedValue({ data: null }),
    });
    const res = await GET_DETAIL(makeGetRequest(), makePetitionParams());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.documentSignedUrl).toBeNull();
  });

  it("includes mySignature when resident has signed", async () => {
    mockPrisma.petition.findUnique.mockResolvedValue({
      ...mockPublishedPetition,
      signatures: [{ id: "sig-1", method: "DRAWN", signedAt: new Date() }],
    });
    const res = await GET_DETAIL(makeGetRequest(), makePetitionParams());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.mySignature).toMatchObject({ id: "sig-1", method: "DRAWN" });
  });

  it("sets mySignature to null when resident has not signed", async () => {
    const res = await GET_DETAIL(makeGetRequest(), makePetitionParams());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.mySignature).toBeNull();
  });

  it("removes raw signatures array from response", async () => {
    mockPrisma.petition.findUnique.mockResolvedValue({
      ...mockPublishedPetition,
      signatures: [{ id: "sig-1", method: "DRAWN", signedAt: new Date() }],
    });
    const res = await GET_DETAIL(makeGetRequest(), makePetitionParams());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.signatures).toBeUndefined();
  });

  it("returns 500 on database error", async () => {
    mockPrisma.petition.findUnique.mockRejectedValue(new Error("DB crash"));
    const res = await GET_DETAIL(makeGetRequest(), makePetitionParams());
    expect(res.status).toBe(500);
  });
});

// ---------------------------------------------------------------------------
// POST /residents/me/petitions/[petitionId]/sign — sign petition
// ---------------------------------------------------------------------------

describe("POST /api/v1/residents/me/petitions/[petitionId]/sign — sign petition", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCurrentUser.mockResolvedValue(mockResident);
    mockPrisma.petition.findUnique.mockResolvedValue(mockPublishedPetition);
    mockPrisma.petitionSignature.findUnique.mockResolvedValue(null);
    mockPrisma.petitionSignature.create.mockResolvedValue(mockSignature);
    mockSupabaseStorage.from.mockReturnValue({
      remove: vi.fn().mockResolvedValue({}),
      upload: vi.fn().mockResolvedValue({ error: null }),
      createSignedUrl: vi.fn().mockResolvedValue({ data: { signedUrl: "https://signed.url" } }),
    });
  });

  it("returns 401 when not authenticated", async () => {
    mockGetCurrentUser.mockResolvedValue(null);
    const res = await POST_SIGN(makeRequest(validSignData), makePetitionParams());
    expect(res.status).toBe(401);
  });

  it("returns 404 when petition does not exist", async () => {
    mockPrisma.petition.findUnique.mockResolvedValue(null);
    const res = await POST_SIGN(makeRequest(validSignData), makePetitionParams());
    expect(res.status).toBe(404);
  });

  it("returns 404 when petition belongs to a different society", async () => {
    mockPrisma.petition.findUnique.mockResolvedValue({
      ...mockPublishedPetition,
      societyId: "other-soc",
    });
    const res = await POST_SIGN(makeRequest(validSignData), makePetitionParams());
    expect(res.status).toBe(404);
  });

  it("returns 400 with NOT_PUBLISHED when petition is DRAFT", async () => {
    mockPrisma.petition.findUnique.mockResolvedValue({
      ...mockPublishedPetition,
      status: "DRAFT",
    });
    const res = await POST_SIGN(makeRequest(validSignData), makePetitionParams());
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("NOT_PUBLISHED");
  });

  it("returns 400 with NOT_PUBLISHED when petition is SUBMITTED", async () => {
    mockPrisma.petition.findUnique.mockResolvedValue(mockSubmittedPetition);
    const res = await POST_SIGN(makeRequest(validSignData), makePetitionParams());
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("NOT_PUBLISHED");
  });

  it("returns 400 with NOT_PUBLISHED when petition is CLOSED", async () => {
    mockPrisma.petition.findUnique.mockResolvedValue({
      ...mockPublishedPetition,
      status: "CLOSED",
    });
    const res = await POST_SIGN(makeRequest(validSignData), makePetitionParams());
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("NOT_PUBLISHED");
  });

  it("returns 409 with ALREADY_SIGNED when resident has already signed", async () => {
    mockPrisma.petitionSignature.findUnique.mockResolvedValue(mockSignature);
    const res = await POST_SIGN(makeRequest(validSignData), makePetitionParams());
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error.code).toBe("ALREADY_SIGNED");
  });

  it("returns 422 when signatureDataUrl is missing", async () => {
    const res = await POST_SIGN(makeRequest({ method: "DRAWN" }), makePetitionParams());
    expect(res.status).toBe(422);
  });

  it("returns 422 when signatureDataUrl is not a valid data URL", async () => {
    const res = await POST_SIGN(
      makeRequest({ method: "DRAWN", signatureDataUrl: "not-a-data-url" }),
      makePetitionParams(),
    );
    expect(res.status).toBe(422);
  });

  it("returns 422 when method is invalid enum value", async () => {
    const res = await POST_SIGN(
      makeRequest({ method: "INVALID", signatureDataUrl: "data:image/png;base64,iVBORw0KGgo=" }),
      makePetitionParams(),
    );
    expect(res.status).toBe(422);
  });

  it("uploads signature image to storage bucket", async () => {
    const mockUpload = vi.fn().mockResolvedValue({ error: null });
    mockSupabaseStorage.from.mockReturnValue({ upload: mockUpload });
    await POST_SIGN(makeRequest(validSignData), makePetitionParams());
    expect(mockSupabaseStorage.from).toHaveBeenCalledWith("petition-signatures");
    expect(mockUpload).toHaveBeenCalledWith(
      "soc-1/pet-1/user-1.png",
      expect.any(Buffer),
      expect.objectContaining({ contentType: "image/png", upsert: true }),
    );
  });

  it("creates signature DB record with correct data", async () => {
    await POST_SIGN(makeRequest(validSignData), makePetitionParams());
    expect(mockPrisma.petitionSignature.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          petitionId: "pet-1",
          userId: "user-1",
          societyId: "soc-1",
          method: "DRAWN",
          signatureUrl: "soc-1/pet-1/user-1.png",
        }),
      }),
    );
  });

  it("fires audit log PETITION_SIGNED on success", async () => {
    await POST_SIGN(makeRequest(validSignData), makePetitionParams());
    expect(mockLogAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        actionType: "PETITION_SIGNED",
        userId: "user-1",
        societyId: "soc-1",
        entityType: "PetitionSignature",
        entityId: "sig-1",
        newValue: { petitionId: "pet-1", method: "DRAWN" },
      }),
    );
  });

  it("returns 201 with signedAt on success", async () => {
    const res = await POST_SIGN(makeRequest(validSignData), makePetitionParams());
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body).toHaveProperty("signedAt");
  });

  it("also works with UPLOADED method", async () => {
    const uploadedSignData = {
      method: "UPLOADED",
      signatureDataUrl: "data:image/png;base64,iVBORw0KGgo=",
    };
    const res = await POST_SIGN(makeRequest(uploadedSignData), makePetitionParams());
    expect(res.status).toBe(201);
    expect(mockPrisma.petitionSignature.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ method: "UPLOADED" }),
      }),
    );
  });

  it("returns 500 on database error", async () => {
    mockPrisma.petition.findUnique.mockRejectedValue(new Error("DB crash"));
    const res = await POST_SIGN(makeRequest(validSignData), makePetitionParams());
    expect(res.status).toBe(500);
  });
});

// ---------------------------------------------------------------------------
// DELETE /residents/me/petitions/[petitionId]/sign — revoke signature
// ---------------------------------------------------------------------------

describe("DELETE /api/v1/residents/me/petitions/[petitionId]/sign — revoke signature", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCurrentUser.mockResolvedValue(mockResident);
    mockPrisma.petition.findUnique.mockResolvedValue(mockPublishedPetition);
    mockPrisma.petitionSignature.findUnique.mockResolvedValue(mockSignature);
    mockPrisma.petitionSignature.delete.mockResolvedValue(mockSignature);
    mockSupabaseStorage.from.mockReturnValue({
      remove: vi.fn().mockResolvedValue({}),
      upload: vi.fn().mockResolvedValue({ error: null }),
      createSignedUrl: vi.fn().mockResolvedValue({ data: { signedUrl: "https://signed.url" } }),
    });
  });

  it("returns 401 when not authenticated", async () => {
    mockGetCurrentUser.mockResolvedValue(null);
    const res = await DELETE_REVOKE(makeDeleteRequest(), makePetitionParams());
    expect(res.status).toBe(401);
  });

  it("returns 404 when petition does not exist", async () => {
    mockPrisma.petition.findUnique.mockResolvedValue(null);
    const res = await DELETE_REVOKE(makeDeleteRequest(), makePetitionParams());
    expect(res.status).toBe(404);
  });

  it("returns 404 when petition belongs to a different society", async () => {
    mockPrisma.petition.findUnique.mockResolvedValue({
      ...mockPublishedPetition,
      societyId: "other-soc",
    });
    const res = await DELETE_REVOKE(makeDeleteRequest(), makePetitionParams());
    expect(res.status).toBe(404);
  });

  it("returns 400 with NOT_PUBLISHED when petition is DRAFT", async () => {
    mockPrisma.petition.findUnique.mockResolvedValue({
      ...mockPublishedPetition,
      status: "DRAFT",
    });
    const res = await DELETE_REVOKE(makeDeleteRequest(), makePetitionParams());
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("NOT_PUBLISHED");
  });

  it("returns 400 with NOT_PUBLISHED when petition is SUBMITTED", async () => {
    mockPrisma.petition.findUnique.mockResolvedValue(mockSubmittedPetition);
    const res = await DELETE_REVOKE(makeDeleteRequest(), makePetitionParams());
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("NOT_PUBLISHED");
  });

  it("returns 400 with NOT_PUBLISHED when petition is CLOSED", async () => {
    mockPrisma.petition.findUnique.mockResolvedValue({
      ...mockPublishedPetition,
      status: "CLOSED",
    });
    const res = await DELETE_REVOKE(makeDeleteRequest(), makePetitionParams());
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("NOT_PUBLISHED");
  });

  it("returns 404 when resident has not signed the petition", async () => {
    mockPrisma.petitionSignature.findUnique.mockResolvedValue(null);
    const res = await DELETE_REVOKE(makeDeleteRequest(), makePetitionParams());
    expect(res.status).toBe(404);
  });

  it("looks up signature by composite petitionId+userId key", async () => {
    await DELETE_REVOKE(makeDeleteRequest(), makePetitionParams());
    expect(mockPrisma.petitionSignature.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { petitionId_userId: { petitionId: "pet-1", userId: "user-1" } },
      }),
    );
  });

  it("removes signature image from storage", async () => {
    const mockRemove = vi.fn().mockResolvedValue({});
    mockSupabaseStorage.from.mockReturnValue({ remove: mockRemove });
    await DELETE_REVOKE(makeDeleteRequest(), makePetitionParams());
    expect(mockSupabaseStorage.from).toHaveBeenCalledWith("petition-signatures");
    expect(mockRemove).toHaveBeenCalledWith(["soc-1/pet-1/user-1.png"]);
  });

  it("deletes the signature record from database", async () => {
    await DELETE_REVOKE(makeDeleteRequest(), makePetitionParams());
    expect(mockPrisma.petitionSignature.delete).toHaveBeenCalledWith({
      where: { id: "sig-1" },
    });
  });

  it("fires audit log PETITION_SIGNATURE_REVOKED on success", async () => {
    await DELETE_REVOKE(makeDeleteRequest(), makePetitionParams());
    expect(mockLogAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        actionType: "PETITION_SIGNATURE_REVOKED",
        userId: "user-1",
        societyId: "soc-1",
        entityType: "PetitionSignature",
        entityId: "sig-1",
        oldValue: { petitionId: "pet-1", method: "DRAWN" },
      }),
    );
  });

  it("returns 200 with revoke message on success", async () => {
    const res = await DELETE_REVOKE(makeDeleteRequest(), makePetitionParams());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.message).toBe("Signature revoked");
  });

  it("returns 500 on database error", async () => {
    mockPrisma.petition.findUnique.mockRejectedValue(new Error("DB crash"));
    const res = await DELETE_REVOKE(makeDeleteRequest(), makePetitionParams());
    expect(res.status).toBe(500);
  });
});
