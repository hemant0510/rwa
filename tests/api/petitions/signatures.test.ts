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
  society: {
    findUnique: vi.fn(),
  },
}));
const mockGetCurrentUser = vi.hoisted(() => vi.fn());
const mockLogAudit = vi.hoisted(() => vi.fn());
const mockRenderToStream = vi.hoisted(() => vi.fn());
const mockSupabaseStorage = vi.hoisted(() => ({
  from: vi.fn().mockReturnValue({
    remove: vi.fn().mockResolvedValue({}),
    upload: vi.fn().mockResolvedValue({ error: null }),
    createSignedUrl: vi.fn().mockResolvedValue({ data: { signedUrl: "https://signed.url" } }),
  }),
}));
const mockCreateClient = vi.hoisted(() =>
  vi.fn().mockReturnValue({ storage: mockSupabaseStorage }),
);

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/get-current-user", () => ({ getCurrentUser: mockGetCurrentUser }));
vi.mock("@/lib/audit", () => ({ logAudit: mockLogAudit }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: mockCreateClient }));
vi.mock("@react-pdf/renderer", () => ({
  default: { renderToStream: (...args: unknown[]) => mockRenderToStream(...args) },
  Document: ({ children }: { children: unknown }) => children,
  Page: ({ children }: { children: unknown }) => children,
  Text: ({ children }: { children: unknown }) => children,
  View: ({ children }: { children: unknown }) => children,
  StyleSheet: { create: (styles: Record<string, unknown>) => styles },
}));

import { GET as GET_SIGNATURES } from "@/app/api/v1/societies/[id]/petitions/[petitionId]/signatures/route";
// eslint-disable-next-line import/order
import { DELETE as DELETE_SIGNATURE } from "@/app/api/v1/societies/[id]/petitions/[petitionId]/signatures/[signatureId]/route";
// eslint-disable-next-line import/order
import { GET as GET_REPORT } from "@/app/api/v1/societies/[id]/petitions/[petitionId]/report/route";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeGetRequest(query = "") {
  return new NextRequest(`http://localhost/test${query ? "?" + query : ""}`);
}

function makeDeleteRequest() {
  return new NextRequest("http://localhost/test", { method: "DELETE" });
}

function makeSignaturesParams(societyId = "soc-1", petitionId = "pet-1") {
  return { params: Promise.resolve({ id: societyId, petitionId }) };
}

function makeSignatureDetailParams(
  societyId = "soc-1",
  petitionId = "pet-1",
  signatureId = "sig-1",
) {
  return { params: Promise.resolve({ id: societyId, petitionId, signatureId }) };
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
  _count: { signatures: 3 },
};

const mockSignature = {
  id: "sig-1",
  petitionId: "pet-1",
  userId: "user-1",
  societyId: "soc-1",
  method: "DRAWN",
  signatureUrl: "soc-1/pet-1/user-1.png",
  signedAt: new Date(),
  user: {
    name: "Resident One",
    email: "resident@example.com",
    mobile: "9876543210",
    userUnits: [{ unit: { displayLabel: "A-101" } }],
  },
};

// ---------------------------------------------------------------------------
// GET /societies/[id]/petitions/[petitionId]/signatures — list signatures
// ---------------------------------------------------------------------------

