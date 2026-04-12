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
  vi.fn().mockReturnValue({ storage: mockSupabaseStorage }),
);
// Controllable parseBody spy — only used to exercise dead-code internal guard branch
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockParseBody = vi.hoisted(() => vi.fn<any>());

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/get-current-user", () => ({ getCurrentUser: mockGetCurrentUser }));
vi.mock("@/lib/audit", () => ({ logAudit: mockLogAudit }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: mockCreateClient }));
vi.mock("@/lib/api-helpers", async (importOriginal) => {
  const real = await importOriginal<typeof import("@/lib/api-helpers")>();
  return {
    ...real,
    parseBody: (...args: Parameters<typeof real.parseBody>) => {
      if (mockParseBody.getMockImplementation()) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        return (mockParseBody as any)(...args);
      }
      return real.parseBody(...args);
    },
  };
});

import { POST as PUBLISH } from "@/app/api/v1/societies/[id]/petitions/[petitionId]/publish/route";
import { POST as SUBMIT } from "@/app/api/v1/societies/[id]/petitions/[petitionId]/submit/route";
// eslint-disable-next-line import/order
import { POST as CLOSE } from "@/app/api/v1/societies/[id]/petitions/[petitionId]/close/route";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRequest(body: unknown = {}) {
  return new NextRequest("http://localhost/test", {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

function makeParams(societyId = "soc-1", petitionId = "pet-1") {
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

const mockDraftPetitionWithDoc = {
  id: "pet-1",
  societyId: "soc-1",
  title: "Fix the playground",
  description: "The playground equipment is broken",
  type: "PETITION",
  targetAuthority: "Municipal Corporation",
  minSignatures: 50,
  deadline: new Date("2026-06-01"),
  status: "DRAFT",
  documentUrl: "soc-1/pet-1/document.pdf",
  publishedAt: null,
  submittedAt: null,
  closedReason: null,
  createdBy: "admin-1",
  createdAt: new Date(),
  updatedAt: new Date(),
};

const mockPublishedPetition = {
  ...mockDraftPetitionWithDoc,
  status: "PUBLISHED",
  publishedAt: new Date(),
};

const mockUpdatedPetition = {
  ...mockPublishedPetition,
  creator: { name: "Admin User" },
};

// ---------------------------------------------------------------------------
// POST /societies/[id]/petitions/[petitionId]/publish
// ---------------------------------------------------------------------------

describe("POST /api/v1/societies/[id]/petitions/[petitionId]/publish", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCurrentUser.mockResolvedValue(mockAdmin);
    mockPrisma.petition.findUnique.mockResolvedValue(mockDraftPetitionWithDoc);
    mockPrisma.petition.update.mockResolvedValue(mockUpdatedPetition);
  });

  it("returns 401 when not authenticated", async () => {
    mockGetCurrentUser.mockResolvedValue(null);
    const res = await PUBLISH(makeRequest(), makeParams());
    expect(res.status).toBe(401);
  });

  it("returns 404 when petition does not exist", async () => {
    mockPrisma.petition.findUnique.mockResolvedValue(null);
    const res = await PUBLISH(makeRequest(), makeParams());
    expect(res.status).toBe(404);
  });

  it("returns 404 when petition belongs to a different society", async () => {
    mockPrisma.petition.findUnique.mockResolvedValue({
      ...mockDraftPetitionWithDoc,
      societyId: "other-soc",
    });
    const res = await PUBLISH(makeRequest(), makeParams("soc-1", "pet-1"));
    expect(res.status).toBe(404);
  });

  it("returns 400 with NOT_DRAFT when petition is already PUBLISHED", async () => {
    mockPrisma.petition.findUnique.mockResolvedValue(mockPublishedPetition);
    const res = await PUBLISH(makeRequest(), makeParams());
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("NOT_DRAFT");
  });

  it("returns 400 with NOT_DRAFT when petition is SUBMITTED", async () => {
    mockPrisma.petition.findUnique.mockResolvedValue({
      ...mockDraftPetitionWithDoc,
      status: "SUBMITTED",
    });
    const res = await PUBLISH(makeRequest(), makeParams());
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("NOT_DRAFT");
  });

  it("returns 400 with NOT_DRAFT when petition is CLOSED", async () => {
    mockPrisma.petition.findUnique.mockResolvedValue({
      ...mockDraftPetitionWithDoc,
      status: "CLOSED",
    });
    const res = await PUBLISH(makeRequest(), makeParams());
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("NOT_DRAFT");
  });

  it("returns 400 with NO_DOCUMENT when documentUrl is null", async () => {
    mockPrisma.petition.findUnique.mockResolvedValue({
      ...mockDraftPetitionWithDoc,
      documentUrl: null,
    });
    const res = await PUBLISH(makeRequest(), makeParams());
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("NO_DOCUMENT");
  });

  it("sets status to PUBLISHED and publishedAt on success", async () => {
    await PUBLISH(makeRequest(), makeParams());
    expect(mockPrisma.petition.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "pet-1" },
        data: expect.objectContaining({
          status: "PUBLISHED",
          publishedAt: expect.any(Date),
        }),
      }),
    );
  });

  it("returns 200 with updated petition on success", async () => {
    const res = await PUBLISH(makeRequest(), makeParams());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe("pet-1");
  });

  it("fires audit log PETITION_PUBLISHED after successful publish", async () => {
    await PUBLISH(makeRequest(), makeParams());
    expect(mockLogAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        actionType: "PETITION_PUBLISHED",
        userId: "admin-1",
        societyId: "soc-1",
        entityType: "Petition",
        entityId: "pet-1",
        newValue: { title: "Fix the playground" },
      }),
    );
  });

  it("returns 500 on database error", async () => {
    mockPrisma.petition.findUnique.mockRejectedValue(new Error("DB crash"));
    const res = await PUBLISH(makeRequest(), makeParams());
    expect(res.status).toBe(500);
  });
});

