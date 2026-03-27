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
// Controllable parseBody spy — defaults to undefined so real impl is used unless overridden per test
const mockParseBody = vi.hoisted(() =>
  vi.fn<Parameters<typeof import("@/lib/api-helpers").parseBody>>(),
);

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/get-current-user", () => ({ getCurrentUser: mockGetCurrentUser }));
vi.mock("@/lib/audit", () => ({ logAudit: mockLogAudit }));
vi.mock("@/lib/supabase/server", () => ({ createClient: mockCreateClient }));
vi.mock("@/lib/api-helpers", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/api-helpers")>();
  return {
    ...real,
    parseBody: (...args: Parameters<typeof real.parseBody>) =>
      mockParseBody.getMockImplementation() ? mockParseBody(...args) : real.parseBody(...args),
  };
});

import { GET, POST } from "@/app/api/v1/societies/[id]/petitions/route";
// eslint-disable-next-line import/order
import {
  GET as GET_DETAIL,
  PATCH,
  DELETE,
} from "@/app/api/v1/societies/[id]/petitions/[petitionId]/route";

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

function makePatchRequest(body: unknown) {
  return new NextRequest("http://localhost/test", {
    method: "PATCH",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

function makeDeleteRequest() {
  return new NextRequest("http://localhost/test", { method: "DELETE" });
}

function makeListParams(id = "soc-1") {
  return { params: Promise.resolve({ id }) };
}

function makeDetailParams(societyId = "soc-1", petitionId = "pet-1") {
  return { params: Promise.resolve({ id: societyId, petitionId }) };
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
  creator: { name: "Admin User" },
  _count: { signatures: 0 },
};

const validCreateBody = {
  title: "Fix the playground",
  type: "PETITION",
};

// ---------------------------------------------------------------------------
// GET /societies/[id]/petitions — list
// ---------------------------------------------------------------------------

describe("GET /api/v1/societies/[id]/petitions — list petitions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.petition.findMany.mockResolvedValue([mockDraftPetition]);
    mockPrisma.petition.count.mockResolvedValue(1);
  });

  it("returns paginated list with defaults", async () => {
    const res = await GET(makeGetRequest(), makeListParams());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toHaveLength(1);
    expect(body.total).toBe(1);
    expect(body.page).toBe(1);
    expect(body.limit).toBe(20);
  });

  it("passes societyId in where clause", async () => {
    await GET(makeGetRequest(), makeListParams("soc-99"));
    expect(mockPrisma.petition.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ societyId: "soc-99" }),
      }),
    );
  });

  it("applies status filter when provided", async () => {
    await GET(makeGetRequest("status=PUBLISHED"), makeListParams());
    expect(mockPrisma.petition.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: "PUBLISHED" }),
      }),
    );
    expect(mockPrisma.petition.count).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: "PUBLISHED" }),
      }),
    );
  });

  it("applies type filter when provided", async () => {
    await GET(makeGetRequest("type=COMPLAINT"), makeListParams());
    expect(mockPrisma.petition.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ type: "COMPLAINT" }),
      }),
    );
  });

  it("applies both status and type filters together", async () => {
    await GET(makeGetRequest("status=DRAFT&type=NOTICE"), makeListParams());
    expect(mockPrisma.petition.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: "DRAFT", type: "NOTICE" }),
      }),
    );
  });

  it("omits status and type from where clause when not provided", async () => {
    await GET(makeGetRequest(), makeListParams());
    const callArg = mockPrisma.petition.findMany.mock.calls[0][0];
    expect(callArg.where.status).toBeUndefined();
    expect(callArg.where.type).toBeUndefined();
  });

  it("respects custom page and limit", async () => {
    mockPrisma.petition.count.mockResolvedValue(100);
    await GET(makeGetRequest("page=3&limit=10"), makeListParams());
    expect(mockPrisma.petition.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 20, take: 10 }),
    );
  });

  it("includes creator name and signature count", async () => {
    await GET(makeGetRequest(), makeListParams());
    expect(mockPrisma.petition.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        include: expect.objectContaining({
          creator: { select: { name: true } },
          _count: { select: { signatures: true } },
        }),
      }),
    );
  });

  it("orders by status asc then createdAt desc", async () => {
    await GET(makeGetRequest(), makeListParams());
    expect(mockPrisma.petition.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      }),
    );
  });

  it("returns empty list when no petitions exist", async () => {
    mockPrisma.petition.findMany.mockResolvedValue([]);
    mockPrisma.petition.count.mockResolvedValue(0);
    const res = await GET(makeGetRequest(), makeListParams());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toHaveLength(0);
    expect(body.total).toBe(0);
  });

  it("returns 500 on database error", async () => {
    mockPrisma.petition.findMany.mockRejectedValue(new Error("DB crash"));
    const res = await GET(makeGetRequest(), makeListParams());
    expect(res.status).toBe(500);
  });
});

