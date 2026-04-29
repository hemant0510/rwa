import { NextRequest } from "next/server";

import { describe, it, expect, vi, beforeEach } from "vitest";

// All mocks declared with vi.hoisted so they're available before imports
const mockCreateUser = vi.hoisted(() => vi.fn());
const mockGeneratePasswordResetToken = vi.hoisted(() => vi.fn());
const mockSendEmail = vi.hoisted(() => vi.fn());
const mockGetCurrentUser = vi.hoisted(() => vi.fn());
const mockCreateAdminClient = vi.hoisted(() => vi.fn());

const mockPrisma = vi.hoisted(() => {
  const db = {
    society: { findUnique: vi.fn() },
    user: {
      findFirst: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
    },
    unit: { create: vi.fn() },
    userUnit: { create: vi.fn() },
    membershipFee: { create: vi.fn() },
    $transaction: vi.fn(),
  };
  db.$transaction.mockImplementation(async (cb: (tx: typeof db) => Promise<unknown>) => cb(db));
  return db;
});

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/get-current-user", () => ({ getCurrentUser: mockGetCurrentUser }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: mockCreateAdminClient }));
vi.mock("@/lib/tokens", () => ({ generatePasswordResetToken: mockGeneratePasswordResetToken }));
vi.mock("@/lib/email", () => ({ sendEmail: mockSendEmail }));
vi.mock("@/lib/email-templates/welcome-setup", () => ({
  getWelcomeSetupEmailHtml: vi.fn(() => "<html>welcome</html>"),
}));
vi.mock("@/lib/constants", () => ({
  ACCOUNT_SETUP_TOKEN_EXPIRY_HOURS: 24,
  APP_URL: "http://localhost:3000",
}));

import { POST } from "@/app/api/v1/societies/[id]/migration/import/route";

const mockSupabaseAdmin = {
  auth: { admin: { createUser: mockCreateUser } },
};

