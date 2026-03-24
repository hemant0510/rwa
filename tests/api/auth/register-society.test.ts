import { NextRequest } from "next/server";

import { describe, it, expect, vi, beforeEach } from "vitest";

const mockPrisma = vi.hoisted(() => ({
  society: { findUnique: vi.fn(), count: vi.fn(), create: vi.fn() },
  platformPlan: { findUnique: vi.fn() },
  user: { create: vi.fn() },
  adminTerm: { create: vi.fn() },
  societySubscription: { create: vi.fn() },
  $transaction: vi.fn(),
}));

const mockSupabaseAdmin = vi.hoisted(() => ({
  auth: {
    admin: {
      createUser: vi.fn(),
      deleteUser: vi.fn(),
    },
  },
}));

const mockCheckRateLimit = vi.hoisted(() => vi.fn());
const mockIsVerificationRequired = vi.hoisted(() => vi.fn());
const mockSendVerificationEmail = vi.hoisted(() => vi.fn());
const mockAutoVerifyUser = vi.hoisted(() => vi.fn());
const mockGenerateSocietyId = vi.hoisted(() => vi.fn());

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/supabase/admin", () => ({ createAdminClient: () => mockSupabaseAdmin }));
vi.mock("@/lib/rate-limit", () => ({ checkRateLimit: mockCheckRateLimit }));
vi.mock("@/lib/verification", () => ({
  isVerificationRequired: mockIsVerificationRequired,
  sendVerificationEmail: mockSendVerificationEmail,
  autoVerifyUser: mockAutoVerifyUser,
}));
vi.mock("@/lib/fee-calculator", () => ({ generateSocietyId: mockGenerateSocietyId }));

import { POST } from "@/app/api/v1/auth/register-society/route";

const VALID_BODY = {
  name: "Eden Estate RWA",
  state: "HR",
  city: "Gurugram",
  pincode: "122001",
  type: "APARTMENT_COMPLEX",
  societyCode: "EDEN",
  adminName: "Hemant Bhagat",
  adminEmail: "hemant@example.com",
  adminPassword: "password123",
  adminPasswordConfirm: "password123",
};

function makeReq(body: unknown) {
  return new NextRequest("http://localhost/api/v1/auth/register-society", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-forwarded-for": "127.0.0.1" },
    body: JSON.stringify(body),
  });
}

const MOCK_SOCIETY = {
  id: "society-uuid",
  societyId: "HR-GRG-122001-001",
  societyCode: "EDEN",
  name: "Eden Estate RWA",
};
const MOCK_ADMIN = { id: "admin-uuid", name: "Hemant Bhagat" };
const MOCK_AUTH_USER = { id: "auth-uuid", email: "hemant@example.com" };

