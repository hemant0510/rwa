import { describe, it, expect, vi, beforeEach } from "vitest";

const mockGetSessionYear = vi.hoisted(() => vi.fn());
const mockGetSessionDates = vi.hoisted(() => vi.fn());
const mockGenerateRWAID = vi.hoisted(() => vi.fn());
const mockGenerateUnitDisplayLabel = vi.hoisted(() => vi.fn());
const mockGeneratePasswordResetToken = vi.hoisted(() => vi.fn());
const mockSendEmail = vi.hoisted(() => vi.fn());

const mockPrisma = vi.hoisted(() => {
  const db = {
    user: { findFirst: vi.fn(), count: vi.fn() },
    unit: { create: vi.fn() },
    userUnit: { create: vi.fn() },
    membershipFee: { create: vi.fn() },
    $transaction: vi.fn(),
  };
  db.$transaction.mockImplementation(async (cb: (tx: typeof db) => Promise<unknown>) => cb(db));
  return db;
});

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/fee-calculator", () => ({
  getSessionYear: mockGetSessionYear,
  getSessionDates: mockGetSessionDates,
  generateRWAID: mockGenerateRWAID,
  generateUnitDisplayLabel: mockGenerateUnitDisplayLabel,
}));
vi.mock("@/lib/tokens", () => ({ generatePasswordResetToken: mockGeneratePasswordResetToken }));
vi.mock("@/lib/email", () => ({ sendEmail: mockSendEmail }));
vi.mock("@/lib/email-templates/welcome-setup", () => ({
  getWelcomeSetupEmailHtml: vi.fn(() => "<html>welcome</html>"),
}));
vi.mock("@/lib/constants", () => ({
  ACCOUNT_SETUP_TOKEN_EXPIRY_HOURS: 24,
  APP_URL: "http://localhost:3000",
}));

import { buildSocietyContext, processSingleRecord } from "@/lib/migration-processor";

const mockCreateUser = vi.fn();
const mockSupabaseAdmin = {
  auth: { admin: { createUser: mockCreateUser } },
};

const mockSocietyRaw = {
  id: "soc-id-1",
  societyId: "RWA-DL-EDN-110001-0001",
  name: "Eden Estate",
  type: "APARTMENT_COMPLEX",
  annualFee: 2400,
  feeSessionStartMonth: 4,
};

const sessionStart = new Date("2025-04-01");
const sessionEnd = new Date("2026-03-31");

function setupFeeCalculatorMocks() {
  mockGetSessionYear.mockReturnValue("2025-26");
  mockGetSessionDates.mockReturnValue({ start: sessionStart, end: sessionEnd });
  mockGenerateRWAID.mockReturnValue("RWA-DL-EDN-110001-0001-2025-001");
  mockGenerateUnitDisplayLabel.mockReturnValue("Tower A, Floor 3, Flat 301");
}

const validRecord = {
  fullName: "John Doe",
  email: "john@example.com",
  mobile: "9876543210",
  ownershipType: "OWNER" as const,
  feeStatus: "PAID" as const,
  unitFields: { towerBlock: "A", floorNo: "3", flatNo: "301" },
};

describe("buildSocietyContext", () => {
  beforeEach(() => {
    setupFeeCalculatorMocks();
  });

  it("builds context from society with numeric annualFee", () => {
    const ctx = buildSocietyContext(mockSocietyRaw);
    expect(ctx.id).toBe("soc-id-1");
    expect(ctx.societyId).toBe("RWA-DL-EDN-110001-0001");
    expect(ctx.name).toBe("Eden Estate");
    expect(ctx.type).toBe("APARTMENT_COMPLEX");
    expect(ctx.annualFee).toBe(2400);
    expect(ctx.sessionYear).toBe("2025-26");
    expect(ctx.sessionStart).toBe(sessionStart);
    expect(ctx.sessionEnd).toBe(sessionEnd);
  });

  it("uses feeSessionStartMonth 4 when not provided", () => {
    const ctx = buildSocietyContext({ ...mockSocietyRaw, feeSessionStartMonth: null });
    expect(mockGetSessionYear).toHaveBeenCalledWith(expect.any(Date), 4);
    expect(ctx.annualFee).toBe(2400);
  });

  it("uses custom feeSessionStartMonth", () => {
    buildSocietyContext({ ...mockSocietyRaw, feeSessionStartMonth: 7 });
    expect(mockGetSessionYear).toHaveBeenCalledWith(expect.any(Date), 7);
  });

  it("uses 0 for annualFee when null", () => {
    const ctx = buildSocietyContext({ ...mockSocietyRaw, annualFee: null });
    expect(ctx.annualFee).toBe(0);
  });

  it("handles Decimal-like objects with toNumber()", () => {
    const decimalLike = { toNumber: () => 1500, toString: () => "1500" };
    const ctx = buildSocietyContext({ ...mockSocietyRaw, annualFee: decimalLike });
    expect(ctx.annualFee).toBe(1500);
  });
});