// ---------------------------------------------------------------------------
// POST /societies/[id]/petitions/[petitionId]/submit
// ---------------------------------------------------------------------------

describe("POST /api/v1/societies/[id]/petitions/[petitionId]/submit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCurrentUser.mockResolvedValue(mockAdmin);
    mockPrisma.petition.findUnique.mockResolvedValue(mockPublishedPetition);
    mockPrisma.petition.update.mockResolvedValue({
      ...mockPublishedPetition,
      status: "SUBMITTED",
      submittedAt: new Date(),
      creator: { name: "Admin User" },
    });
  });

  it("returns 401 when not authenticated", async () => {
    mockGetCurrentUser.mockResolvedValue(null);
    const res = await SUBMIT(makeRequest(), makeParams());
    expect(res.status).toBe(401);
  });

  it("returns 404 when petition does not exist", async () => {
    mockPrisma.petition.findUnique.mockResolvedValue(null);
    const res = await SUBMIT(makeRequest(), makeParams());
    expect(res.status).toBe(404);
  });

  it("returns 404 when petition belongs to a different society", async () => {
    mockPrisma.petition.findUnique.mockResolvedValue({
      ...mockPublishedPetition,
      societyId: "other-soc",
    });
    const res = await SUBMIT(makeRequest(), makeParams("soc-1", "pet-1"));
    expect(res.status).toBe(404);
  });

  it("returns 400 with NOT_PUBLISHED when petition is DRAFT", async () => {
    mockPrisma.petition.findUnique.mockResolvedValue(mockDraftPetitionWithDoc);
    const res = await SUBMIT(makeRequest(), makeParams());
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("NOT_PUBLISHED");
  });

  it("returns 400 with NOT_PUBLISHED when petition is SUBMITTED", async () => {
    mockPrisma.petition.findUnique.mockResolvedValue({
      ...mockPublishedPetition,
      status: "SUBMITTED",
    });
    const res = await SUBMIT(makeRequest(), makeParams());
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("NOT_PUBLISHED");
  });

  it("returns 400 with NOT_PUBLISHED when petition is CLOSED", async () => {
    mockPrisma.petition.findUnique.mockResolvedValue({
      ...mockPublishedPetition,
      status: "CLOSED",
    });
    const res = await SUBMIT(makeRequest(), makeParams());
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("NOT_PUBLISHED");
  });

  it("sets status to SUBMITTED and submittedAt on success", async () => {
    await SUBMIT(makeRequest(), makeParams());
    expect(mockPrisma.petition.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "pet-1" },
        data: expect.objectContaining({
          status: "SUBMITTED",
          submittedAt: expect.any(Date),
        }),
      }),
    );
  });

  it("returns 200 with updated petition on success", async () => {
    const res = await SUBMIT(makeRequest(), makeParams());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe("pet-1");
  });

  it("fires audit log PETITION_SUBMITTED after successful submit", async () => {
    await SUBMIT(makeRequest(), makeParams());
    expect(mockLogAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        actionType: "PETITION_SUBMITTED",
        userId: "admin-1",
        societyId: "soc-1",
        entityType: "Petition",
        entityId: "pet-1",
        newValue: { title: "Fix the playground" },
      }),
    );
  });

  it("returns 500 on database error", async () => {
    mockPrisma.petition.findUnique.mockRejectedValue(new Error("DB crash"));
    const res = await SUBMIT(makeRequest(), makeParams());
    expect(res.status).toBe(500);
  });
});