describe("POST /api/v1/auth/register-society", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCheckRateLimit.mockReturnValue({ allowed: true });
    mockPrisma.society.findUnique.mockResolvedValue(null); // code not taken
    mockPrisma.society.count.mockResolvedValue(0);
    mockPrisma.platformPlan.findUnique.mockResolvedValue(null);
    mockSupabaseAdmin.auth.admin.createUser.mockResolvedValue({
      data: { user: MOCK_AUTH_USER },
      error: null,
    });
    mockGenerateSocietyId.mockReturnValue("HR-GRG-122001-001");
    mockPrisma.$transaction.mockImplementation(
      async (fn: (tx: typeof mockPrisma) => Promise<unknown>) => fn(mockPrisma),
    );
    mockPrisma.society.create.mockResolvedValue(MOCK_SOCIETY);
    mockPrisma.user.create.mockResolvedValue(MOCK_ADMIN);
    mockPrisma.adminTerm.create.mockResolvedValue({});
    mockPrisma.societySubscription.create = vi.fn().mockResolvedValue({});
    mockIsVerificationRequired.mockResolvedValue(false);
    mockAutoVerifyUser.mockResolvedValue(undefined);
  });

  // ── Validation ──────────────────────────────────────────────────────────────

  it("returns 422 for missing name", async () => {
    const { name: _n, ...body } = VALID_BODY;
    const res = await POST(makeReq(body));
    expect(res.status).toBe(422);
  });

  it("returns 422 for invalid pincode", async () => {
    const res = await POST(makeReq({ ...VALID_BODY, pincode: "1234" }));
    expect(res.status).toBe(422);
  });

  it("returns 422 for mismatched passwords", async () => {
    const res = await POST(makeReq({ ...VALID_BODY, adminPasswordConfirm: "different" }));
    expect(res.status).toBe(422);
  });

  it("returns 422 for invalid registrationDate format", async () => {
    const res = await POST(makeReq({ ...VALID_BODY, registrationDate: "15/04/2019" }));
    expect(res.status).toBe(422);
  });

  it("returns 422 for invalid selectedPlanId (not a UUID)", async () => {
    const res = await POST(makeReq({ ...VALID_BODY, selectedPlanId: "not-a-uuid" }));
    expect(res.status).toBe(422);
  });

  // ── Rate limit ──────────────────────────────────────────────────────────────

  it("returns 429 when rate limited", async () => {
    mockCheckRateLimit.mockReturnValue({ allowed: false });
    const res = await POST(makeReq(VALID_BODY));
    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.error.code).toBe("RATE_LIMIT_EXCEEDED");
  });

  // ── IP header fallbacks ─────────────────────────────────────────────────────

  it("accepts request with x-real-ip header (no x-forwarded-for)", async () => {
    const req = new NextRequest("http://localhost/api/v1/auth/register-society", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-real-ip": "10.0.0.1" },
      body: JSON.stringify(VALID_BODY),
    });
    const res = await POST(req);
    expect(res.status).toBe(201);
  });

  it("accepts request with no IP headers (falls back to 'unknown')", async () => {
    const req = new NextRequest("http://localhost/api/v1/auth/register-society", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(VALID_BODY),
    });
    const res = await POST(req);
    expect(res.status).toBe(201);
  });

  // ── Society code uniqueness ─────────────────────────────────────────────────

  it("returns 409 when society code is already taken", async () => {
    mockPrisma.society.findUnique.mockResolvedValue({ id: "other-society" });
    const res = await POST(makeReq(VALID_BODY));
    expect(res.status).toBe(409);
    const body = await res.json();
    expect(body.error.code).toBe("DUPLICATE_CODE");
  });

  // ── Plan validation ─────────────────────────────────────────────────────────

  it("returns 400 when selectedPlanId refers to non-existent plan", async () => {
    mockPrisma.platformPlan.findUnique.mockResolvedValue(null);
    const res = await POST(
      makeReq({ ...VALID_BODY, selectedPlanId: "550e8400-e29b-41d4-a716-446655440000" }),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("INVALID_PLAN");
  });

  it("accepts a valid selectedPlanId and passes plan validation", async () => {
    const planId = "550e8400-e29b-41d4-a716-446655440000";
    mockPrisma.platformPlan.findUnique.mockResolvedValue({ id: planId, name: "Basic" });

    const res = await POST(makeReq({ ...VALID_BODY, selectedPlanId: planId }));
    expect(res.status).toBe(201);
  });

  // ── Auth user creation ──────────────────────────────────────────────────────

  it("returns 400 when Supabase auth user creation fails", async () => {
    mockSupabaseAdmin.auth.admin.createUser.mockResolvedValue({
      data: null,
      error: { message: "Email already registered" },
    });
    const res = await POST(makeReq(VALID_BODY));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("AUTH_ERROR");
  });

  // ── Successful registration ─────────────────────────────────────────────────

  it("returns 201 with society data on success", async () => {
    const res = await POST(makeReq(VALID_BODY));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.society).toBeDefined();
  });

  it("creates SocietySubscription inside transaction", async () => {
    await POST(makeReq(VALID_BODY));
    expect(mockPrisma.societySubscription.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "TRIAL" }),
      }),
    );
  });

  it("creates SocietySubscription with planId when plan is selected", async () => {
    const planId = "550e8400-e29b-41d4-a716-446655440000";
    mockPrisma.platformPlan.findUnique.mockResolvedValue({ id: planId });

    await POST(makeReq({ ...VALID_BODY, selectedPlanId: planId }));

    expect(mockPrisma.societySubscription.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ planId }),
      }),
    );
  });

  it("creates SocietySubscription with planId null when no plan selected", async () => {
    await POST(makeReq(VALID_BODY));
    expect(mockPrisma.societySubscription.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ planId: null }),
      }),
    );
  });

  it("saves registrationNo and registrationDate to society", async () => {
    await POST(
      makeReq({
        ...VALID_BODY,
        registrationNo: "DL/RWA/2019/0042",
        registrationDate: "2019-04-15",
      }),
    );

    expect(mockPrisma.society.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          registrationNo: "DL/RWA/2019/0042",
          registrationDate: new Date("2019-04-15"),
        }),
      }),
    );
  });

  it("saves null for registrationNo and registrationDate when not provided", async () => {
    await POST(makeReq(VALID_BODY));
    expect(mockPrisma.society.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          registrationNo: null,
          registrationDate: null,
        }),
      }),
    );
  });

  // ── Email verification ──────────────────────────────────────────────────────

  it("returns requiresVerification=true and calls sendVerificationEmail", async () => {
    mockIsVerificationRequired.mockResolvedValue(true);
    mockSendVerificationEmail.mockResolvedValue(undefined);

    const res = await POST(makeReq(VALID_BODY));
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body.requiresVerification).toBe(true);
    expect(mockSendVerificationEmail).toHaveBeenCalledOnce();
  });

  it("calls autoVerifyUser when verification is not required", async () => {
    mockIsVerificationRequired.mockResolvedValue(false);

    await POST(makeReq(VALID_BODY));

    expect(mockAutoVerifyUser).toHaveBeenCalledOnce();
    expect(mockSendVerificationEmail).not.toHaveBeenCalled();
  });

  // ── Transaction rollback ────────────────────────────────────────────────────

  it("deletes Supabase auth user when transaction fails", async () => {
    mockPrisma.$transaction.mockRejectedValue(new Error("DB error"));

    const res = await POST(makeReq(VALID_BODY));

    expect(res.status).toBe(500);
    expect(mockSupabaseAdmin.auth.admin.deleteUser).toHaveBeenCalledWith(MOCK_AUTH_USER.id);
  });
});
