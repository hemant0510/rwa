import { NextRequest } from "next/server";

import { describe, it, expect, vi, beforeEach } from "vitest";

// vi.hoisted creates mock objects before any imports run,
// so vi.mock factories can safely reference them.
const mockPrisma = vi.hoisted(() => {
  const prisma = {
    society: { findUnique: vi.fn() },
    user: {
      findFirst: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
    },
    unit: { create: vi.fn() },
    userUnit: { create: vi.fn() },
    $transaction: vi.fn(),
  };
  // Route wraps user/unit creation in a transaction — pass prisma itself as tx
  prisma.$transaction.mockImplementation((cb: (tx: typeof prisma) => Promise<unknown>) =>
    cb(prisma),
  );
  return prisma;
});

const mockSupabaseAdmin = vi.hoisted(() => ({
  auth: {
    admin: {
      createUser: vi.fn(),
    },
  },
}));

const mockGeneratePasswordResetToken = vi.hoisted(() => vi.fn().mockResolvedValue("setup-token"));
const mockSendEmail = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
const mockGetFullAccessAdmin = vi.hoisted(() => vi.fn());

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: vi.fn().mockReturnValue(mockSupabaseAdmin),
}));
vi.mock("@/lib/get-current-user", () => ({
  getFullAccessAdmin: mockGetFullAccessAdmin,
}));
vi.mock("@/lib/tokens", () => ({ generatePasswordResetToken: mockGeneratePasswordResetToken }));
vi.mock("@/lib/email", () => ({ sendEmail: mockSendEmail }));
vi.mock("@/lib/email-templates/welcome-setup", () => ({
  getWelcomeSetupEmailHtml: vi.fn().mockReturnValue("<html>welcome</html>"),
}));

import { POST } from "@/app/api/v1/residents/bulk-upload/route";