// ---------------------------------------------------------------------------
// POST /societies/[id]/petitions — create
// ---------------------------------------------------------------------------

describe("POST /api/v1/societies/[id]/petitions — create petition", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCurrentUser.mockResolvedValue(mockAdmin);
    mockPrisma.petition.create.mockResolvedValue(mockDraftPetition);
  });

  it("returns 401 when not authenticated", async () => {
    mockGetCurrentUser.mockResolvedValue(null);
    const res = await POST(makeRequest(validCreateBody), makeListParams());
    expect(res.status).toBe(401);
  });

  it("creates petition and returns 201", async () => {
    const res = await POST(makeRequest(validCreateBody), makeListParams());
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.id).toBe("pet-1");
  });

  it("sets societyId, createdBy, and status=DRAFT", async () => {
    await POST(makeRequest(validCreateBody), makeListParams("soc-99"));
    expect(mockPrisma.petition.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          societyId: "soc-99",
          createdBy: "admin-1",
          status: "DRAFT",
        }),
      }),
    );
  });

  it("stores title and type from body", async () => {
    await POST(makeRequest(validCreateBody), makeListParams());
    expect(mockPrisma.petition.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          title: "Fix the playground",
          type: "PETITION",
        }),
      }),
    );
  });

  it("sets optional fields to null when not provided", async () => {
    await POST(makeRequest(validCreateBody), makeListParams());
    expect(mockPrisma.petition.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          description: null,
          targetAuthority: null,
          minSignatures: null,
          deadline: null,
        }),
      }),
    );
  });

  it("stores optional fields when provided", async () => {
    const body = {
      ...validCreateBody,
      description: "Full description",
      targetAuthority: "Municipal",
      minSignatures: 100,
      deadline: "2026-12-31",
    };
    await POST(makeRequest(body), makeListParams());
    expect(mockPrisma.petition.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          description: "Full description",
          targetAuthority: "Municipal",
          minSignatures: 100,
          deadline: expect.any(Date),
        }),
      }),
    );
  });

  it("fires audit log PETITION_CREATED after successful creation", async () => {
    await POST(makeRequest(validCreateBody), makeListParams());
    expect(mockLogAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        actionType: "PETITION_CREATED",
        userId: "admin-1",
        societyId: "soc-1",
        entityType: "Petition",
        entityId: "pet-1",
        newValue: expect.objectContaining({ title: "Fix the playground", type: "PETITION" }),
      }),
    );
  });

  it("returns 422 when body is missing required type field", async () => {
    const res = await POST(makeRequest({ title: "Valid title" }), makeListParams());
    expect(res.status).toBe(422);
  });

  it("returns 422 when title is too short (under 3 chars)", async () => {
    const res = await POST(makeRequest({ title: "Hi", type: "PETITION" }), makeListParams());
    expect(res.status).toBe(422);
  });

  it("returns 422 when type is invalid enum value", async () => {
    const res = await POST(
      makeRequest({ title: "Valid title", type: "INVALID" }),
      makeListParams(),
    );
    expect(res.status).toBe(422);
  });

  it("returns 500 on database error", async () => {
    mockPrisma.petition.create.mockRejectedValue(new Error("DB crash"));
    const res = await POST(makeRequest(validCreateBody), makeListParams());
    expect(res.status).toBe(500);
  });
});