// ---------------------------------------------------------------------------
// POST /societies/[id]/petitions/[petitionId]/close
// ---------------------------------------------------------------------------

describe("POST /api/v1/societies/[id]/petitions/[petitionId]/close", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCurrentUser.mockResolvedValue(mockAdmin);
    mockPrisma.petition.findUnique.mockResolvedValue(mockPublishedPetition);
    mockPrisma.petition.update.mockResolvedValue({
      ...mockPublishedPetition,
      status: "CLOSED",
      closedReason: "Deadline passed without enough signatures",
      creator: { name: "Admin User" },
    });
  });

  it("returns 401 when not authenticated", async () => {
    mockGetCurrentUser.mockResolvedValue(null);
    const res = await CLOSE(makeRequest({ reason: "Not enough support" }), makeParams());
    expect(res.status).toBe(401);
  });

  it("returns 404 when petition does not exist", async () => {
    mockPrisma.petition.findUnique.mockResolvedValue(null);
    const res = await CLOSE(makeRequest({ reason: "Not enough support" }), makeParams());
    expect(res.status).toBe(404);
  });

  it("returns 404 when petition belongs to a different society", async () => {
    mockPrisma.petition.findUnique.mockResolvedValue({
      ...mockPublishedPetition,
      societyId: "other-soc",
    });
    const res = await CLOSE(makeRequest({ reason: "Not enough support" }), makeParams("soc-1"));
    expect(res.status).toBe(404);
  });

  it("returns 400 with NOT_PUBLISHED when petition is DRAFT", async () => {
    mockPrisma.petition.findUnique.mockResolvedValue(mockDraftPetitionWithDoc);
    const res = await CLOSE(makeRequest({ reason: "Not enough support" }), makeParams());
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("NOT_PUBLISHED");
  });

  it("returns 400 with NOT_PUBLISHED when petition is SUBMITTED", async () => {
    mockPrisma.petition.findUnique.mockResolvedValue({
      ...mockPublishedPetition,
      status: "SUBMITTED",
    });
    const res = await CLOSE(makeRequest({ reason: "Not enough support" }), makeParams());
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("NOT_PUBLISHED");
  });

  it("returns 422 when reason is missing", async () => {
    const res = await CLOSE(makeRequest({}), makeParams());
    expect(res.status).toBe(422);
  });

  it("returns 422 when reason is too short (under 3 chars)", async () => {
    const res = await CLOSE(makeRequest({ reason: "Ok" }), makeParams());
    expect(res.status).toBe(422);
  });

  it("sets status to CLOSED and stores closedReason on success", async () => {
    const reason = "Deadline passed without enough signatures";
    await CLOSE(makeRequest({ reason }), makeParams());
    expect(mockPrisma.petition.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "pet-1" },
        data: expect.objectContaining({
          status: "CLOSED",
          closedReason: reason,
        }),
      }),
    );
  });

  it("returns 200 with updated petition on success", async () => {
    const res = await CLOSE(
      makeRequest({ reason: "Deadline passed without enough signatures" }),
      makeParams(),
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe("pet-1");
    expect(body.status).toBe("CLOSED");
  });

  it("fires audit log PETITION_CLOSED after successful close", async () => {
    const reason = "Not enough community support";
    await CLOSE(makeRequest({ reason }), makeParams());
    expect(mockLogAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        actionType: "PETITION_CLOSED",
        userId: "admin-1",
        societyId: "soc-1",
        entityType: "Petition",
        entityId: "pet-1",
        newValue: { reason },
      }),
    );
  });

  it("returns 500 on database error", async () => {
    mockPrisma.petition.findUnique.mockRejectedValue(new Error("DB crash"));
    const res = await CLOSE(makeRequest({ reason: "Not enough support" }), makeParams());
    expect(res.status).toBe(500);
  });
});

// ---------------------------------------------------------------------------
// POST close — branch: parseBody returns { data: null, error: null } (internal guard)
// ---------------------------------------------------------------------------

describe("POST /api/v1/societies/[id]/petitions/[petitionId]/close — internal guard branch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetCurrentUser.mockResolvedValue(mockAdmin);
    mockPrisma.petition.findUnique.mockResolvedValue(mockPublishedPetition);
  });

  it("returns 500 when parseBody resolves with data=null and error=null", async () => {
    // Simulate the internal guard: data is null but error is also null (dead code path)
    mockParseBody.mockResolvedValue({ data: null, error: null } as never);
    const res = await CLOSE(makeRequest({ reason: "Valid reason text" }), makeParams());
    expect(res.status).toBe(500);
    mockParseBody.mockReset();
  });
});
