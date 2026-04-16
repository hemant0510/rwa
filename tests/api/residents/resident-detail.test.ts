import { NextRequest } from "next/server";

import { describe, it, expect, vi, beforeEach } from "vitest";

// vi.hoisted creates mock objects before any imports run.
const mockPrisma = vi.hoisted(() => ({
  user: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  auditLog: {
    create: vi.fn(),
  },
  $transaction: vi.fn(),
}));

const mockGetAdminContext = vi.hoisted(() => vi.fn());
const mockGetCurrentUser = vi.hoisted(() => vi.fn());

const mockStorageBucket = vi.hoisted(() => ({
  createSignedUrl: vi.fn(),
}));

const mockUpdateUserById = vi.hoisted(() => vi.fn());

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/get-current-user", () => ({
  getAdminContext: mockGetAdminContext,
  getCurrentUser: mockGetCurrentUser,
}));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    storage: { from: () => mockStorageBucket },
    auth: { admin: { updateUserById: mockUpdateUserById } },
  }),
}));

import { GET, PATCH, DELETE } from "@/app/api/v1/residents/[id]/route";

const RESIDENT_ID = "res-123";

function makeReq(body?: Record<string, unknown>) {
  const url = `http://localhost/api/v1/residents/${RESIDENT_ID}`;
  if (body) {
    return new NextRequest(url, {
      method: "POST",
      body: JSON.stringify(body),
      headers: { "Content-Type": "application/json" },
    });
  }
  return new NextRequest(url);
}

function makeParams(id = RESIDENT_ID) {
  return { params: Promise.resolve({ id }) };
}

const mockResident = {
  id: RESIDENT_ID,
  name: "Jane Doe",
  mobile: "9876543210",
  email: "jane@example.com",
  status: "ACTIVE_PAID",
  photoUrl: "photos/jane.jpg",
  societyId: "soc-1",
  authUserId: "auth-res-123",
  ownershipType: "OWNER",
  society: { id: "soc-1", name: "Eden Estate" },
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

describe("GET /api/v1/residents/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
    mockGetAdminContext.mockResolvedValue(mockAdmin);
    // Reset to clear any leftover mockResolvedValueOnce queue, then set up chain
    mockPrisma.user.findUnique.mockReset();
    // First call: entity lookup (select societyId). Second call: full resident.
    mockPrisma.user.findUnique
      .mockResolvedValueOnce({ societyId: "soc-1" })
      .mockResolvedValueOnce(mockResident);
  });

  it("returns 404 when resident entity not found", async () => {
    mockPrisma.user.findUnique.mockReset();
    mockPrisma.user.findUnique.mockResolvedValue(null);

    const res = await GET(makeReq(), makeParams());
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error.code).toBe("NOT_FOUND");
  });

  it("returns 403 when caller is not admin (security fix)", async () => {
    mockGetAdminContext.mockResolvedValue(null);

    const res = await GET(makeReq(), makeParams());
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error.code).toBe("FORBIDDEN");
    expect(mockGetAdminContext).toHaveBeenCalledWith("soc-1");
  });

  it("returns 200 with resident data and signed photo URL", async () => {
    mockStorageBucket.createSignedUrl.mockResolvedValue({
      data: { signedUrl: "https://storage.example.com/signed-photo" },
      error: null,
    });

    const res = await GET(makeReq(), makeParams());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.photoUrl).toBe("https://storage.example.com/signed-photo");
    expect(body.name).toBe("Jane Doe");
    expect(mockStorageBucket.createSignedUrl).toHaveBeenCalledWith("photos/jane.jpg", 3600);
  });

  it("returns 200 for Super Admin viewing another society", async () => {
    mockGetAdminContext.mockResolvedValue({
      userId: null,
      authUserId: "auth-sa",
      societyId: "soc-1",
      role: "SUPER_ADMIN",
      adminPermission: "FULL_ACCESS",
      isSuperAdmin: true,
    });

    const res = await GET(makeReq(), makeParams());
    expect(res.status).toBe(200);
  });

  it("returns photoUrl as null when user has no photoUrl", async () => {
    mockPrisma.user.findUnique.mockReset();
    mockPrisma.user.findUnique
      .mockResolvedValueOnce({ societyId: "soc-1" })
      .mockResolvedValueOnce({ ...mockResident, photoUrl: null });

    const res = await GET(makeReq(), makeParams());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.photoUrl).toBeNull();
    expect(mockStorageBucket.createSignedUrl).not.toHaveBeenCalled();
  });

  it("returns photoUrl as null when signed URL generation returns no data", async () => {
    mockStorageBucket.createSignedUrl.mockResolvedValue({
      data: null,
      error: { message: "not found" },
    });

    const res = await GET(makeReq(), makeParams());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.photoUrl).toBeNull();
  });

  it("returns 500 on unexpected error", async () => {
    mockPrisma.user.findUnique.mockReset();
    mockPrisma.user.findUnique.mockRejectedValue(new Error("DB crash"));

    const res = await GET(makeReq(), makeParams());
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error.code).toBe("INTERNAL_ERROR");
  });

  it("includes related society, userUnits, and membershipFees in full query", async () => {
    mockPrisma.user.findUnique.mockReset();
    mockPrisma.user.findUnique
      .mockResolvedValueOnce({ societyId: "soc-1" })
      .mockResolvedValueOnce({ ...mockResident, photoUrl: null });

    await GET(makeReq(), makeParams());
    // Second call is the full query
    expect(mockPrisma.user.findUnique).toHaveBeenLastCalledWith({
      where: { id: RESIDENT_ID },
      include: {
        society: true,
        userUnits: { include: { unit: true } },
        membershipFees: {
          orderBy: { createdAt: "desc" },
          include: {
            feePayments: { orderBy: { createdAt: "desc" } },
          },
        },
      },
    });
  });
});