// ---------------------------------------------------------------------------
// GET /societies/[id]/petitions/[petitionId] — detail
// ---------------------------------------------------------------------------

describe("GET /api/v1/societies/[id]/petitions/[petitionId] — get detail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPrisma.petition.findUnique.mockResolvedValue(mockDraftPetition);
  });

  it("returns 200 with petition data", async () => {
    const res = await GET_DETAIL(makeGetRequest(), makeDetailParams());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe("pet-1");
  });

  it("returns 404 when petition does not exist", async () => {
    mockPrisma.petition.findUnique.mockResolvedValue(null);
    const res = await GET_DETAIL(makeGetRequest(), makeDetailParams());
    expect(res.status).toBe(404);
  });

  it("returns 404 when petition belongs to a different society", async () => {
    mockPrisma.petition.findUnique.mockResolvedValue({
      ...mockDraftPetition,
      societyId: "other-soc",
    });
    const res = await GET_DETAIL(makeGetRequest(), makeDetailParams("soc-1", "pet-1"));
    expect(res.status).toBe(404);
  });

  it("queries by petitionId", async () => {
    await GET_DETAIL(makeGetRequest(), makeDetailParams("soc-1", "pet-42"));
    expect(mockPrisma.petition.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "pet-42" } }),
    );
  });

  it("includes creator name and signature count", async () => {
    await GET_DETAIL(makeGetRequest(), makeDetailParams());
    expect(mockPrisma.petition.findUnique).toHaveBeenCalledWith(
      expect.objectContaining({
        include: expect.objectContaining({
          creator: { select: { name: true } },
          _count: { select: { signatures: true } },
        }),
      }),
    );
  });

  it("returns 500 on database error", async () => {
    mockPrisma.petition.findUnique.mockRejectedValue(new Error("DB crash"));
    const res = await GET_DETAIL(makeGetRequest(), makeDetailParams());
    expect(res.status).toBe(500);
  });
});

// ---------------------------------------------------------------------------
// PATCH /societies/[id]/petitions/[petitionId] — update
// ---------------------------------------------------------------------------