describe("processSingleRecord", () => {
  let ctx: ReturnType<typeof buildSocietyContext>;

  beforeEach(() => {
    vi.clearAllMocks();
    setupFeeCalculatorMocks();
    ctx = buildSocietyContext(mockSocietyRaw);

    // Default: no duplicates
    mockPrisma.user.findFirst.mockResolvedValue(null);
    mockPrisma.user.count.mockResolvedValue(0);

    // Default: create user in transaction
    mockPrisma.$transaction.mockImplementation(
      async (cb: (tx: typeof mockPrisma) => Promise<unknown>) => cb(mockPrisma),
    );
    mockPrisma.unit.create.mockResolvedValue({ id: "unit-1" });
    mockPrisma.userUnit.create.mockResolvedValue({});
    mockPrisma.membershipFee.create.mockResolvedValue({});

    // Auth: create user
    mockCreateUser.mockResolvedValue({
      data: { user: { id: "auth-user-1" } },
      error: null,
    });

    // Default prisma.user.create returns a user with id
    const mockTx = {
      user: { create: vi.fn().mockResolvedValue({ id: "user-db-1" }) },
      unit: { create: vi.fn().mockResolvedValue({ id: "unit-1" }) },
      userUnit: { create: vi.fn().mockResolvedValue({}) },
      membershipFee: { create: vi.fn().mockResolvedValue({}) },
    };
    mockPrisma.$transaction.mockImplementation(
      async (cb: (tx: typeof mockTx) => Promise<unknown>) => cb(mockTx),
    );

    mockGeneratePasswordResetToken.mockResolvedValue("setup-token-123");
    mockSendEmail.mockResolvedValue(undefined);
  });

  it("returns success with rwaid for valid record", async () => {
    const result = await processSingleRecord(validRecord, 0, ctx, mockSupabaseAdmin as never);
    expect(result.success).toBe(true);
    expect(result.rwaid).toBe("RWA-DL-EDN-110001-0001-2025-001");
    expect(result.rowIndex).toBe(0);
  });

  it("returns error when email already exists with blocking status", async () => {
    mockPrisma.user.findFirst.mockResolvedValueOnce({ id: "u1", status: "ACTIVE_PAID" });
    const result = await processSingleRecord(validRecord, 1, ctx, mockSupabaseAdmin as never);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/email already exists/i);
  });

  it("returns error when mobile already exists with blocking status", async () => {
    // First call (email check) returns null, second (mobile check) returns blocking
    mockPrisma.user.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: "u2", status: "DORMANT" });
    const result = await processSingleRecord(validRecord, 2, ctx, mockSupabaseAdmin as never);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/mobile already registered/i);
  });

  it("allows re-import when existing user has non-blocking status REJECTED", async () => {
    mockPrisma.user.findFirst.mockResolvedValueOnce({ id: "u3", status: "REJECTED" });
    const result = await processSingleRecord(validRecord, 3, ctx, mockSupabaseAdmin as never);
    expect(result.success).toBe(true);
  });

  it("reuses existing authUserId when user already has auth account", async () => {
    mockPrisma.user.findFirst
      .mockResolvedValueOnce(null) // email duplicate check
      .mockResolvedValueOnce(null) // mobile duplicate check
      .mockResolvedValueOnce({ authUserId: "existing-auth-id" }); // existing auth check

    const result = await processSingleRecord(validRecord, 0, ctx, mockSupabaseAdmin as never);
    expect(mockCreateUser).not.toHaveBeenCalled();
    expect(result.success).toBe(true);
  });

  it("returns error when supabase auth.admin.createUser fails", async () => {
    mockCreateUser.mockResolvedValue({
      data: { user: null },
      error: { message: "Auth creation failed" },
    });

    const result = await processSingleRecord(validRecord, 0, ctx, mockSupabaseAdmin as never);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/auth account error/i);
  });

  it("handles record with no unitFields (null display label)", async () => {
    const recordNoUnit = { ...validRecord, unitFields: {} };
    const result = await processSingleRecord(recordNoUnit, 0, ctx, mockSupabaseAdmin as never);
    expect(result.success).toBe(true);
  });

  it("handles TENANT ownership type", async () => {
    const tenantRecord = { ...validRecord, ownershipType: "TENANT" as const };
    const result = await processSingleRecord(tenantRecord, 0, ctx, mockSupabaseAdmin as never);
    expect(result.success).toBe(true);
  });

  it("handles PENDING feeStatus", async () => {
    const pendingRecord = { ...validRecord, feeStatus: "PENDING" as const };
    const result = await processSingleRecord(pendingRecord, 0, ctx, mockSupabaseAdmin as never);
    expect(result.success).toBe(true);
  });

  it("continues gracefully when email sending fails", async () => {
    mockSendEmail.mockRejectedValue(new Error("SMTP error"));
    const result = await processSingleRecord(validRecord, 0, ctx, mockSupabaseAdmin as never);
    // Email failure is non-fatal
    expect(result.success).toBe(true);
  });

  it("skips fee creation when annualFee is 0", async () => {
    const ctxNoFee = { ...ctx, annualFee: 0 };
    const mockTxNoFee = {
      user: { create: vi.fn().mockResolvedValue({ id: "user-db-1" }) },
      unit: { create: vi.fn().mockResolvedValue({ id: "unit-1" }) },
      userUnit: { create: vi.fn().mockResolvedValue({}) },
      membershipFee: { create: vi.fn() },
    };
    mockPrisma.$transaction.mockImplementationOnce(
      async (cb: (tx: typeof mockTxNoFee) => Promise<unknown>) => cb(mockTxNoFee),
    );

    const result = await processSingleRecord(validRecord, 0, ctxNoFee, mockSupabaseAdmin as never);
    expect(result.success).toBe(true);
    expect(mockTxNoFee.membershipFee.create).not.toHaveBeenCalled();
  });

  it("returns error on unexpected transaction failure", async () => {
    mockPrisma.$transaction.mockRejectedValueOnce(new Error("DB connection lost"));
    const result = await processSingleRecord(validRecord, 0, ctx, mockSupabaseAdmin as never);
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/failed to create resident/i);
  });

  it("handles generateUnitDisplayLabel returning empty string", async () => {
    mockGenerateUnitDisplayLabel.mockReturnValue("");
    const result = await processSingleRecord(validRecord, 0, ctx, mockSupabaseAdmin as never);
    expect(result.success).toBe(true);
  });
});