describe("PATCH /api/v1/residents/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
    mockGetCurrentUser.mockResolvedValue(mockAdmin);
    mockPrisma.user.findUnique.mockResolvedValue(mockResident);
  });

  it("returns 401 when not authenticated", async () => {
    mockGetCurrentUser.mockResolvedValue(null);

    const res = await PATCH(makeReq({ name: "Updated" }), makeParams());
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error.code).toBe("UNAUTHORIZED");
  });

  it("returns 404 when resident not found", async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);

    const res = await PATCH(makeReq({ name: "Updated" }), makeParams());
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error.code).toBe("NOT_FOUND");
  });

  it("returns 403 when admin belongs to a different society", async () => {
    mockGetCurrentUser.mockResolvedValue({ ...mockAdmin, societyId: "other-soc" });

    const res = await PATCH(makeReq({ name: "Updated" }), makeParams());
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error.code).toBe("FORBIDDEN");
  });

  it("returns 422 for validation error (invalid mobile)", async () => {
    const res = await PATCH(makeReq({ mobile: "12345" }), makeParams());
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(body.error.details).toBeDefined();
  });

  it("returns 422 for validation error (name too short)", async () => {
    const res = await PATCH(makeReq({ name: "A" }), makeParams());
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns 422 for validation error (invalid email)", async () => {
    const res = await PATCH(makeReq({ email: "not-an-email" }), makeParams());
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns 422 for validation error (invalid ownershipType)", async () => {
    const res = await PATCH(makeReq({ ownershipType: "INVALID" }), makeParams());
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns 200 and updates resident on valid input", async () => {
    const updatedResident = { ...mockResident, name: "Updated Name" };
    mockPrisma.user.update.mockResolvedValue(updatedResident);

    const res = await PATCH(makeReq({ name: "Updated Name" }), makeParams());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.name).toBe("Updated Name");
    expect(mockPrisma.user.update).toHaveBeenCalledWith({
      where: { id: RESIDENT_ID },
      data: { name: "Updated Name" },
    });
  });

  it("updates with multiple valid fields", async () => {
    const updatedResident = {
      ...mockResident,
      name: "New Name",
      mobile: "9123456789",
      email: "new@example.com",
      ownershipType: "TENANT",
    };
    mockPrisma.user.update.mockResolvedValue(updatedResident);

    const res = await PATCH(
      makeReq({
        name: "New Name",
        mobile: "9123456789",
        email: "new@example.com",
        ownershipType: "TENANT",
      }),
      makeParams(),
    );
    expect(res.status).toBe(200);
    expect(mockPrisma.user.update).toHaveBeenCalledWith({
      where: { id: RESIDENT_ID },
      data: {
        name: "New Name",
        mobile: "9123456789",
        email: "new@example.com",
        ownershipType: "TENANT",
      },
    });
  });

  it("returns 500 on unexpected error", async () => {
    mockPrisma.user.update.mockRejectedValue(new Error("DB crash"));

    const res = await PATCH(makeReq({ name: "Valid Name" }), makeParams());
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error.code).toBe("INTERNAL_ERROR");
    expect(console.error).toHaveBeenCalled();
  });

  it("calls getCurrentUser with RWA_ADMIN role", async () => {
    mockPrisma.user.update.mockResolvedValue(mockResident);
    await PATCH(makeReq({ name: "Valid" }), makeParams());
    expect(mockGetCurrentUser).toHaveBeenCalledWith("RWA_ADMIN");
  });
});

