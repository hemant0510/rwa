import { NextRequest } from "next/server";

import { beforeEach, describe, expect, it, vi } from "vitest";

import { mockPrisma } from "../../__mocks__/prisma";
import { mockSupabaseAdmin } from "../../__mocks__/supabase";

// Mock verification helpers
const { mockIsVerificationRequired, mockSendVerificationEmail, mockAutoVerifyUser } = vi.hoisted(
  () => ({
    mockIsVerificationRequired: vi.fn(),
    mockSendVerificationEmail: vi.fn(),
    mockAutoVerifyUser: vi.fn(),
  }),
);

vi.mock("@/lib/verification", () => ({
  isVerificationRequired: mockIsVerificationRequired,
  sendVerificationEmail: mockSendVerificationEmail,
  autoVerifyUser: mockAutoVerifyUser,
}));

import { POST } from "@/app/api/v1/societies/[id]/admins/route";

const SOCIETY_ID = "society-uuid-1";

function makeRequest(body: unknown) {
  return new NextRequest(`http://localhost/api/v1/societies/${SOCIETY_ID}/admins`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const mockSociety = { id: SOCIETY_ID, name: "Eden Estate" };

const mockCreatedUser = {
  id: "user-new-1",
  name: "Rajesh Kumar",
  email: "rajesh@eden.com",
  mobile: null,
  authUserId: "auth-new-1",
};

beforeEach(() => {
  vi.clearAllMocks();
  mockIsVerificationRequired.mockResolvedValue(false);
  mockAutoVerifyUser.mockResolvedValue(undefined);
  mockSendVerificationEmail.mockResolvedValue(undefined);
  mockSupabaseAdmin.auth.admin.createUser.mockResolvedValue({
    data: { user: { id: "auth-new-1" } },
    error: null,
  });
  mockSupabaseAdmin.auth.admin.deleteUser.mockResolvedValue({ error: null });
});

// ─── Validation ──────────────────────────────────────────────────────────────

describe("POST /api/v1/societies/[id]/admins — validation", () => {
  it("returns 422 for missing required fields", async () => {
    const res = await POST(makeRequest({}), { params: Promise.resolve({ id: SOCIETY_ID }) });
    expect(res.status).toBe(422);
  });

  it("returns 422 when creating new admin without password", async () => {
    const res = await POST(
      makeRequest({ name: "Test", email: "test@test.com", permission: "FULL_ACCESS" }),
      { params: Promise.resolve({ id: SOCIETY_ID }) },
    );
    expect(res.status).toBe(422);
  });

  it("returns 422 for invalid permission value", async () => {
    const res = await POST(
      makeRequest({
        name: "Test",
        email: "test@test.com",
        password: "pass1234",
        permission: "INVALID",
      }),
      { params: Promise.resolve({ id: SOCIETY_ID }) },
    );
    expect(res.status).toBe(422);
  });

  it("returns 422 for invalid email", async () => {
    const res = await POST(
      makeRequest({
        name: "Test",
        email: "not-an-email",
        password: "pass1234",
        permission: "FULL_ACCESS",
      }),
      { params: Promise.resolve({ id: SOCIETY_ID }) },
    );
    expect(res.status).toBe(422);
  });

  it("returns 422 for password shorter than 8 chars", async () => {
    const res = await POST(
      makeRequest({
        name: "Test",
        email: "test@test.com",
        password: "short",
        permission: "FULL_ACCESS",
      }),
      { params: Promise.resolve({ id: SOCIETY_ID }) },
    );
    expect(res.status).toBe(422);
  });
});

// ─── Society not found ────────────────────────────────────────────────────────

describe("POST /api/v1/societies/[id]/admins — society not found", () => {
  it("returns 404 when society does not exist", async () => {
    mockPrisma.society.findUnique.mockResolvedValue(null);

    const res = await POST(
      makeRequest({
        name: "Test",
        email: "test@test.com",
        password: "password1",
        permission: "FULL_ACCESS",
      }),
      { params: Promise.resolve({ id: SOCIETY_ID }) },
    );
    expect(res.status).toBe(404);
  });
});

// ─── Admin limit enforcement ──────────────────────────────────────────────────

describe("POST /api/v1/societies/[id]/admins — admin limit", () => {
  it("returns 409 when a primary admin already exists", async () => {
    mockPrisma.society.findUnique.mockResolvedValue(mockSociety);
    mockPrisma.adminTerm.findFirst.mockResolvedValue({ id: "term-1", position: "PRIMARY" });

    const res = await POST(
      makeRequest({
        name: "Test",
        email: "test@test.com",
        password: "password1",
        permission: "FULL_ACCESS",
      }),
      { params: Promise.resolve({ id: SOCIETY_ID }) },
    );
    const body = await res.json();
    expect(res.status).toBe(409);
    expect(body.error.code).toBe("ADMIN_LIMIT");
  });

  it("returns 409 when a supporting admin already exists", async () => {
    mockPrisma.society.findUnique.mockResolvedValue(mockSociety);
    mockPrisma.adminTerm.findFirst.mockResolvedValue({ id: "term-2", position: "SUPPORTING" });

    const res = await POST(
      makeRequest({
        name: "Test",
        email: "test@test.com",
        password: "password1",
        permission: "READ_NOTIFY",
      }),
      { params: Promise.resolve({ id: SOCIETY_ID }) },
    );
    expect(res.status).toBe(409);
  });
});

// ─── Path A: Upgrade existing resident ───────────────────────────────────────

describe("POST /api/v1/societies/[id]/admins — upgrade existing resident", () => {
  const existingUserId = "a1b2c3d4-e5f6-7890-abcd-ef1234567890";

  beforeEach(() => {
    mockPrisma.society.findUnique.mockResolvedValue(mockSociety);
    mockPrisma.adminTerm.findFirst.mockResolvedValue(null);
    mockPrisma.user.findFirst.mockResolvedValue({
      id: existingUserId,
      name: "Suresh Sharma",
      email: "suresh@eden.com",
      authUserId: "auth-existing-1",
    });
    mockPrisma.user.update.mockResolvedValue({});
    mockPrisma.adminTerm.create.mockResolvedValue({});
  });

  it("upgrades existing resident to primary admin successfully", async () => {
    const res = await POST(makeRequest({ permission: "FULL_ACCESS", existingUserId }), {
      params: Promise.resolve({ id: SOCIETY_ID }),
    });
    const body = await res.json();
    expect(res.status).toBe(201);
    expect(body.message).toContain("activated as primary admin");
  });

  it("upgrades existing resident to supporting admin", async () => {
    const res = await POST(makeRequest({ permission: "READ_NOTIFY", existingUserId }), {
      params: Promise.resolve({ id: SOCIETY_ID }),
    });
    const body = await res.json();
    expect(res.status).toBe(201);
    expect(body.message).toContain("supporting admin");
  });

  it("does not call Supabase createUser for existing resident", async () => {
    await POST(makeRequest({ permission: "FULL_ACCESS", existingUserId }), {
      params: Promise.resolve({ id: SOCIETY_ID }),
    });
    expect(mockSupabaseAdmin.auth.admin.createUser).not.toHaveBeenCalled();
  });

  it("updates user role and creates admin term in transaction", async () => {
    await POST(makeRequest({ permission: "FULL_ACCESS", existingUserId }), {
      params: Promise.resolve({ id: SOCIETY_ID }),
    });
    expect(mockPrisma.user.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: existingUserId },
        data: expect.objectContaining({ role: "RWA_ADMIN", adminPermission: "FULL_ACCESS" }),
      }),
    );
    expect(mockPrisma.adminTerm.create).toHaveBeenCalled();
  });

  it("returns 404 when existingUserId does not belong to society", async () => {
    mockPrisma.user.findFirst.mockResolvedValue(null);

    const res = await POST(makeRequest({ permission: "FULL_ACCESS", existingUserId }), {
      params: Promise.resolve({ id: SOCIETY_ID }),
    });
    expect(res.status).toBe(404);
  });
});

