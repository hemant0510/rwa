import { NextRequest } from "next/server";

import { describe, it, expect, vi, beforeEach } from "vitest";

import { mockPrisma } from "../../__mocks__/prisma";

const { mockIsEmailConfigured, mockSendVerificationEmail, mockGetFullAccessAdmin } = vi.hoisted(
  () => ({
    mockIsEmailConfigured: vi.fn(),
    mockSendVerificationEmail: vi.fn(),
    mockGetFullAccessAdmin: vi.fn(),
  }),
);

vi.mock("@/lib/email", () => ({
  isEmailConfigured: mockIsEmailConfigured,
}));

vi.mock("@/lib/verification", () => ({
  sendVerificationEmail: mockSendVerificationEmail,
}));

vi.mock("@/lib/get-current-user", () => ({
  getFullAccessAdmin: mockGetFullAccessAdmin,
}));

import { POST } from "@/app/api/v1/residents/[id]/send-verification/route";

function makeReq(id: string) {
  return new NextRequest(`http://localhost/api/v1/residents/${id}/send-verification`, {
    method: "POST",
  });
}

const mockResident = {
  id: "r1",
  name: "John Doe",
  email: "john@example.com",
  isEmailVerified: false,
  role: "RESIDENT",
};

const mockAdmin = {
  userId: "admin-1",
  authUserId: "auth-admin-1",
  societyId: "soc-1",
  role: "RWA_ADMIN" as const,
  adminPermission: "FULL_ACCESS" as const,
};

describe("POST /api/v1/residents/[id]/send-verification", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetFullAccessAdmin.mockResolvedValue(mockAdmin);
    mockIsEmailConfigured.mockReturnValue(true);
    mockSendVerificationEmail.mockResolvedValue(undefined);
  });

  it("returns 401 when not authenticated", async () => {
    mockGetFullAccessAdmin.mockResolvedValue(null);
    const res = await POST(makeReq("r1"), { params: Promise.resolve({ id: "r1" }) });
    expect(res.status).toBe(401);
  });

  it("returns 503 when email is not configured", async () => {
    mockIsEmailConfigured.mockReturnValue(false);
    const res = await POST(makeReq("r1"), { params: Promise.resolve({ id: "r1" }) });
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.error.code).toBe("EMAIL_NOT_CONFIGURED");
  });

  it("returns 404 when resident not found", async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);
    const res = await POST(makeReq("r1"), { params: Promise.resolve({ id: "r1" }) });
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error.code).toBe("NOT_FOUND");
  });

  it("returns 404 when user is not a RESIDENT", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ ...mockResident, role: "RWA_ADMIN" });
    const res = await POST(makeReq("r1"), { params: Promise.resolve({ id: "r1" }) });
    expect(res.status).toBe(404);
  });

  it("returns 400 when email is already verified", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ ...mockResident, isEmailVerified: true });
    const res = await POST(makeReq("r1"), { params: Promise.resolve({ id: "r1" }) });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe("ALREADY_VERIFIED");
  });

  it("sends verification email and returns success", async () => {
    mockPrisma.user.findUnique.mockResolvedValue(mockResident);
    const res = await POST(makeReq("r1"), { params: Promise.resolve({ id: "r1" }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(mockSendVerificationEmail).toHaveBeenCalledWith("r1", "john@example.com", "John Doe");
  });

  it("does NOT check cooldown (admin bypass)", async () => {
    mockPrisma.user.findUnique.mockResolvedValue(mockResident);
    await POST(makeReq("r1"), { params: Promise.resolve({ id: "r1" }) });
    // emailVerificationToken is not queried — admin bypasses cooldown
    expect(mockPrisma.emailVerificationToken.findUnique).not.toHaveBeenCalled();
  });

  it("returns 500 on unexpected error", async () => {
    mockPrisma.user.findUnique.mockRejectedValue(new Error("DB error"));
    const res = await POST(makeReq("r1"), { params: Promise.resolve({ id: "r1" }) });
    expect(res.status).toBe(500);
  });
});