describe("DELETE /api/v1/residents/[id]", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, "error").mockImplementation(() => {});
    mockGetCurrentUser.mockResolvedValue(mockAdmin);
    mockPrisma.user.findUnique.mockResolvedValue(mockResident);
    mockPrisma.$transaction.mockImplementation(async (fn: (tx: typeof mockPrisma) => unknown) => {
      await fn(mockPrisma);
    });
    mockUpdateUserById.mockResolvedValue({ data: {}, error: null });
  });

  it("returns 401 when not authenticated", async () => {
    mockGetCurrentUser.mockResolvedValue(null);

    const res = await DELETE(makeReq({ reason: "Moved out of society" }), makeParams());
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error.code).toBe("UNAUTHORIZED");
  });

  it("returns 404 when resident not found", async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);

    const res = await DELETE(makeReq({ reason: "Moved out of society" }), makeParams());
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error.code).toBe("NOT_FOUND");
  });

  it("returns 400 when resident is already deactivated", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      ...mockResident,
      status: "DEACTIVATED",
    });

    const res = await DELETE(makeReq({ reason: "Moved out of society" }), makeParams());
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("ALREADY_DEACTIVATED");
  });

  it("returns 403 when admin belongs to a different society", async () => {
    mockGetCurrentUser.mockResolvedValue({ ...mockAdmin, societyId: "other-soc" });

    const res = await DELETE(makeReq({ reason: "Moved out of society" }), makeParams());
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error.code).toBe("FORBIDDEN");
  });

  it("returns 422 when reason is missing", async () => {
    const res = await DELETE(makeReq({}), makeParams());
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns 422 when reason is too short", async () => {
    const res = await DELETE(makeReq({ reason: "abc" }), makeParams());
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns 200 and deactivates resident with transaction and audit log", async () => {
    const res = await DELETE(makeReq({ reason: "Moved out of society" }), makeParams());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.message).toBe("Resident deactivated successfully");

    // Verify transaction was called
    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);

    // Verify user update within transaction
    expect(mockPrisma.user.update).toHaveBeenCalledWith({
      where: { id: RESIDENT_ID },
      data: {
        status: "DEACTIVATED",
        deactivatedAt: expect.any(Date),
        deactivationReason: "Moved out of society",
      },
    });

    // Verify audit log within transaction
    expect(mockPrisma.auditLog.create).toHaveBeenCalledWith({
      data: {
        societyId: "soc-1",
        userId: "admin-1",
        actionType: "DEACTIVATE",
        entityType: "USER",
        entityId: RESIDENT_ID,
        oldValue: { status: "ACTIVE_PAID" },
        newValue: { status: "DEACTIVATED", reason: "Moved out of society" },
      },
    });
  });

  it("disables Supabase auth account when authUserId exists", async () => {
    await DELETE(makeReq({ reason: "Moved out of society" }), makeParams());

    expect(mockUpdateUserById).toHaveBeenCalledWith("auth-res-123", {
      ban_duration: "876600h",
    });
  });

  it("skips Supabase auth disable when authUserId is null", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({
      ...mockResident,
      authUserId: null,
    });

    const res = await DELETE(makeReq({ reason: "Moved out of society" }), makeParams());
    expect(res.status).toBe(200);
    expect(mockUpdateUserById).not.toHaveBeenCalled();
  });

  it("still succeeds when Supabase auth disable fails", async () => {
    mockUpdateUserById.mockRejectedValue(new Error("Supabase error"));

    const res = await DELETE(makeReq({ reason: "Moved out of society" }), makeParams());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.message).toBe("Resident deactivated successfully");
    expect(console.error).toHaveBeenCalledWith(
      "Failed to disable auth account:",
      expect.any(Error),
    );
  });

  it("calls getCurrentUser with RWA_ADMIN role", async () => {
    await DELETE(makeReq({ reason: "Moved out of society" }), makeParams());
    expect(mockGetCurrentUser).toHaveBeenCalledWith("RWA_ADMIN");
  });

  it("returns 500 on unexpected error", async () => {
    mockPrisma.$transaction.mockRejectedValue(new Error("TX crash"));

    const res = await DELETE(makeReq({ reason: "Moved out of society" }), makeParams());
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error.code).toBe("INTERNAL_ERROR");
    expect(console.error).toHaveBeenCalled();
  });
});