describe("PATCH /api/v1/societies/[id]/petitions/[petitionId] — update petition", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCurrentUser.mockResolvedValue(mockAdmin);
    mockPrisma.petition.findUnique.mockResolvedValue(mockDraftPetition);
    mockPrisma.petition.update.mockResolvedValue({
      ...mockDraftPetition,
      title: "Updated title",
    });
  });

  it("returns 401 when not authenticated", async () => {
    mockGetCurrentUser.mockResolvedValue(null);
    const res = await PATCH(makePatchRequest({ title: "New title" }), makeDetailParams());
    expect(res.status).toBe(401);
  });

  it("returns 404 when petition does not exist", async () => {
    mockPrisma.petition.findUnique.mockResolvedValue(null);
    const res = await PATCH(makePatchRequest({ title: "New title" }), makeDetailParams());
    expect(res.status).toBe(404);
  });

  it("returns 404 when petition belongs to a different society", async () => {
    mockPrisma.petition.findUnique.mockResolvedValue({
      ...mockDraftPetition,
      societyId: "other-soc",
    });
    const res = await PATCH(makePatchRequest({ title: "New title" }), makeDetailParams("soc-1"));
    expect(res.status).toBe(404);
  });

  it("returns 400 with NOT_DRAFT when petition is PUBLISHED", async () => {
    mockPrisma.petition.findUnique.mockResolvedValue({ ...mockDraftPetition, status: "PUBLISHED" });
    const res = await PATCH(makePatchRequest({ title: "New title" }), makeDetailParams());
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("NOT_DRAFT");
  });

  it("returns 400 with NOT_DRAFT when petition is SUBMITTED", async () => {
    mockPrisma.petition.findUnique.mockResolvedValue({ ...mockDraftPetition, status: "SUBMITTED" });
    const res = await PATCH(makePatchRequest({ title: "New title" }), makeDetailParams());
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("NOT_DRAFT");
  });

  it("returns 400 with NOT_DRAFT when petition is CLOSED", async () => {
    mockPrisma.petition.findUnique.mockResolvedValue({ ...mockDraftPetition, status: "CLOSED" });
    const res = await PATCH(makePatchRequest({ title: "New title" }), makeDetailParams());
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("NOT_DRAFT");
  });

  it("updates petition fields and returns updated record", async () => {
    const res = await PATCH(makePatchRequest({ title: "Updated title" }), makeDetailParams());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.title).toBe("Updated title");
  });

  it("only includes provided fields in update data", async () => {
    await PATCH(makePatchRequest({ title: "New title" }), makeDetailParams());
    expect(mockPrisma.petition.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ title: "New title" }),
      }),
    );
    const updateData = mockPrisma.petition.update.mock.calls[0][0].data;
    expect(updateData.type).toBeUndefined();
  });

  it("converts deadline string to Date when provided", async () => {
    await PATCH(
      makePatchRequest({ title: "New title", deadline: "2027-01-01" }),
      makeDetailParams(),
    );
    expect(mockPrisma.petition.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ deadline: expect.any(Date) }),
      }),
    );
  });

  it("sets deadline to null when explicitly passed as null", async () => {
    await PATCH(makePatchRequest({ title: "New title", deadline: null }), makeDetailParams());
    expect(mockPrisma.petition.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ deadline: null }),
      }),
    );
  });

  it("fires audit log PETITION_UPDATED after successful update", async () => {
    await PATCH(makePatchRequest({ title: "Updated title" }), makeDetailParams());
    expect(mockLogAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        actionType: "PETITION_UPDATED",
        userId: "admin-1",
        societyId: "soc-1",
        entityType: "Petition",
        entityId: "pet-1",
      }),
    );
  });

  it("returns 422 when body has no fields at all (refine check)", async () => {
    const res = await PATCH(makePatchRequest({}), makeDetailParams());
    expect(res.status).toBe(422);
  });

  it("returns 422 when title is too short", async () => {
    const res = await PATCH(makePatchRequest({ title: "Hi" }), makeDetailParams());
    expect(res.status).toBe(422);
  });

  it("returns 500 on database error", async () => {
    mockPrisma.petition.findUnique.mockRejectedValue(new Error("DB crash"));
    const res = await PATCH(makePatchRequest({ title: "New title" }), makeDetailParams());
    expect(res.status).toBe(500);
  });
});

// ---------------------------------------------------------------------------
// DELETE /societies/[id]/petitions/[petitionId] — delete
// ---------------------------------------------------------------------------

