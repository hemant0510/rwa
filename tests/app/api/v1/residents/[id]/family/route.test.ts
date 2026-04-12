import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Hoisted mocks (inline — admin pattern) ─────────────────────────────────
const mockGetFullAccessAdmin = vi.hoisted(() => vi.fn());
const mockPrisma = vi.hoisted(() => ({
  user: { findUnique: vi.fn() },
  dependent: { findMany: vi.fn() },
}));
const mockStorageBucket = vi.hoisted(() => ({
  createSignedUrl: vi.fn(),
}));

vi.mock("@/lib/get-current-user", () => ({ getFullAccessAdmin: mockGetFullAccessAdmin }));
vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({ storage: { from: () => mockStorageBucket } }),
}));

import { GET } from "@/app/api/v1/residents/[id]/family/route";

const mockAdmin = {
  userId: "admin-1",
  authUserId: "auth-admin-1",
  societyId: "soc-1",
  role: "RWA_ADMIN" as const,
  adminPermission: "FULL_ACCESS" as const,
};

const mockResident = { id: "user-1", societyId: "soc-1", role: "RESIDENT" };

const mockDependent = {
  id: "dep-1",
  userId: "user-1",
  societyId: "soc-1",
  memberId: "MEM-001",
  memberSeq: 1,
  name: "Family Member",
  relationship: "SPOUSE",
  otherRelationship: null,
  dateOfBirth: new Date("1990-06-15"),
  bloodGroup: "O_POS",
  mobile: "9999999999",
  email: "family@example.com",
  occupation: "Engineer",
  photoUrl: null,
  idProofUrl: null,
  isEmergencyContact: true,
  emergencyPriority: 1,
  medicalNotes: null,
  isActive: true,
  deactivatedAt: null,
  createdAt: new Date("2026-01-01T00:00:00Z"),
  updatedAt: new Date("2026-01-01T00:00:00Z"),
};

const makeRequest = () => new Request("http://localhost/api/v1/residents/user-1/family") as never;

const makeContext = (id = "user-1") => ({
  params: Promise.resolve({ id }),
});

describe("GET /api/v1/residents/[id]/family", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetFullAccessAdmin.mockResolvedValue(mockAdmin);
    mockPrisma.user.findUnique.mockResolvedValue(mockResident);
    mockPrisma.dependent.findMany.mockResolvedValue([mockDependent]);
    mockStorageBucket.createSignedUrl.mockResolvedValue({ data: null, error: null });
  });

  it("returns 403 when user is not admin", async () => {
    mockGetFullAccessAdmin.mockResolvedValue(null);
    const res = await GET(makeRequest(), makeContext());
    expect(res.status).toBe(403);
  });

  it("returns 404 when resident is not found", async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);
    const res = await GET(makeRequest(), makeContext());
    expect(res.status).toBe(404);
  });

  it("returns 404 when target user is not a RESIDENT", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ ...mockResident, role: "RWA_ADMIN" });
    const res = await GET(makeRequest(), makeContext());
    expect(res.status).toBe(404);
  });

  it("returns 403 when resident belongs to a different society", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ ...mockResident, societyId: "other-soc" });
    const res = await GET(makeRequest(), makeContext());
    expect(res.status).toBe(403);
  });

  it("returns all dependents for the resident", async () => {
    const res = await GET(makeRequest(), makeContext());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.members).toHaveLength(1);
    expect(body.members[0].name).toBe("Family Member");
  });

  it("includes BOTH active and inactive dependents in the query", async () => {
    await GET(makeRequest(), makeContext());
    // No isActive filter — admin gets everyone
    expect(mockPrisma.dependent.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: "user-1" } }),
    );
  });

  it("orders dependents: active first, then by memberSeq", async () => {
    await GET(makeRequest(), makeContext());
    expect(mockPrisma.dependent.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        orderBy: [{ isActive: "desc" }, { memberSeq: "asc" }],
      }),
    );
  });

  it("generates signed URL for idProofUrl when present", async () => {
    mockPrisma.dependent.findMany.mockResolvedValue([
      { ...mockDependent, idProofUrl: "soc-1/dep-1/idproof.pdf" },
    ]);
    mockStorageBucket.createSignedUrl.mockResolvedValue({
      data: { signedUrl: "https://example.com/signed-proof" },
      error: null,
    });
    const res = await GET(makeRequest(), makeContext());
    const body = await res.json();
    expect(body.members[0].idProofSignedUrl).toBe("https://example.com/signed-proof");
    expect(mockStorageBucket.createSignedUrl).toHaveBeenCalledWith("soc-1/dep-1/idproof.pdf", 3600);
  });

  it("returns null idProofSignedUrl when idProofUrl is missing", async () => {
    const res = await GET(makeRequest(), makeContext());
    const body = await res.json();
    expect(body.members[0].idProofSignedUrl).toBeNull();
    expect(mockStorageBucket.createSignedUrl).not.toHaveBeenCalled();
  });

  it("falls back to null when signed URL generation fails", async () => {
    mockPrisma.dependent.findMany.mockResolvedValue([
      { ...mockDependent, idProofUrl: "soc-1/dep-1/idproof.pdf" },
    ]);
    mockStorageBucket.createSignedUrl.mockResolvedValue({
      data: null,
      error: { message: "fail" },
    });
    const res = await GET(makeRequest(), makeContext());
    const body = await res.json();
    expect(body.members[0].idProofSignedUrl).toBeNull();
  });

  it("computes age from dateOfBirth", async () => {
    const res = await GET(makeRequest(), makeContext());
    const body = await res.json();
    // dateOfBirth: 1990-06-15 — age ~35-36 depending on current date
    expect(typeof body.members[0].age).toBe("number");
    expect(body.members[0].age).toBeGreaterThan(30);
  });

  it("returns null age when dateOfBirth is null", async () => {
    mockPrisma.dependent.findMany.mockResolvedValue([{ ...mockDependent, dateOfBirth: null }]);
    const res = await GET(makeRequest(), makeContext());
    const body = await res.json();
    expect(body.members[0].age).toBeNull();
  });

  it("computes age correctly when birthday already passed this year", async () => {
    // dateOfBirth in January — birthday already passed in April
    mockPrisma.dependent.findMany.mockResolvedValue([
      { ...mockDependent, dateOfBirth: new Date("1990-01-15") },
    ]);
    const res = await GET(makeRequest(), makeContext());
    const body = await res.json();
    // age should be current_year - 1990 (birthday passed)
    expect(body.members[0].age).toBe(new Date().getFullYear() - 1990);
  });

  it("includes inactive members with deactivatedAt", async () => {
    const inactiveDep = {
      ...mockDependent,
      id: "dep-2",
      isActive: false,
      deactivatedAt: new Date("2026-03-01T00:00:00Z"),
    };
    mockPrisma.dependent.findMany.mockResolvedValue([inactiveDep]);
    const res = await GET(makeRequest(), makeContext());
    const body = await res.json();
    expect(body.members[0].isActive).toBe(false);
    expect(body.members[0].deactivatedAt).toBe("2026-03-01T00:00:00.000Z");
  });

  it("returns null deactivatedAt for active members", async () => {
    const res = await GET(makeRequest(), makeContext());
    const body = await res.json();
    expect(body.members[0].deactivatedAt).toBeNull();
  });

  it("returns 500 on unexpected error", async () => {
    mockPrisma.user.findUnique.mockRejectedValue(new Error("DB error"));
    const res = await GET(makeRequest(), makeContext());
    expect(res.status).toBe(500);
  });
});