function makeReq(body: unknown) {
  return new NextRequest("http://localhost/api/v1/societies/soc-1/migration/import", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

function makeParams(id = "soc-1") {
  return { params: Promise.resolve({ id }) };
}

const mockSociety = {
  id: "soc-1",
  societyId: "RWA-DL-EDN-110001-0001",
  name: "Greenwood Residency",
  type: "APARTMENT_COMPLEX",
  annualFee: 2400,
  feeSessionStartMonth: 4,
};

const validRecord = {
  fullName: "John Doe",
  email: "john@example.com",
  mobile: "9876543210",
  ownershipType: "OWNER",
  feeStatus: "PAID",
  unitFields: { towerBlock: "A", floorNo: "3", flatNo: "301" },
};

describe("POST /api/v1/societies/[id]/migration/import", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Re-setup $transaction after clearAllMocks
    mockPrisma.$transaction.mockImplementation(
      async (cb: (tx: typeof mockPrisma) => Promise<unknown>) => cb(mockPrisma),
    );
    mockGetCurrentUser.mockResolvedValue({
      userId: "admin-1",
      societyId: "soc-1",
      role: "RWA_ADMIN",
    });
    mockPrisma.society.findUnique.mockResolvedValue(mockSociety);
    mockPrisma.user.findFirst.mockResolvedValue(null);
    mockPrisma.user.count.mockResolvedValue(0);
    mockPrisma.user.create.mockResolvedValue({ id: "user-1" });
    mockPrisma.unit.create.mockResolvedValue({ id: "unit-1" });
    mockPrisma.userUnit.create.mockResolvedValue({ id: "uu-1" });
    mockPrisma.membershipFee.create.mockResolvedValue({ id: "fee-1" });
    mockCreateAdminClient.mockReturnValue(mockSupabaseAdmin);
    mockCreateUser.mockResolvedValue({ data: { user: { id: "auth-user-1" } }, error: null });
    mockGeneratePasswordResetToken.mockResolvedValue("token-123");
    mockSendEmail.mockResolvedValue(undefined);
  });

  it("returns 401 when not authenticated", async () => {
    mockGetCurrentUser.mockResolvedValue(null);
    const res = await POST(makeReq({ records: [validRecord] }), makeParams());
    expect(res.status).toBe(401);
  });

  it("returns 401 when society mismatch", async () => {
    mockGetCurrentUser.mockResolvedValue({
      userId: "admin-1",
      societyId: "other-soc",
      role: "RWA_ADMIN",
    });
    const res = await POST(makeReq({ records: [validRecord] }), makeParams());
    expect(res.status).toBe(401);
  });

  it("returns 422 when body is invalid", async () => {
    const res = await POST(makeReq({ records: [] }), makeParams());
    expect(res.status).toBe(422);
  });

  it("returns 404 when society not found", async () => {
    mockPrisma.society.findUnique.mockResolvedValue(null);
    const res = await POST(makeReq({ records: [validRecord] }), makeParams());
    expect(res.status).toBe(404);
  });

  it("imports a valid record successfully", async () => {
    const res = await POST(makeReq({ records: [validRecord] }), makeParams());
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.summary.imported).toBe(1);
    expect(body.results[0].success).toBe(true);
  });

  it("imports a PENDING fee record", async () => {
    const record = { ...validRecord, feeStatus: "PENDING" };
    const res = await POST(makeReq({ records: [record] }), makeParams());
    const body = await res.json();
    expect(body.summary.imported).toBe(1);
    expect(mockPrisma.membershipFee.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "PENDING" }),
      }),
    );
  });

  it("marks user status as ACTIVE_PAID when fee is PAID", async () => {
    const res = await POST(makeReq({ records: [validRecord] }), makeParams());
    await res.json();
    expect(mockPrisma.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "ACTIVE_PAID" }),
      }),
    );
  });

  it("marks user status as MIGRATED_PENDING when fee is PENDING", async () => {
    const record = { ...validRecord, feeStatus: "PENDING" };
    const res = await POST(makeReq({ records: [record] }), makeParams());
    await res.json();
    expect(mockPrisma.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "MIGRATED_PENDING" }),
      }),
    );
  });

  it("reuses existing auth user when email already has an authUserId", async () => {
    mockPrisma.user.findFirst
      .mockResolvedValueOnce(null) // email check
      .mockResolvedValueOnce(null) // mobile check
      .mockResolvedValueOnce({ authUserId: "existing-auth-id" }); // existing auth user
    const res = await POST(makeReq({ records: [validRecord] }), makeParams());
    const body = await res.json();
    expect(body.results[0].success).toBe(true);
    expect(mockSupabaseAdmin.auth.admin.createUser).not.toHaveBeenCalled();
  });

  it("returns error row when email already exists in society", async () => {
    mockPrisma.user.findFirst.mockResolvedValueOnce({ id: "u1", status: "ACTIVE_PAID" });
    const res = await POST(makeReq({ records: [validRecord] }), makeParams());
    const body = await res.json();
    expect(body.results[0].success).toBe(false);
    expect(body.results[0].error).toContain("Email already exists");
  });

  it("returns error row when mobile already exists in society", async () => {
    mockPrisma.user.findFirst
      .mockResolvedValueOnce(null) // email check passes
      .mockResolvedValueOnce({ id: "u1", status: "ACTIVE_PAID" }); // mobile check
    const res = await POST(makeReq({ records: [validRecord] }), makeParams());
    const body = await res.json();
    expect(body.results[0].success).toBe(false);
  });

  it("returns error row when supabase auth fails", async () => {
    mockCreateUser.mockResolvedValue({
      data: null,
      error: { message: "Auth error" },
    });
    const res = await POST(makeReq({ records: [validRecord] }), makeParams());
    const body = await res.json();
    expect(body.results[0].success).toBe(false);
    expect(body.results[0].error).toContain("Auth account error");
  });

  it("creates unit when unitFields are provided", async () => {
    const res = await POST(makeReq({ records: [validRecord] }), makeParams());
    await res.json();
    expect(mockPrisma.unit.create).toHaveBeenCalled();
    expect(mockPrisma.userUnit.create).toHaveBeenCalled();
  });

  it("skips unit creation when no unitFields", async () => {
    const record = { ...validRecord, unitFields: {} };
    const res = await POST(makeReq({ records: [record] }), makeParams());
    await res.json();
    expect(mockPrisma.unit.create).not.toHaveBeenCalled();
  });

  it("does not create membership fee when annualFee is 0", async () => {
    mockPrisma.society.findUnique.mockResolvedValue({ ...mockSociety, annualFee: 0 });
    const res = await POST(makeReq({ records: [validRecord] }), makeParams());
    await res.json();
    expect(mockPrisma.membershipFee.create).not.toHaveBeenCalled();
  });

  it("handles email send failure gracefully", async () => {
    mockSendEmail.mockRejectedValue(new Error("SMTP error"));
    const res = await POST(makeReq({ records: [validRecord] }), makeParams());
    const body = await res.json();
    expect(body.results[0].success).toBe(true); // email failure doesn't fail the row
  });

  it("processes multiple records and reports summary", async () => {
    const records = [
      validRecord,
      { ...validRecord, email: "jane@example.com", mobile: "9876543211" },
    ];
    const res = await POST(makeReq({ records }), makeParams());
    const body = await res.json();
    expect(body.summary.total).toBe(2);
    expect(body.summary.imported).toBe(2);
  });
});