describe("GET /api/v1/societies/[id]/petitions/[petitionId]/signatures — list signatures", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.petition.findUnique.mockResolvedValue(mockPublishedPetition);
    mockPrisma.petitionSignature.findMany.mockResolvedValue([mockSignature]);
    mockPrisma.petitionSignature.count.mockResolvedValue(1);
    mockSupabaseStorage.from.mockReturnValue({
      remove: vi.fn().mockResolvedValue({}),
      upload: vi.fn().mockResolvedValue({ error: null }),
      createSignedUrl: vi.fn().mockResolvedValue({ data: { signedUrl: "https://signed.url/sig" } }),
    });
  });

  it("returns 404 when petition does not exist", async () => {
    mockPrisma.petition.findUnique.mockResolvedValue(null);
    const res = await GET_SIGNATURES(makeGetRequest(), makeSignaturesParams());
    expect(res.status).toBe(404);
  });

  it("returns 404 when petition belongs to a different society", async () => {
    mockPrisma.petition.findUnique.mockResolvedValue({
      ...mockPublishedPetition,
      societyId: "other-soc",
    });
    const res = await GET_SIGNATURES(makeGetRequest(), makeSignaturesParams("soc-1", "pet-1"));
    expect(res.status).toBe(404);
  });

  it("returns paginated signatures list", async () => {
    const res = await GET_SIGNATURES(makeGetRequest(), makeSignaturesParams());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toHaveLength(1);
    expect(body.total).toBe(1);
    expect(body.page).toBe(1);
    expect(body.limit).toBe(50);
  });

  it("replaces signatureUrl with signed URL from storage", async () => {
    const res = await GET_SIGNATURES(makeGetRequest(), makeSignaturesParams());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data[0].signatureUrl).toBe("https://signed.url/sig");
  });

  it("falls back to original signatureUrl when storage returns no data", async () => {
    mockSupabaseStorage.from.mockReturnValue({
      createSignedUrl: vi.fn().mockResolvedValue({ data: null }),
    });
    const res = await GET_SIGNATURES(makeGetRequest(), makeSignaturesParams());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data[0].signatureUrl).toBe("soc-1/pet-1/user-1.png");
  });

  it("queries signatures filtered by petitionId", async () => {
    await GET_SIGNATURES(makeGetRequest(), makeSignaturesParams("soc-1", "pet-99"));
    expect(mockPrisma.petitionSignature.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { petitionId: "pet-99" },
      }),
    );
  });

  it("orders signatures by signedAt ascending", async () => {
    await GET_SIGNATURES(makeGetRequest(), makeSignaturesParams());
    expect(mockPrisma.petitionSignature.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: { signedAt: "asc" },
      }),
    );
  });

  it("includes user name, email, mobile, and unit info", async () => {
    await GET_SIGNATURES(makeGetRequest(), makeSignaturesParams());
    expect(mockPrisma.petitionSignature.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        include: expect.objectContaining({
          user: expect.objectContaining({
            select: expect.objectContaining({
              name: true,
              email: true,
              mobile: true,
            }),
          }),
        }),
      }),
    );
  });

  it("respects custom page and limit params", async () => {
    mockPrisma.petitionSignature.count.mockResolvedValue(200);
    await GET_SIGNATURES(makeGetRequest("page=2&limit=25"), makeSignaturesParams());
    expect(mockPrisma.petitionSignature.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 25, take: 25 }),
    );
  });

  it("returns empty list when no signatures exist", async () => {
    mockPrisma.petitionSignature.findMany.mockResolvedValue([]);
    mockPrisma.petitionSignature.count.mockResolvedValue(0);
    const res = await GET_SIGNATURES(makeGetRequest(), makeSignaturesParams());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toHaveLength(0);
    expect(body.total).toBe(0);
  });

  it("returns 500 on database error", async () => {
    mockPrisma.petition.findUnique.mockRejectedValue(new Error("DB crash"));
    const res = await GET_SIGNATURES(makeGetRequest(), makeSignaturesParams());
    expect(res.status).toBe(500);
  });
});

// ---------------------------------------------------------------------------
// DELETE /societies/[id]/petitions/[petitionId]/signatures/[signatureId] — remove signature
// ---------------------------------------------------------------------------

