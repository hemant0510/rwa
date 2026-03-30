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

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/get-current-user", () => ({ getCurrentUser: mockGetCurrentUser }));
vi.mock("@/lib/audit", () => ({ logAudit: mockLogAudit }));

import { PATCH } from "@/app/api/v1/societies/[id]/petitions/[petitionId]/deadline/route";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRequest(body: unknown) {
  return new NextRequest("http://localhost/test", {
    method: "PATCH",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

function makeBadJsonRequest() {
  return new NextRequest("http://localhost/test", {
    method: "PATCH",
    body: "not json{{{",
    headers: { "Content-Type": "application/json" },
  });
}

function makeParams(societyId = "soc-1", petitionId = "pet-1") {
  return { params: Promise.resolve({ id: societyId, petitionId }) };
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const mockAdmin = { userId: "admin-1", authUserId: "auth-admin-1", role: "RWA_ADMIN" };

const basePetition = {
  id: "pet-1",
  societyId: "soc-1",
  title: "Test Petition",
  status: "PUBLISHED",
  deadline: new Date("2026-12-31"),
};

const updatedPetition = {
  ...basePetition,
  creator: { name: "Admin" },
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("PATCH /api/v1/societies/[id]/petitions/[petitionId]/deadline", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockLogAudit.mockResolvedValue(undefined);
  });

  // ── Auth ──────────────────────────────────────────────────────────────────

  it("returns 401 when not authenticated", async () => {
    mockGetCurrentUser.mockResolvedValue(null);
    const res = await PATCH(makeRequest({ deadline: "2026-12-31" }), makeParams());
    expect(res.status).toBe(401);
  });

  // ── 404 guards ────────────────────────────────────────────────────────────

  it("returns 404 when petition not found", async () => {
    mockGetCurrentUser.mockResolvedValue(mockAdmin);
    mockPrisma.petition.findUnique.mockResolvedValue(null);
    const res = await PATCH(makeRequest({ deadline: "2026-12-31" }), makeParams());
    expect(res.status).toBe(404);
  });

  it("returns 404 when petition belongs to a different society", async () => {
    mockGetCurrentUser.mockResolvedValue(mockAdmin);
    mockPrisma.petition.findUnique.mockResolvedValue({
      ...basePetition,
      societyId: "other-society",
    });
    const res = await PATCH(makeRequest({ deadline: "2026-12-31" }), makeParams());
    expect(res.status).toBe(404);
  });

  // ── Status guard ──────────────────────────────────────────────────────────

  it("returns 400 when petition is SUBMITTED", async () => {
    mockGetCurrentUser.mockResolvedValue(mockAdmin);
    mockPrisma.petition.findUnique.mockResolvedValue({ ...basePetition, status: "SUBMITTED" });
    const res = await PATCH(makeRequest({ deadline: "2026-12-31" }), makeParams());
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("INVALID_STATUS");
  });

  it("returns 400 when petition is CLOSED", async () => {
    mockGetCurrentUser.mockResolvedValue(mockAdmin);
    mockPrisma.petition.findUnique.mockResolvedValue({ ...basePetition, status: "CLOSED" });
    const res = await PATCH(makeRequest({ deadline: "2026-12-31" }), makeParams());
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("INVALID_STATUS");
  });

  // ── Body validation ────────────────────────────────────────────────────────

  it("returns 400 when body is invalid JSON", async () => {
    mockGetCurrentUser.mockResolvedValue(mockAdmin);
    mockPrisma.petition.findUnique.mockResolvedValue(basePetition);
    const res = await PATCH(makeBadJsonRequest(), makeParams());
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("INVALID_BODY");
  });

  it("returns 400 when deadline field is missing from body", async () => {
    mockGetCurrentUser.mockResolvedValue(mockAdmin);
    mockPrisma.petition.findUnique.mockResolvedValue(basePetition);
    const res = await PATCH(makeRequest({}), makeParams());
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns 400 when deadline is a number instead of string/null", async () => {
    mockGetCurrentUser.mockResolvedValue(mockAdmin);
    mockPrisma.petition.findUnique.mockResolvedValue(basePetition);
    const res = await PATCH(makeRequest({ deadline: 12345 }), makeParams());
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  // ── Happy paths ────────────────────────────────────────────────────────────

  it("returns 200 and updated petition when PUBLISHED petition deadline is set", async () => {
    mockGetCurrentUser.mockResolvedValue(mockAdmin);
    mockPrisma.petition.findUnique.mockResolvedValue(basePetition);
    mockPrisma.petition.update.mockResolvedValue(updatedPetition);

    const res = await PATCH(makeRequest({ deadline: "2026-12-31" }), makeParams());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe("pet-1");
  });

  it("allows updating deadline on DRAFT petitions", async () => {
    mockGetCurrentUser.mockResolvedValue(mockAdmin);
    mockPrisma.petition.findUnique.mockResolvedValue({ ...basePetition, status: "DRAFT" });
    mockPrisma.petition.update.mockResolvedValue(updatedPetition);

    const res = await PATCH(makeRequest({ deadline: "2026-06-01" }), makeParams());
    expect(res.status).toBe(200);
  });

  it("accepts null deadline to clear it", async () => {
    mockGetCurrentUser.mockResolvedValue(mockAdmin);
    mockPrisma.petition.findUnique.mockResolvedValue(basePetition);
    mockPrisma.petition.update.mockResolvedValue({ ...updatedPetition, deadline: null });

    const res = await PATCH(makeRequest({ deadline: null }), makeParams());
    expect(res.status).toBe(200);

    expect(mockPrisma.petition.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: { deadline: null },
      }),
    );
  });

  it("converts deadline string to Date when updating", async () => {
    mockGetCurrentUser.mockResolvedValue(mockAdmin);
    mockPrisma.petition.findUnique.mockResolvedValue(basePetition);
    mockPrisma.petition.update.mockResolvedValue(updatedPetition);

    await PATCH(makeRequest({ deadline: "2027-03-15" }), makeParams());

    const updateCall = mockPrisma.petition.update.mock.calls[0][0];
    expect(updateCall.data.deadline).toBeInstanceOf(Date);
    expect(updateCall.data.deadline.toISOString()).toContain("2027-03-15");
  });

  it("calls logAudit with correct payload", async () => {
    mockGetCurrentUser.mockResolvedValue(mockAdmin);
    mockPrisma.petition.findUnique.mockResolvedValue(basePetition);
    mockPrisma.petition.update.mockResolvedValue(updatedPetition);

    await PATCH(makeRequest({ deadline: "2026-12-31" }), makeParams());

    expect(mockLogAudit).toHaveBeenCalledWith(
      expect.objectContaining({
        actionType: "PETITION_UPDATED",
        userId: "admin-1",
        societyId: "soc-1",
        entityId: "pet-1",
        newValue: { deadline: "2026-12-31" },
      }),
    );
  });

  it("calls logAudit with null deadline when clearing", async () => {
    mockGetCurrentUser.mockResolvedValue(mockAdmin);
    mockPrisma.petition.findUnique.mockResolvedValue(basePetition);
    mockPrisma.petition.update.mockResolvedValue({ ...updatedPetition, deadline: null });

    await PATCH(makeRequest({ deadline: null }), makeParams());

    expect(mockLogAudit).toHaveBeenCalledWith(
      expect.objectContaining({ newValue: { deadline: null } }),
    );
  });

  // ── Error path ─────────────────────────────────────────────────────────────

  it("returns 500 when prisma update throws", async () => {
    mockGetCurrentUser.mockResolvedValue(mockAdmin);
    mockPrisma.petition.findUnique.mockResolvedValue(basePetition);
    mockPrisma.petition.update.mockRejectedValue(new Error("DB error"));

    const res = await PATCH(makeRequest({ deadline: "2026-12-31" }), makeParams());
    expect(res.status).toBe(500);
  });
});