// ─── Path B: Create new admin ─────────────────────────────────────────────────

describe("POST /api/v1/societies/[id]/admins — create new admin", () => {
  const validPayload = {
    name: "Rajesh Kumar",
    email: "rajesh@eden.com",
    password: "securepass1",
    mobile: "9876543210",
    permission: "FULL_ACCESS",
  };

  beforeEach(() => {
    mockPrisma.society.findUnique.mockResolvedValue(mockSociety);
    mockPrisma.adminTerm.findFirst.mockResolvedValue(null);
    mockPrisma.user.create.mockResolvedValue(mockCreatedUser);
    mockPrisma.adminTerm.create.mockResolvedValue({});
  });

  it("creates new primary admin successfully", async () => {
    const res = await POST(makeRequest(validPayload), {
      params: Promise.resolve({ id: SOCIETY_ID }),
    });
    const body = await res.json();
    expect(res.status).toBe(201);
    expect(body.message).toContain("created and activated as primary admin");
  });

  it("creates new supporting admin successfully", async () => {
    const res = await POST(makeRequest({ ...validPayload, permission: "READ_NOTIFY" }), {
      params: Promise.resolve({ id: SOCIETY_ID }),
    });
    const body = await res.json();
    expect(res.status).toBe(201);
    expect(body.message).toContain("supporting admin");
  });

  it("calls supabase createUser with correct email and password", async () => {
    await POST(makeRequest(validPayload), { params: Promise.resolve({ id: SOCIETY_ID }) });
    expect(mockSupabaseAdmin.auth.admin.createUser).toHaveBeenCalledWith(
      expect.objectContaining({ email: validPayload.email, password: validPayload.password }),
    );
  });

  it("creates DB user with authUserId from Supabase", async () => {
    await POST(makeRequest(validPayload), { params: Promise.resolve({ id: SOCIETY_ID }) });
    expect(mockPrisma.user.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          authUserId: "auth-new-1",
          role: "RWA_ADMIN",
          adminPermission: "FULL_ACCESS",
          societyId: SOCIETY_ID,
        }),
      }),
    );
  });

  it("creates admin term record", async () => {
    await POST(makeRequest(validPayload), { params: Promise.resolve({ id: SOCIETY_ID }) });
    expect(mockPrisma.adminTerm.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          position: "PRIMARY",
          permission: "FULL_ACCESS",
          societyId: SOCIETY_ID,
        }),
      }),
    );
  });

  it("calls autoVerifyUser when verification is not required", async () => {
    mockIsVerificationRequired.mockResolvedValue(false);
    await POST(makeRequest(validPayload), { params: Promise.resolve({ id: SOCIETY_ID }) });
    expect(mockAutoVerifyUser).toHaveBeenCalledWith(mockCreatedUser.id);
    expect(mockSendVerificationEmail).not.toHaveBeenCalled();
  });

  it("sends verification email when required", async () => {
    mockIsVerificationRequired.mockResolvedValue(true);
    await POST(makeRequest(validPayload), { params: Promise.resolve({ id: SOCIETY_ID }) });
    expect(mockSendVerificationEmail).toHaveBeenCalledWith(
      mockCreatedUser.id,
      validPayload.email,
      validPayload.name,
    );
    expect(mockAutoVerifyUser).not.toHaveBeenCalled();
  });

  it("creates admin without mobile when mobile is omitted", async () => {
    const { mobile: _m, ...payloadWithoutMobile } = validPayload;
    const res = await POST(makeRequest(payloadWithoutMobile), {
      params: Promise.resolve({ id: SOCIETY_ID }),
    });
    expect(res.status).toBe(201);
    expect(mockPrisma.user.create).toHaveBeenCalled();
  });

  it("deletes Supabase auth user if DB transaction fails", async () => {
    mockPrisma.user.create.mockRejectedValue(new Error("DB error"));

    const res = await POST(makeRequest(validPayload), {
      params: Promise.resolve({ id: SOCIETY_ID }),
    });
    expect(res.status).toBe(500);
    expect(mockSupabaseAdmin.auth.admin.deleteUser).toHaveBeenCalledWith("auth-new-1");
  });

  it("returns 400 when Supabase auth creation fails", async () => {
    mockSupabaseAdmin.auth.admin.createUser.mockResolvedValue({
      data: null,
      error: { message: "Email already registered" },
    });

    const res = await POST(makeRequest(validPayload), {
      params: Promise.resolve({ id: SOCIETY_ID }),
    });
    const body = await res.json();
    expect(res.status).toBe(400);
    expect(body.error.code).toBe("AUTH_ERROR");
  });
});
