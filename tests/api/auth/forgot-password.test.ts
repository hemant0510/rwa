import { NextRequest } from "next/server";

import { describe, it, expect, vi, beforeEach } from "vitest";

const mockPrisma = vi.hoisted(() => ({
  user: { findFirst: vi.fn() },
  passwordResetToken: { findFirst: vi.fn() },
}));

const mockCheckRateLimit = vi.hoisted(() => vi.fn());
const mockGenerateToken = vi.hoisted(() => vi.fn().mockResolvedValue("tok-abc"));
const mockSendEmail = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/rate-limit", () => ({ checkRateLimit: mockCheckRateLimit }));
vi.mock("@/lib/tokens", () => ({ generatePasswordResetToken: mockGenerateToken }));
vi.mock("@/lib/email", () => ({ sendEmail: mockSendEmail }));
vi.mock("@/lib/email-templates/password-reset", () => ({
  getPasswordResetEmailHtml: () => "<html>reset</html>",
}));

import { POST } from "@/app/api/v1/auth/forgot-password/route";

function makeReq(body: unknown) {
  return new NextRequest("http://localhost/api/v1/auth/forgot-password", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

const mockUser = { id: "u1", name: "Rajesh", authUserId: "auth-1" };

describe("POST /api/v1/auth/forgot-password", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCheckRateLimit.mockReturnValue({ allowed: true, remaining: 2 });
    mockPrisma.user.findFirst.mockResolvedValue(mockUser);
    mockPrisma.passwordResetToken.findFirst.mockResolvedValue(null);
  });

  it("returns 422 on invalid email", async () => {
    const res = await POST(makeReq({ email: "not-an-email" }));
    expect(res.status).toBe(422);
  });

  it("returns 429 when rate limit exceeded", async () => {
    mockCheckRateLimit.mockReturnValue({ allowed: false, remaining: 0 });
    const res = await POST(makeReq({ email: "rajesh@eden.com" }));
    expect(res.status).toBe(429);
  });

  it("returns same message on rate limit to avoid info leak", async () => {
    mockCheckRateLimit.mockReturnValue({ allowed: false, remaining: 0 });
    const res = await POST(makeReq({ email: "rajesh@eden.com" }));
    const body = await res.json();
    expect(body.error.message).toContain("password reset link");
  });

  it("returns 200 even when email not found (no info leak)", async () => {
    mockPrisma.user.findFirst.mockResolvedValue(null);
    const res = await POST(makeReq({ email: "unknown@eden.com" }));
    expect(res.status).toBe(200);
  });

  it("sends email and returns success when user found", async () => {
    const res = await POST(makeReq({ email: "rajesh@eden.com" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(mockSendEmail).toHaveBeenCalled();
  });

  it("calls checkRateLimit with email-based key", async () => {
    await POST(makeReq({ email: "Rajesh@Eden.com" }));
    expect(mockCheckRateLimit).toHaveBeenCalledWith(
      "forgot-password:rajesh@eden.com", // lowercase
      3,
      expect.any(Number),
    );
  });

  it("respects cooldown — skips email when recent token exists", async () => {
    mockPrisma.passwordResetToken.findFirst.mockResolvedValue({
      createdAt: new Date(), // just now
    });
    await POST(makeReq({ email: "rajesh@eden.com" }));
    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  it("returns 500 on unexpected error", async () => {
    mockPrisma.user.findFirst.mockRejectedValue(new Error("DB error"));
    const res = await POST(makeReq({ email: "rajesh@eden.com" }));
    expect(res.status).toBe(500);
  });
});
