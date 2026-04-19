import { type NextRequest, NextResponse } from "next/server";

import { beforeEach, describe, expect, it, vi } from "vitest";

// Must hoist mocks so they are available before imports
const { mockUpdateSession } = vi.hoisted(() => {
  return { mockUpdateSession: vi.fn() };
});

vi.mock("@/lib/supabase/middleware", () => ({
  updateSession: mockUpdateSession,
}));

// Import after mock is set up
const { proxy } = await import("@/proxy");

function makeRequest(pathname: string, cookieOverrides: Record<string, string> = {}): NextRequest {
  return {
    nextUrl: new URL(`http://localhost${pathname}`),
    url: `http://localhost${pathname}`,
    cookies: {
      getAll: () => Object.entries(cookieOverrides).map(([name, value]) => ({ name, value })),
      get: (name: string) => {
        const val = cookieOverrides[name];
        return val !== undefined ? { name, value: val } : undefined;
      },
    },
  } as unknown as NextRequest;
}

function makeSupabaseResponse() {
  return NextResponse.next();
}

describe("proxy", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ─── Static files / Next.js internals ──────────────────────────────────────

  it("skips static files with extensions (e.g. .svg)", async () => {
    const req = makeRequest("/logo.svg");
    const res = await proxy(req);

    expect(mockUpdateSession).not.toHaveBeenCalled();
    expect(res.status).toBe(200);
  });

  it("skips /_next internal routes", async () => {
    const req = makeRequest("/_next/static/chunk.js");
    const res = await proxy(req);

    expect(mockUpdateSession).not.toHaveBeenCalled();
    expect(res.status).toBe(200);
  });

  // ─── Public API routes ────────────────────────────────────────────────────

  it("passes through /api/v1/auth routes (session refreshed, public)", async () => {
    const supabaseResponse = makeSupabaseResponse();
    mockUpdateSession.mockResolvedValue({ user: null, supabaseResponse });

    const req = makeRequest("/api/v1/auth/login");
    const res = await proxy(req);

    expect(mockUpdateSession).toHaveBeenCalledOnce();
    expect(res).toBe(supabaseResponse);
  });

  it("passes through /api/cron routes (session refreshed, public)", async () => {
    const supabaseResponse = makeSupabaseResponse();
    mockUpdateSession.mockResolvedValue({ user: null, supabaseResponse });

    const req = makeRequest("/api/cron/invoice-generation");
    const res = await proxy(req);

    expect(mockUpdateSession).toHaveBeenCalledOnce();
    expect(res).toBe(supabaseResponse);
  });

  // ─── Public pages ─────────────────────────────────────────────────────────

  it("passes through /login page (public route)", async () => {
    const supabaseResponse = makeSupabaseResponse();
    mockUpdateSession.mockResolvedValue({ user: null, supabaseResponse });

    const req = makeRequest("/login");
    const res = await proxy(req);

    expect(mockUpdateSession).toHaveBeenCalledOnce();
    expect(res).toBe(supabaseResponse);
  });

  it("passes through root path (public route)", async () => {
    const supabaseResponse = makeSupabaseResponse();
    mockUpdateSession.mockResolvedValue({ user: null, supabaseResponse });

    const req = makeRequest("/");
    const res = await proxy(req);

    expect(mockUpdateSession).toHaveBeenCalledOnce();
    expect(res).toBe(supabaseResponse);
  });

  it("passes through /counsellor/set-password (public route)", async () => {
    const supabaseResponse = makeSupabaseResponse();
    mockUpdateSession.mockResolvedValue({ user: null, supabaseResponse });

    const req = makeRequest("/counsellor/set-password");
    const res = await proxy(req);

    expect(mockUpdateSession).toHaveBeenCalledOnce();
    expect(res).toBe(supabaseResponse);
  });

  it("passes through /auth/callback (public route)", async () => {
    const supabaseResponse = makeSupabaseResponse();
    mockUpdateSession.mockResolvedValue({ user: null, supabaseResponse });

    const req = makeRequest("/auth/callback");
    const res = await proxy(req);

    expect(mockUpdateSession).toHaveBeenCalledOnce();
    expect(res).toBe(supabaseResponse);
  });

  it("passes through /auth/confirm (public route)", async () => {
    const supabaseResponse = makeSupabaseResponse();
    mockUpdateSession.mockResolvedValue({ user: null, supabaseResponse });

    const req = makeRequest("/auth/confirm");
    const res = await proxy(req);

    expect(mockUpdateSession).toHaveBeenCalledOnce();
    expect(res).toBe(supabaseResponse);
  });

  // ─── Protected routes — unauthenticated ───────────────────────────────────

  it("redirects unauthenticated user from /admin/* to /login", async () => {
    const supabaseResponse = makeSupabaseResponse();
    mockUpdateSession.mockResolvedValue({ user: null, supabaseResponse });

    const req = makeRequest("/admin/dashboard");
    const res = await proxy(req);

    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/login");
  });

  it("redirects unauthenticated user from /r/* to /login", async () => {
    mockUpdateSession.mockResolvedValue({ user: null, supabaseResponse: makeSupabaseResponse() });

    const req = makeRequest("/r/home");
    const res = await proxy(req);

    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/login");
  });

  it("redirects unauthenticated user from /sa/* to /super-admin-login", async () => {
    mockUpdateSession.mockResolvedValue({ user: null, supabaseResponse: makeSupabaseResponse() });

    const req = makeRequest("/sa/dashboard");
    const res = await proxy(req);

    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/super-admin-login");
  });

  // ─── Protected routes — authenticated ─────────────────────────────────────

  it("allows authenticated user through /admin/*", async () => {
    const supabaseResponse = makeSupabaseResponse();
    mockUpdateSession.mockResolvedValue({
      user: { id: "user-1", email: "admin@eden.com" },
      supabaseResponse,
    });

    const req = makeRequest("/admin/dashboard");
    const res = await proxy(req);

    expect(res.status).toBe(200);
  });

  it("allows authenticated user through /sa/*", async () => {
    const supabaseResponse = makeSupabaseResponse();
    mockUpdateSession.mockResolvedValue({
      user: { id: "sa-1", email: "super@admin.com" },
      supabaseResponse,
    });

    const req = makeRequest("/sa/societies/new");
    const res = await proxy(req);

    expect(res.status).toBe(200);
    expect(res).toBe(supabaseResponse);
  });

  it("allows authenticated user through /r/*", async () => {
    const supabaseResponse = makeSupabaseResponse();
    mockUpdateSession.mockResolvedValue({
      user: { id: "resident-1", email: "resident@eden.com" },
      supabaseResponse,
    });

    const req = makeRequest("/r/payments");
    const res = await proxy(req);

    expect(res.status).toBe(200);
    expect(res).toBe(supabaseResponse);
  });

  // ─── Protected API routes ─────────────────────────────────────────────────

  it("returns 401 JSON for protected /api/v1 routes when unauthenticated", async () => {
    const supabaseResponse = makeSupabaseResponse();
    mockUpdateSession.mockResolvedValue({ user: null, supabaseResponse });

    const req = makeRequest("/api/v1/residents");
    const res = await proxy(req);

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error.code).toBe("UNAUTHORIZED");
  });

  it("allows authenticated user through protected /api/v1 routes", async () => {
    const supabaseResponse = makeSupabaseResponse();
    mockUpdateSession.mockResolvedValue({
      user: { id: "user-1", email: "admin@eden.com" },
      supabaseResponse,
    });

    const req = makeRequest("/api/v1/residents");
    const res = await proxy(req);

    expect(res).toBe(supabaseResponse);
  });

  // ─── Security headers ─────────────────────────────────────────────────────

  it("adds security headers on authenticated protected routes", async () => {
    const supabaseResponse = makeSupabaseResponse();
    mockUpdateSession.mockResolvedValue({
      user: { id: "user-1", email: "admin@eden.com" },
      supabaseResponse,
    });

    const req = makeRequest("/admin/dashboard");
    const res = await proxy(req);

    expect(res.headers.get("X-Content-Type-Options")).toBe("nosniff");
    expect(res.headers.get("X-Frame-Options")).toBe("DENY");
    expect(res.headers.get("X-XSS-Protection")).toBe("1; mode=block");
    expect(res.headers.get("Referrer-Policy")).toBe("strict-origin-when-cross-origin");
  });

  // ─── Session inactivity timeout ───────────────────────────────────────────

  it("redirects to /login?reason=session_expired when activity cookie is expired", async () => {
    const supabaseResponse = makeSupabaseResponse();
    mockUpdateSession.mockResolvedValue({
      user: { id: "user-1", email: "admin@eden.com" },
      supabaseResponse,
    });

    // Simulate a cookie that was last set 9 hours ago (> 8hr timeout)
    const nineHoursAgo = String(Date.now() - 9 * 60 * 60 * 1000);
    const req = makeRequest("/admin/dashboard", { "admin-last-activity": nineHoursAgo });
    const res = await proxy(req);

    expect(res.status).toBe(307);
    const location = res.headers.get("location") ?? "";
    expect(location).toContain("/login");
    expect(location).toContain("reason=session_expired");
  });

  it("allows through when activity cookie is fresh (under 8 hours)", async () => {
    const supabaseResponse = makeSupabaseResponse();
    mockUpdateSession.mockResolvedValue({
      user: { id: "user-1", email: "admin@eden.com" },
      supabaseResponse,
    });

    // Cookie set 1 hour ago — within the 8-hour window
    const oneHourAgo = String(Date.now() - 60 * 60 * 1000);
    const req = makeRequest("/admin/dashboard", { "admin-last-activity": oneHourAgo });
    const res = await proxy(req);

    expect(res.status).toBe(200);
  });

  it("allows first admin request with no activity cookie (no timeout check)", async () => {
    const supabaseResponse = makeSupabaseResponse();
    mockUpdateSession.mockResolvedValue({
      user: { id: "user-1", email: "admin@eden.com" },
      supabaseResponse,
    });

    const req = makeRequest("/admin/dashboard"); // no cookie
    const res = await proxy(req);

    expect(res.status).toBe(200);
  });

  it("applies session timeout to /sa routes and redirects to super-admin-login", async () => {
    const supabaseResponse = makeSupabaseResponse();
    mockUpdateSession.mockResolvedValue({
      user: { id: "sa-1", email: "super@admin.com" },
      supabaseResponse,
    });

    const nineHoursAgo = String(Date.now() - 9 * 60 * 60 * 1000);
    const req = makeRequest("/sa/societies", { "admin-last-activity": nineHoursAgo });
    const res = await proxy(req);

    // /sa routes ARE subject to activity timeout, redirecting to super-admin-login
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/super-admin-login");
    expect(res.headers.get("location")).toContain("reason=session_expired");
  });
});
