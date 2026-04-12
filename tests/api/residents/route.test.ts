import { NextRequest } from "next/server";

import { describe, it, expect, vi, beforeEach } from "vitest";

// vi.hoisted creates mock objects before any imports run.
const mockPrisma = vi.hoisted(() => ({
  user: {
    findMany: vi.fn(),
    count: vi.fn(),
  },
}));

const mockGetFullAccessAdmin = vi.hoisted(() => vi.fn());

const mockStorageBucket = vi.hoisted(() => ({
  createSignedUrl: vi.fn().mockResolvedValue({
    data: { signedUrl: "https://example.com/signed-photo" },
    error: null,
  }),
}));

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/get-current-user", () => ({
  getFullAccessAdmin: mockGetFullAccessAdmin,
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    storage: { from: () => mockStorageBucket },
  }),
}));

import { GET } from "@/app/api/v1/residents/route";

function makeReq(params: Record<string, string> = {}) {
  const url = new URL("http://localhost/api/v1/residents");
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  return new NextRequest(url.toString());
}

const mockResident = {
  id: "r1",
  name: "John Doe",
  mobile: "9876543210",
  email: "john@example.com",
  status: "ACTIVE_PAID",
  rwaid: "RWA-HR-GGN-122001-0001-2026-0001",
  isEmailVerified: true,
  ownershipType: "OWNER",
  registeredAt: new Date(),
  createdAt: new Date(),
  userUnits: [],
  membershipFees: [],
};

const mockAdmin = {
  userId: "admin-1",
  authUserId: "auth-admin-1",
  societyId: "soc-1",
  role: "RWA_ADMIN" as const,
  adminPermission: "FULL_ACCESS" as const,
};