describe("DELETE /api/v1/societies/[id]/petitions/[petitionId] — delete petition", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCurrentUser.mockResolvedValue(mockAdmin);
    mockPrisma.petition.findUnique.mockResolvedValue(mockDraftPetition);
    mockPrisma.petition.delete.mockResolvedValue(mockDraftPetition);
    mockSupabaseStorage.from.mockReturnValue({
      remove: vi.fn().mockResolvedValue({}),
      upload: vi.fn().mockResolvedValue({ error: null }),
      createSignedUrl: vi.fn().mockResolvedValue({ data: { signedUrl: "https://signed.url" } }),
    });
  });

  it("returns 401 when not authenticated", async () => {
    mockGetCurrentUser.mockResolvedValue(null);
    const res = await DELETE(makeDeleteRequest(), makeDetailParams());
    expect(res.status).toBe(401);
  });

  it("returns 404 when petition does not exist", async () => {
    mockPrisma.petition.findUnique.mockResolvedValue(null);
    const res = await DELETE(makeDeleteRequest(), makeDetailParams());
    expect(res.status).toBe(404);
  });

  it("returns 404 when petition belongs to a different society", async () => {
    mockPrisma.petition.findUnique.mockResolvedValue({
      ...mockDraftPetition,
      societyId: "other-soc",
    });
    const res = await DELETE(makeDeleteRequest(), makeDetailParams("soc-1"));
    expect(res.status).toBe(404);
  });

  it("returns 400 with NOT_DRAFT when petition is PUBLISHED", async () => {
    mockPrisma.petition.findUnique.mockResolvedValue({ ...mockDraftPetition, status: "PUBLISHED" });
    const res = await DELETE(makeDeleteRequest(), makeDetailParams());
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("NOT_DRAFT");
  });

  it("returns 400 with NOT_DRAFT when petition is SUBMITTED", async () => {
    mockPrisma.petition.findUnique.mockResolvedValue({ ...mockDraftPetition, status: "SUBMITTED" });
    const res = await DELETE(makeDeleteRequest(), makeDetailParams());
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("NOT_DRAFT");
  });

  it("deletes DRAFT petition without documentUrl and returns success", async () => {
    const res = await DELETE(makeDeleteRequest(), makeDetailParams());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.message).toBe("Petition deleted");
    expect(mockPrisma.petition.delete).toHaveBeenCalledWith({ where: { id: "pet-1" } });
  });

  it("skips storage deletion when documentUrl is null", async () => {
    await DELETE(makeDeleteRequest(), makeDetailParams());
    expect(mockCreateClient).not.toHaveBeenCalled();
  });

  it("removes document from storage when documentUrl exists", async () => {
    const mockRemove = vi.fn().mockResolvedValue({});
    mockSupabaseStorage.from.mockReturnValue({ remove: mockRemove });
    mockPrisma.petition.findUnique.mockResolvedValue({
      ...mockDraftPetition,
      documentUrl: "soc-1/pet-1/document.pdf",
    });
    await DELETE(makeDeleteRequest(), makeDetailParams());
    expect(mockCreateClient).toHaveBeenCalled();
    expect(mockSupabaseStorage.from).toHaveBeenCalledWith("petition-docs");
    expect(mockRemove).toHaveBeenCalledWith(["soc-1/pet-1/document.pdf"]);
    expect(mockPrisma.petition.delete).toHaveBeenCalledWith({ where: { id: "pet-1" } });
  });

  it("fires audit log PETITION_DELETED after successful deletion", async () => {
    await DELETE(makeDeleteRequest(), makeDetailParams());
    expect(mockLogAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        actionType: "PETITION_DELETED",
        userId: "admin-1",
        societyId: "soc-1",
        entityType: "Petition",
        entityId: "pet-1",
        oldValue: { title: "Fix the playground" },
      }),
    );
  });

  it("returns 500 on database error", async () => {
    mockPrisma.petition.findUnique.mockRejectedValue(new Error("DB crash"));
    const res = await DELETE(makeDeleteRequest(), makeDetailParams());
    expect(res.status).toBe(500);
  });
});

// ---------------------------------------------------------------------------
// PATCH — branch: parseBody returns { data: null, error: null } (internal guard)
// ---------------------------------------------------------------------------

describe("PATCH /api/v1/societies/[id]/petitions/[petitionId] — internal guard branch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCurrentUser.mockResolvedValue(mockAdmin);
    mockPrisma.petition.findUnique.mockResolvedValue(mockDraftPetition);
  });

  it("returns 500 when parseBody resolves with data=null and error=null", async () => {
    // Simulate the internal guard: data is null but error is also null (dead code path)
    mockParseBody.mockResolvedValue({ data: null, error: null });
    const res = await PATCH(makePatchRequest({ title: "New title" }), makeDetailParams());
    expect(res.status).toBe(500);
    mockParseBody.mockReset();
  });
});