function makeReq(body: unknown) {
  return new NextRequest("http://localhost/api/v1/residents/bulk-upload", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const mockSociety = {
  id: "soc-1",
  societyId: "RWA-HR-GGN-122001-0001",
  societyCode: "EDEN",
  status: "ACTIVE",
};

const validRecord = {
  fullName: "John Doe",
  email: "john@example.com",
  mobile: "9876543210",
  ownershipType: "OWNER",
};

const mockAdmin = {
  userId: "admin-1",
  authUserId: "auth-admin-1",
  societyId: "soc-1",
  role: "RWA_ADMIN" as const,
  adminPermission: "FULL_ACCESS" as const,
};

describe("POST /api/v1/residents/bulk-upload", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetFullAccessAdmin.mockResolvedValue(mockAdmin);
    mockPrisma.society.findUnique.mockResolvedValue(mockSociety);
    mockPrisma.user.findFirst.mockResolvedValue(null); // no duplicates
    mockPrisma.user.count.mockResolvedValue(0); // no existing RWAIDs for year
    mockPrisma.user.create.mockResolvedValue({ id: "new-r1" });
    mockPrisma.unit.create.mockResolvedValue({ id: "unit-1" });
    mockPrisma.userUnit.create.mockResolvedValue({});
    mockSupabaseAdmin.auth.admin.createUser.mockResolvedValue({
      data: { user: { id: "auth-uuid-1" } },
      error: null,
    });
    mockSupabaseAdmin.auth.admin.deleteUser = vi.fn().mockResolvedValue({ error: null });
    mockGeneratePasswordResetToken.mockResolvedValue("setup-token");
    mockSendEmail.mockResolvedValue(undefined);
  });

  it("returns 401 when not authenticated", async () => {
    mockGetFullAccessAdmin.mockResolvedValue(null);
    const res = await POST(makeReq({ societyCode: "EDEN", records: [validRecord] }));
    expect(res.status).toBe(401);
  });

  it("returns 403 when admin belongs to a different society", async () => {
    mockGetFullAccessAdmin.mockResolvedValue({ ...mockAdmin, societyId: "different-society" });
    const res = await POST(makeReq({ societyCode: "EDEN", records: [validRecord] }));
    expect(res.status).toBe(403);
  });

  it("returns 422 when body is missing required fields", async () => {
    const res = await POST(makeReq({ societyCode: "EDEN" })); // missing records
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns 422 when records array is empty", async () => {
    const res = await POST(makeReq({ societyCode: "EDEN", records: [] }));
    expect(res.status).toBe(422);
  });

  it("returns 422 when a record has invalid email", async () => {
    const res = await POST(
      makeReq({
        societyCode: "EDEN",
        records: [{ ...validRecord, email: "not-an-email" }],
      }),
    );
    expect(res.status).toBe(422);
  });

  it("returns 422 when a record has invalid mobile", async () => {
    const res = await POST(
      makeReq({
        societyCode: "EDEN",
        records: [{ ...validRecord, mobile: "12345" }],
      }),
    );
    expect(res.status).toBe(422);
  });

  it("returns 422 when ownershipType is not OWNER or TENANT", async () => {
    const res = await POST(
      makeReq({
        societyCode: "EDEN",
        records: [{ ...validRecord, ownershipType: "OTHER" }],
      }),
    );
    expect(res.status).toBe(422);
  });

  it("returns 404 when society not found", async () => {
    mockPrisma.society.findUnique.mockResolvedValue(null);
    const res = await POST(makeReq({ societyCode: "EDEN", records: [validRecord] }));
    expect(res.status).toBe(404);
  });

  it("returns 404 when society is SUSPENDED", async () => {
    mockPrisma.society.findUnique.mockResolvedValue({ ...mockSociety, status: "SUSPENDED" });
    const res = await POST(makeReq({ societyCode: "EDEN", records: [validRecord] }));
    expect(res.status).toBe(404);
  });

  it("successfully processes a valid record and returns rwaid", async () => {
    const res = await POST(makeReq({ societyCode: "EDEN", records: [validRecord] }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.results).toHaveLength(1);
    expect(body.results[0].success).toBe(true);
    expect(body.results[0].rwaid).toContain("RWA-HR-GGN-122001-0001");
    expect(body.results[0].rowIndex).toBe(0);
  });

  it("uses registrationYear in RWAID when provided", async () => {
    const res = await POST(
      makeReq({ societyCode: "EDEN", records: [{ ...validRecord, registrationYear: 2021 }] }),
    );
    const body = await res.json();
    expect(body.results[0].rwaid).toContain("-2021-");
  });

  it("uses current year in RWAID when registrationYear is not provided", async () => {
    const currentYear = new Date().getFullYear();
    const res = await POST(makeReq({ societyCode: "EDEN", records: [validRecord] }));
    const body = await res.json();
    expect(body.results[0].rwaid).toContain(`-${currentYear}-`);
  });

  it("sets joiningFeePaid=true for all bulk-imported residents", async () => {
    await POST(makeReq({ societyCode: "EDEN", records: [validRecord] }));
    expect(mockPrisma.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ joiningFeePaid: true }),
      }),
    );
  });

  it("sets status=ACTIVE_PENDING for all bulk-imported residents", async () => {
    await POST(makeReq({ societyCode: "EDEN", records: [validRecord] }));
    expect(mockPrisma.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "ACTIVE_PENDING" }),
      }),
    );
  });

  it("sets isEmailVerified=true for all bulk-imported residents", async () => {
    await POST(makeReq({ societyCode: "EDEN", records: [validRecord] }));
    expect(mockPrisma.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ isEmailVerified: true }),
      }),
    );
  });

  it("sets approvedAt and activatedAt for bulk-imported residents", async () => {
    await POST(makeReq({ societyCode: "EDEN", records: [validRecord] }));
    expect(mockPrisma.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          approvedAt: expect.any(Date),
          activatedAt: expect.any(Date),
        }),
      }),
    );
  });

  it("reuses existing Supabase auth account when email already has authUserId", async () => {
    mockPrisma.user.findFirst
      .mockResolvedValueOnce(null) // no email duplicate in society
      .mockResolvedValueOnce(null) // no mobile duplicate in society
      .mockResolvedValueOnce({ authUserId: "existing-auth-id" }); // existing auth lookup

    const res = await POST(makeReq({ societyCode: "EDEN", records: [validRecord] }));
    const body = await res.json();
    expect(body.results[0].success).toBe(true);
    expect(mockSupabaseAdmin.auth.admin.createUser).not.toHaveBeenCalled();
    expect(mockPrisma.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ authUserId: "existing-auth-id" }),
      }),
    );
  });

  it("fails record gracefully when Supabase auth creation fails", async () => {
    mockSupabaseAdmin.auth.admin.createUser.mockResolvedValue({
      data: null,
      error: { message: "Auth service unavailable" },
    });
    const res = await POST(makeReq({ societyCode: "EDEN", records: [validRecord] }));
    const body = await res.json();
    expect(body.results[0].success).toBe(false);
    expect(body.results[0].error).toContain("Auth account error");
  });

  it("fails record when email is already active in the society", async () => {
    mockPrisma.user.findFirst.mockResolvedValueOnce({
      id: "existing-r1",
      status: "ACTIVE_PAID",
    });
    const res = await POST(makeReq({ societyCode: "EDEN", records: [validRecord] }));
    const body = await res.json();
    expect(body.results[0].success).toBe(false);
    expect(body.results[0].error).toContain("Email is already registered");
  });

  it("fails record when mobile is already active in the society", async () => {
    mockPrisma.user.findFirst
      .mockResolvedValueOnce(null) // no email conflict
      .mockResolvedValueOnce({ id: "existing-r2", status: "ACTIVE_PENDING" }); // mobile conflict
    const res = await POST(makeReq({ societyCode: "EDEN", records: [validRecord] }));
    const body = await res.json();
    expect(body.results[0].success).toBe(false);
    expect(body.results[0].error).toContain("Mobile number is already registered");
  });

  it("continues processing subsequent records after one fails", async () => {
    const record2 = { ...validRecord, email: "jane@example.com", mobile: "9123456789" };

    // First record: email conflict
    mockPrisma.user.findFirst
      .mockResolvedValueOnce({ id: "dup", status: "ACTIVE_PAID" }) // record 1 email dup
      .mockResolvedValueOnce(null) // record 2 email ok
      .mockResolvedValueOnce(null) // record 2 mobile ok
      .mockResolvedValueOnce(null); // record 2 auth lookup

    mockSupabaseAdmin.auth.admin.createUser.mockResolvedValue({
      data: { user: { id: "auth-2" } },
      error: null,
    });

    const res = await POST(makeReq({ societyCode: "EDEN", records: [validRecord, record2] }));
    const body = await res.json();
    expect(body.results).toHaveLength(2);
    expect(body.results[0].success).toBe(false);
    expect(body.results[1].success).toBe(true);
  });

  it("creates unit and userUnit when unitAddress is provided", async () => {
    const recordWithUnit = {
      ...validRecord,
      unitAddress: { flatNo: "A-101", towerBlock: "A", floorLevel: "FIRST" },
    };
    await POST(makeReq({ societyCode: "EDEN", records: [recordWithUnit] }));
    expect(mockPrisma.unit.create).toHaveBeenCalled();
    expect(mockPrisma.userUnit.create).toHaveBeenCalled();
  });

  it("does not create unit when unitAddress is not provided", async () => {
    await POST(makeReq({ societyCode: "EDEN", records: [validRecord] }));
    expect(mockPrisma.unit.create).not.toHaveBeenCalled();
    expect(mockPrisma.userUnit.create).not.toHaveBeenCalled();
  });

  it("RWAID sequence uses year-specific count", async () => {
    mockPrisma.user.count.mockResolvedValue(5); // 5 existing RWAIDs for that year
    const res = await POST(
      makeReq({ societyCode: "EDEN", records: [{ ...validRecord, registrationYear: 2022 }] }),
    );
    const body = await res.json();
    // sequence = 5 + 1 = 6, padded to 4 → 0006
    expect(body.results[0].rwaid).toContain("-2022-0006");
  });

  it("sends setup email after successfully creating a resident", async () => {
    await POST(makeReq({ societyCode: "EDEN", records: [validRecord] }));
    expect(mockGeneratePasswordResetToken).toHaveBeenCalledWith("new-r1", 168);
    expect(mockSendEmail).toHaveBeenCalledWith(
      validRecord.email,
      expect.stringContaining("Create your password"),
      expect.any(String),
    );
  });

  it("does not fail the row when setup email errors", async () => {
    mockSendEmail.mockRejectedValueOnce(new Error("SMTP down"));
    const res = await POST(makeReq({ societyCode: "EDEN", records: [validRecord] }));
    const body = await res.json();
    expect(body.results[0].success).toBe(true); // row still succeeds
  });

  it("returns 500 on unexpected server error", async () => {
    mockPrisma.society.findUnique.mockRejectedValue(new Error("DB down"));
    const res = await POST(makeReq({ societyCode: "EDEN", records: [validRecord] }));
    expect(res.status).toBe(500);
  });

  it("retries with incremented RWAID sequence on P2002 collision", async () => {
    // First transaction throws P2002 (RWAID unique constraint), second succeeds
    const p2002Error = Object.assign(new Error("Unique constraint failed"), { code: "P2002" });
    mockPrisma.$transaction
      .mockRejectedValueOnce(p2002Error)
      .mockImplementationOnce((cb: (tx: typeof mockPrisma) => Promise<unknown>) => cb(mockPrisma));

    const res = await POST(makeReq({ societyCode: "EDEN", records: [validRecord] }));
    const body = await res.json();
    expect(body.results[0].success).toBe(true);
    // Second attempt used count+2 → sequence 2
    expect(body.results[0].rwaid).toContain("-0002");
    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(2);
  });

  it("fails record gracefully after 3 P2002 retries exhausted", async () => {
    const p2002Error = Object.assign(new Error("Unique constraint failed"), { code: "P2002" });
    mockPrisma.$transaction.mockRejectedValue(p2002Error);

    const res = await POST(makeReq({ societyCode: "EDEN", records: [validRecord] }));
    const body = await res.json();
    expect(body.results[0].success).toBe(false);
    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(3);
  });

  it("cleans up orphaned Supabase auth user when DB transaction fails", async () => {
    // New auth user created but transaction fails (non-P2002 error)
    mockPrisma.$transaction.mockRejectedValue(new Error("DB connection lost"));

    const res = await POST(makeReq({ societyCode: "EDEN", records: [validRecord] }));
    const body = await res.json();
    expect(body.results[0].success).toBe(false);
    // Should have called deleteUser to clean up the orphaned auth account
    expect(mockSupabaseAdmin.auth.admin.deleteUser).toHaveBeenCalledWith("auth-uuid-1");
  });

  it("does not delete Supabase auth user when it was reused (not newly created)", async () => {
    // Third findFirst call returns existing auth account
    mockPrisma.user.findFirst
      .mockResolvedValueOnce(null) // no email dup
      .mockResolvedValueOnce(null) // no mobile dup
      .mockResolvedValueOnce({ authUserId: "existing-auth-id" }); // reused auth

    // Transaction fails
    mockPrisma.$transaction.mockRejectedValue(new Error("DB error"));

    const res = await POST(makeReq({ societyCode: "EDEN", records: [validRecord] }));
    const body = await res.json();
    expect(body.results[0].success).toBe(false);
    // Should NOT delete the reused auth account
    expect(mockSupabaseAdmin.auth.admin.deleteUser).not.toHaveBeenCalled();
  });
});