describe("DELETE /api/v1/societies/[id]/petitions/[petitionId]/signatures/[signatureId]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCurrentUser.mockResolvedValue(mockAdmin);
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
    const res = await DELETE_SIGNATURE(makeDeleteRequest(), makeSignatureDetailParams());
    expect(res.status).toBe(401);
  });

  it("returns 404 when petition does not exist", async () => {
    mockPrisma.petition.findUnique.mockResolvedValue(null);
    const res = await DELETE_SIGNATURE(makeDeleteRequest(), makeSignatureDetailParams());
    expect(res.status).toBe(404);
  });

  it("returns 404 when petition belongs to a different society", async () => {
    mockPrisma.petition.findUnique.mockResolvedValue({
      ...mockPublishedPetition,
      societyId: "other-soc",
    });
    const res = await DELETE_SIGNATURE(makeDeleteRequest(), makeSignatureDetailParams("soc-1"));
    expect(res.status).toBe(404);
  });

  it("returns 400 with NOT_PUBLISHED when petition is DRAFT", async () => {
    mockPrisma.petition.findUnique.mockResolvedValue({
      ...mockPublishedPetition,
      status: "DRAFT",
    });
    const res = await DELETE_SIGNATURE(makeDeleteRequest(), makeSignatureDetailParams());
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("NOT_PUBLISHED");
  });

  it("returns 400 with NOT_PUBLISHED when petition is SUBMITTED", async () => {
    mockPrisma.petition.findUnique.mockResolvedValue({
      ...mockPublishedPetition,
      status: "SUBMITTED",
    });
    const res = await DELETE_SIGNATURE(makeDeleteRequest(), makeSignatureDetailParams());
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("NOT_PUBLISHED");
  });

  it("returns 400 with NOT_PUBLISHED when petition is CLOSED", async () => {
    mockPrisma.petition.findUnique.mockResolvedValue({
      ...mockPublishedPetition,
      status: "CLOSED",
    });
    const res = await DELETE_SIGNATURE(makeDeleteRequest(), makeSignatureDetailParams());
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("NOT_PUBLISHED");
  });

  it("returns 404 when signature does not exist", async () => {
    mockPrisma.petitionSignature.findUnique.mockResolvedValue(null);
    const res = await DELETE_SIGNATURE(makeDeleteRequest(), makeSignatureDetailParams());
    expect(res.status).toBe(404);
  });

  it("returns 404 when signature belongs to a different petition", async () => {
    mockPrisma.petitionSignature.findUnique.mockResolvedValue({
      ...mockSignature,
      petitionId: "other-pet",
    });
    const res = await DELETE_SIGNATURE(
      makeDeleteRequest(),
      makeSignatureDetailParams("soc-1", "pet-1"),
    );
    expect(res.status).toBe(404);
  });

  it("removes signature image from storage", async () => {
    const mockRemove = vi.fn().mockResolvedValue({});
    mockSupabaseStorage.from.mockReturnValue({ remove: mockRemove });
    await DELETE_SIGNATURE(makeDeleteRequest(), makeSignatureDetailParams());
    expect(mockSupabaseStorage.from).toHaveBeenCalledWith("petition-signatures");
    expect(mockRemove).toHaveBeenCalledWith(["soc-1/pet-1/user-1.png"]);
  });

  it("deletes signature record from database", async () => {
    await DELETE_SIGNATURE(makeDeleteRequest(), makeSignatureDetailParams());
    expect(mockPrisma.petitionSignature.delete).toHaveBeenCalledWith({ where: { id: "sig-1" } });
  });

  it("fires audit log PETITION_SIGNATURE_REMOVED on success", async () => {
    await DELETE_SIGNATURE(makeDeleteRequest(), makeSignatureDetailParams());
    expect(mockLogAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        actionType: "PETITION_SIGNATURE_REMOVED",
        userId: "admin-1",
        societyId: "soc-1",
        entityType: "PetitionSignature",
        entityId: "sig-1",
        oldValue: { petitionId: "pet-1", userId: "user-1" },
      }),
    );
  });

  it("returns 200 with success message", async () => {
    const res = await DELETE_SIGNATURE(makeDeleteRequest(), makeSignatureDetailParams());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.message).toBe("Signature removed");
  });

  it("returns 500 on database error", async () => {
    mockPrisma.petition.findUnique.mockRejectedValue(new Error("DB crash"));
    const res = await DELETE_SIGNATURE(makeDeleteRequest(), makeSignatureDetailParams());
    expect(res.status).toBe(500);
  });
});

// ---------------------------------------------------------------------------
// GET /societies/[id]/petitions/[petitionId]/report — petition PDF report
// ---------------------------------------------------------------------------