describe("GET /api/v1/residents", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetFullAccessAdmin.mockResolvedValue(mockAdmin);
    mockPrisma.user.findMany.mockResolvedValue([mockResident]);
    mockPrisma.user.count.mockResolvedValue(1);
  });

  it("returns 401 when not authenticated", async () => {
    mockGetFullAccessAdmin.mockResolvedValue(null);
    const res = await GET(makeReq({ societyId: "soc-1" }));
    expect(res.status).toBe(401);
  });

  it("returns 403 when admin belongs to a different society", async () => {
    mockGetFullAccessAdmin.mockResolvedValue({ ...mockAdmin, societyId: "other-society" });
    const res = await GET(makeReq({ societyId: "soc-1" }));
    expect(res.status).toBe(403);
  });

  it("returns 400 when societyId is missing", async () => {
    const res = await GET(makeReq());
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("MISSING_PARAM");
  });

  it("returns residents list with pagination defaults", async () => {
    const res = await GET(makeReq({ societyId: "soc-1" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.data).toHaveLength(1);
    expect(body.total).toBe(1);
    expect(body.page).toBe(1);
    expect(body.limit).toBe(20);
  });

  it("filters by RESIDENT role always", async () => {
    await GET(makeReq({ societyId: "soc-1" }));
    expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ role: "RESIDENT", societyId: "soc-1" }),
      }),
    );
  });

  it("maps status=PENDING to PENDING_APPROVAL", async () => {
    await GET(makeReq({ societyId: "soc-1", status: "PENDING" }));
    expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: "PENDING_APPROVAL" }),
      }),
    );
  });

  it("maps status=ACTIVE to multiple active statuses", async () => {
    await GET(makeReq({ societyId: "soc-1", status: "ACTIVE" }));
    expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: { in: expect.arrayContaining(["ACTIVE_PAID", "ACTIVE_PENDING"]) },
        }),
      }),
    );
  });

  it("passes specific status directly (e.g., DEACTIVATED)", async () => {
    await GET(makeReq({ societyId: "soc-1", status: "DEACTIVATED" }));
    expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ status: "DEACTIVATED" }),
      }),
    );
  });

  it("filters emailVerified=true", async () => {
    await GET(makeReq({ societyId: "soc-1", emailVerified: "true" }));
    expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ isEmailVerified: true }),
      }),
    );
  });

  it("filters emailVerified=false", async () => {
    await GET(makeReq({ societyId: "soc-1", emailVerified: "false" }));
    expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ isEmailVerified: false }),
      }),
    );
  });

  it("ignores emailVerified when not provided", async () => {
    await GET(makeReq({ societyId: "soc-1" }));
    const callArg = mockPrisma.user.findMany.mock.calls[0][0];
    expect(callArg.where.isEmailVerified).toBeUndefined();
  });

  it("filters by ownershipType", async () => {
    await GET(makeReq({ societyId: "soc-1", ownershipType: "TENANT" }));
    expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ ownershipType: "TENANT" }),
      }),
    );
  });

  it("ignores ownershipType=all", async () => {
    await GET(makeReq({ societyId: "soc-1", ownershipType: "all" }));
    const callArg = mockPrisma.user.findMany.mock.calls[0][0];
    expect(callArg.where.ownershipType).toBeUndefined();
  });

  it("adds OR clause for search across name, mobile, email, rwaid", async () => {
    await GET(makeReq({ societyId: "soc-1", search: "john" }));
    const callArg = mockPrisma.user.findMany.mock.calls[0][0];
    expect(callArg.where.OR).toEqual(
      expect.arrayContaining([
        { name: { contains: "john", mode: "insensitive" } },
        { mobile: { contains: "john" } },
        { email: { contains: "john", mode: "insensitive" } },
        { rwaid: { contains: "john", mode: "insensitive" } },
      ]),
    );
  });

  it("adds AND clause with year filter (no search)", async () => {
    await GET(makeReq({ societyId: "soc-1", year: "2026" }));
    const callArg = mockPrisma.user.findMany.mock.calls[0][0];
    expect(callArg.where.AND).toEqual(expect.arrayContaining([{ rwaid: { contains: "-2026-" } }]));
    expect(callArg.where.OR).toBeUndefined();
  });

  it("combines search OR with year using AND when both provided", async () => {
    await GET(makeReq({ societyId: "soc-1", search: "john", year: "2026" }));
    const callArg = mockPrisma.user.findMany.mock.calls[0][0];
    // OR moved into AND
    expect(callArg.where.AND).toBeDefined();
    expect(callArg.where.OR).toBeUndefined();
    const andClauses = callArg.where.AND as unknown[];
    expect(andClauses).toHaveLength(2);
    expect(andClauses[1]).toEqual({ rwaid: { contains: "-2026-" } });
  });

  it("ignores year=all", async () => {
    await GET(makeReq({ societyId: "soc-1", year: "all" }));
    const callArg = mockPrisma.user.findMany.mock.calls[0][0];
    expect(callArg.where.AND).toBeUndefined();
  });

  it("respects custom page and limit", async () => {
    mockPrisma.user.count.mockResolvedValue(100);
    await GET(makeReq({ societyId: "soc-1", page: "3", limit: "50" }));
    expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ skip: 100, take: 50 }),
    );
  });

  it("generates signed photo URL for residents with photoUrl", async () => {
    const residentWithPhoto = {
      ...mockResident,
      photoUrl: "soc-1/r1/photo.jpg",
    };
    mockPrisma.user.findMany.mockResolvedValue([residentWithPhoto]);

    const res = await GET(makeReq({ societyId: "soc-1" }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data[0].photoUrl).toBe("https://example.com/signed-photo");
    expect(mockStorageBucket.createSignedUrl).toHaveBeenCalledWith("soc-1/r1/photo.jpg", 3600);
  });

  it("skips signed URL generation when resident has no photoUrl", async () => {
    const residentNoPhoto = { ...mockResident, photoUrl: null };
    mockPrisma.user.findMany.mockResolvedValue([residentNoPhoto]);

    const res = await GET(makeReq({ societyId: "soc-1" }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data[0].photoUrl).toBeNull();
    expect(mockStorageBucket.createSignedUrl).not.toHaveBeenCalled();
  });

  it("falls back to null when signed URL generation fails", async () => {
    const residentWithPhoto = {
      ...mockResident,
      photoUrl: "soc-1/r1/photo.jpg",
    };
    mockPrisma.user.findMany.mockResolvedValue([residentWithPhoto]);
    mockStorageBucket.createSignedUrl.mockResolvedValue({
      data: null,
      error: { message: "Storage error" },
    });

    const res = await GET(makeReq({ societyId: "soc-1" }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.data[0].photoUrl).toBeNull();
  });

  it("returns 500 on unexpected error", async () => {
    mockPrisma.user.findMany.mockRejectedValue(new Error("DB crash"));
    const res = await GET(makeReq({ societyId: "soc-1" }));
    expect(res.status).toBe(500);
  });

  it("docStatus=full adds AND requiring both proofs uploaded", async () => {
    await GET(makeReq({ societyId: "soc-1", docStatus: "full" }));
    const callArg = mockPrisma.user.findMany.mock.calls[0][0];
    expect(callArg.where.AND).toEqual(
      expect.arrayContaining([{ idProofUrl: { not: null } }, { ownershipProofUrl: { not: null } }]),
    );
  });

  it("docStatus=none adds AND requiring both proofs missing", async () => {
    await GET(makeReq({ societyId: "soc-1", docStatus: "none" }));
    const callArg = mockPrisma.user.findMany.mock.calls[0][0];
    expect(callArg.where.AND).toEqual(
      expect.arrayContaining([{ idProofUrl: null }, { ownershipProofUrl: null }]),
    );
  });

  it("docStatus=partial adds AND with OR clause (exactly one proof)", async () => {
    await GET(makeReq({ societyId: "soc-1", docStatus: "partial" }));
    const callArg = mockPrisma.user.findMany.mock.calls[0][0];
    const andClauses = callArg.where.AND as unknown[];
    expect(andClauses).toBeDefined();
    const hasOr = andClauses.some(
      (c) => typeof c === "object" && c !== null && "OR" in (c as object),
    );
    expect(hasOr).toBe(true);
  });

  it("docStatus not provided leaves AND undefined", async () => {
    await GET(makeReq({ societyId: "soc-1" }));
    const callArg = mockPrisma.user.findMany.mock.calls[0][0];
    expect(callArg.where.AND).toBeUndefined();
  });

  it("docStatus=full combined with year preserves both filters in AND", async () => {
    await GET(makeReq({ societyId: "soc-1", docStatus: "full", year: "2026" }));
    const callArg = mockPrisma.user.findMany.mock.calls[0][0];
    const andClauses = callArg.where.AND as unknown[];
    expect(andClauses).toEqual(
      expect.arrayContaining([
        { idProofUrl: { not: null } },
        { ownershipProofUrl: { not: null } },
        { rwaid: { contains: "-2026-" } },
      ]),
    );
  });

  it("includes familyCount and vehicleSummary in each resident response", async () => {
    const residentWithCounts = {
      ...mockResident,
      _count: { dependents: 3 },
      vehiclesOwned: [{ registrationNumber: "DL3CAB1234" }, { registrationNumber: "MH12AB5678" }],
    };
    mockPrisma.user.findMany.mockResolvedValue([residentWithCounts]);

    const res = await GET(makeReq({ societyId: "soc-1" }));
    const body = await res.json();
    expect(body.data[0].familyCount).toBe(3);
    expect(body.data[0].vehicleSummary).toEqual({ count: 2, firstReg: "DL3CAB1234" });
  });

  it("defaults familyCount to 0 and vehicleSummary to empty when _count and vehicles are missing", async () => {
    const bareResident = { ...mockResident };
    mockPrisma.user.findMany.mockResolvedValue([bareResident]);

    const res = await GET(makeReq({ societyId: "soc-1" }));
    const body = await res.json();
    expect(body.data[0].familyCount).toBe(0);
    expect(body.data[0].vehicleSummary).toEqual({ count: 0, firstReg: null });
  });

  it("queries vehicles sorted by createdAt asc with registrationNumber selected", async () => {
    await GET(makeReq({ societyId: "soc-1" }));
    expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        include: expect.objectContaining({
          _count: { select: { dependents: { where: { isActive: true } } } },
          vehiclesOwned: {
            where: { isActive: true },
            orderBy: { createdAt: "asc" },
            select: { registrationNumber: true },
          },
        }),
      }),
    );
  });
});
