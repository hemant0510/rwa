import { NextRequest } from "next/server";

import { describe, it, expect, vi, beforeEach } from "vitest";

const mockCheckRateLimitAsync = vi.hoisted(() => vi.fn());
const mockSignInWithPassword = vi.hoisted(() => vi.fn());
const mockCreateClient = vi.hoisted(() =>
  vi.fn().mockResolvedValue({
    auth: { signInWithPassword: mockSignInWithPassword },
  }),
);

vi.mock("@/lib/rate-limit", () => ({ checkRateLimitAsync: mockCheckRateLimitAsync }));
vi.mock("@/lib/supabase/server", () => ({ createClient: mockCreateClient }));

import { POST } from "@/app/api/v1/auth/login/route";

function makeReq(body: unknown) {
  return new NextRequest("http://localhost/api/v1/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

describe("POST /api/v1/auth/login", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockCreateClient.mockResolvedValue({ auth: { signInWithPassword: mockSignInWithPassword } });
    mockCheckRateLimitAsync.mockResolvedValue({ allowed: true, remaining: 4, resetAt: 0 });
    mockSignInWithPassword.mockResolvedValue({ error: null });
  });

  it("returns 422 for missing email", async () => {
    const res = await POST(makeReq({ password: "password123" }));
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error.code).toBe("VALIDATION_ERROR");
  });

  it("returns 422 for invalid email", async () => {
    const res = await POST(makeReq({ email: "not-an-email", password: "password123" }));
    expect(res.status).toBe(422);
  });

  it("returns 422 for short password", async () => {
    const res = await POST(makeReq({ email: "test@example.com", password: "short" }));
    expect(res.status).toBe(422);
  });

  it("returns 429 when rate limit exceeded", async () => {
    mockCheckRateLimitAsync.mockResolvedValue({
      allowed: false,
      remaining: 0,
      resetAt: Date.now() + 1000,
    });
    const res = await POST(makeReq({ email: "test@example.com", password: "password123" }));
    expect(res.status).toBe(429);
    const body = await res.json();
    expect(body.error.code).toBe("RATE_LIMIT_EXCEEDED");
    expect(body.error.message).toMatch(/too many/i);
  });

  it("returns 401 on invalid credentials", async () => {
    mockSignInWithPassword.mockResolvedValue({ error: { message: "Invalid login credentials" } });
    const res = await POST(makeReq({ email: "test@example.com", password: "password123" }));
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error.code).toBe("INVALID_CREDENTIALS");
    expect(body.error.message).toBe("Invalid login credentials");
  });

  it("returns 200 on successful login", async () => {
    const res = await POST(makeReq({ email: "test@example.com", password: "password123" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.success).toBe(true);
  });

  it("calls rate limiter with email-based key", async () => {
    await POST(makeReq({ email: "User@Example.com", password: "password123" }));
    expect(mockCheckRateLimitAsync).toHaveBeenCalledWith(
      "login:user@example.com",
      5,
      15 * 60 * 1000,
    );
  });

  it("does not call Supabase when rate limited", async () => {
    mockCheckRateLimitAsync.mockResolvedValue({ allowed: false, remaining: 0, resetAt: 0 });
    await POST(makeReq({ email: "test@example.com", password: "password123" }));
    expect(mockSignInWithPassword).not.toHaveBeenCalled();
  });

  it("calls Supabase signInWithPassword with correct credentials", async () => {
    await POST(makeReq({ email: "test@example.com", password: "mypassword123" }));
    expect(mockSignInWithPassword).toHaveBeenCalledWith({
      email: "test@example.com",
      password: "mypassword123",
    });
  });

  it("returns 500 on unexpected error", async () => {
    mockCreateClient.mockRejectedValueOnce(new Error("unexpected"));
    const res = await POST(makeReq({ email: "test@example.com", password: "password123" }));
    expect(res.status).toBe(500);
  });
});