describe("GET /api/v1/societies/[id]/petitions/[petitionId]/report", () => {
  const signaturesForReport = [
    {
      id: "sig-1",
      method: "DRAWN",
      signatureUrl: "soc-1/pet-1/user-1.png",
      signedAt: new Date("2026-04-01"),
      user: {
        name: "Resident One",
        userUnits: [{ unit: { displayLabel: "A-101" } }],
      },
    },
    {
      id: "sig-2",
      method: "UPLOADED",
      signatureUrl: "soc-1/pet-1/user-2.png",
      signedAt: new Date("2026-04-02"),
      user: {
        name: "Resident Two",
        userUnits: [],
      },
    },
  ];

  function makeStream() {
    return {
      [Symbol.asyncIterator]: async function* () {
        yield Buffer.from("PDF content");
      },
    };
  }

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCurrentUser.mockResolvedValue(mockAdmin);
    mockPrisma.petition.findUnique.mockResolvedValue({
      ...mockPublishedPetition,
      _count: { signatures: 2 },
    });
    mockPrisma.society.findUnique.mockResolvedValue({ name: "Greenwood Residency" });
    mockPrisma.petitionSignature.findMany.mockResolvedValue(signaturesForReport);
    mockRenderToStream.mockResolvedValue(makeStream());
  });

  it("returns 401 when not authenticated as admin", async () => {
    mockGetCurrentUser.mockResolvedValue(null);
    const res = await GET_REPORT(makeGetRequest(), makeSignaturesParams());
    expect(res.status).toBe(401);
  });

  it("returns 404 when petition does not exist", async () => {
    mockPrisma.petition.findUnique.mockResolvedValue(null);
    const res = await GET_REPORT(makeGetRequest(), makeSignaturesParams());
    expect(res.status).toBe(404);
  });

  it("returns 404 when petition belongs to a different society", async () => {
    mockPrisma.petition.findUnique.mockResolvedValue({
      ...mockPublishedPetition,
      societyId: "other-soc",
      _count: { signatures: 2 },
    });
    const res = await GET_REPORT(makeGetRequest(), makeSignaturesParams("soc-1", "pet-1"));
    expect(res.status).toBe(404);
  });

  it("returns 404 when society is not found", async () => {
    mockPrisma.society.findUnique.mockResolvedValue(null);
    const res = await GET_REPORT(makeGetRequest(), makeSignaturesParams());
    expect(res.status).toBe(404);
  });

  it("returns 400 with NO_SIGNATURES when petition has zero signatures", async () => {
    mockPrisma.petition.findUnique.mockResolvedValue({
      ...mockPublishedPetition,
      _count: { signatures: 0 },
    });
    const res = await GET_REPORT(makeGetRequest(), makeSignaturesParams());
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("NO_SIGNATURES");
  });

  it("returns 200 with application/pdf content-type on success", async () => {
    const res = await GET_REPORT(makeGetRequest(), makeSignaturesParams());
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("application/pdf");
  });

  it("returns Content-Disposition attachment with pdf filename", async () => {
    const res = await GET_REPORT(makeGetRequest(), makeSignaturesParams());
    const disposition = res.headers.get("Content-Disposition") ?? "";
    expect(disposition).toContain("attachment");
    expect(disposition).toContain(".pdf");
  });

  it("sanitizes petition title into the filename", async () => {
    const res = await GET_REPORT(makeGetRequest(), makeSignaturesParams());
    const disposition = res.headers.get("Content-Disposition") ?? "";
    // "Fix the playground" → "fix-the-playground"
    expect(disposition).toContain("fix-the-playground");
  });

  it("calls renderToStream exactly once on success", async () => {
    await GET_REPORT(makeGetRequest(), makeSignaturesParams());
    expect(mockRenderToStream).toHaveBeenCalledOnce();
  });

  it("fetches petition signatures for the correct petitionId", async () => {
    await GET_REPORT(makeGetRequest(), makeSignaturesParams("soc-1", "pet-1"));
    expect(mockPrisma.petitionSignature.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { petitionId: "pet-1" } }),
    );
  });

  it("includes user name and unit in signature include query", async () => {
    await GET_REPORT(makeGetRequest(), makeSignaturesParams());
    expect(mockPrisma.petitionSignature.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        include: expect.objectContaining({
          user: expect.objectContaining({
            select: expect.objectContaining({ name: true }),
          }),
        }),
      }),
    );
  });

  it("orders signatories by signedAt ascending", async () => {
    await GET_REPORT(makeGetRequest(), makeSignaturesParams());
    expect(mockPrisma.petitionSignature.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ orderBy: { signedAt: "asc" } }),
    );
  });

  it("queries petition with select of relevant fields only", async () => {
    await GET_REPORT(makeGetRequest(), makeSignaturesParams());
    expect(mockPrisma.petition.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "pet-1" },
        select: expect.objectContaining({
          id: true,
          title: true,
          societyId: true,
          _count: { select: { signatures: true } },
        }),
      }),
    );
  });

  it("generates PDF when targetAuthority and description are null but submittedAt is set", async () => {
    mockPrisma.petition.findUnique.mockResolvedValue({
      ...mockPublishedPetition,
      targetAuthority: null,
      description: null,
      submittedAt: new Date("2026-03-01"),
      _count: { signatures: 2 },
    });
    const res = await GET_REPORT(makeGetRequest(), makeSignaturesParams());
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("application/pdf");
    expect(mockRenderToStream).toHaveBeenCalledOnce();
  });

  it("handles string chunks from the PDF stream", async () => {
    mockRenderToStream.mockResolvedValue({
      [Symbol.asyncIterator]: async function* () {
        yield "string chunk";
        yield Buffer.from(" buffer chunk");
      },
    });
    const res = await GET_REPORT(makeGetRequest(), makeSignaturesParams());
    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("application/pdf");
  });

  it("returns 500 on database error", async () => {
    mockPrisma.petition.findUnique.mockRejectedValue(new Error("DB crash"));
    const res = await GET_REPORT(makeGetRequest(), makeSignaturesParams());
    expect(res.status).toBe(500);
  });

  it("returns 500 when renderToStream throws", async () => {
    mockRenderToStream.mockRejectedValue(new Error("PDF generation failed"));
    const res = await GET_REPORT(makeGetRequest(), makeSignaturesParams());
    expect(res.status).toBe(500);
  });
});
