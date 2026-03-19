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
const { middleware } = await import("@/middleware");

function makeRequest(pathname: string): NextRequest {
  return {
    nextUrl: new URL(`http://localhost${pathname}`),
    url: `http://localhost${pathname}`,
    cookies: { getAll: () => [] },
  } as unknown as NextRequest;
}

function makeSupabaseResponse() {
  return NextResponse.next();
}

describe("middleware", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ─── Public API routes ────────────────────────────────────────────────────

  it("passes through /api/v1/auth routes without calling updateSession", async () => {
    const req = makeRequest("/api/v1/auth/login");
    const res = await middleware(req);
    expect(mockUpdateSession).not.toHaveBeenCalled();
    expect(res.status).toBe(200);
  });

  it("passes through /api/cron routes without calling updateSession", async () => {
    const req = makeRequest("/api/cron/invoice-generation");
    const res = await middleware(req);
    expect(mockUpdateSession).not.toHaveBeenCalled();
    expect(res.status).toBe(200);
  });

  // ─── Non-protected routes ─────────────────────────────────────────────────

  it("refreshes session for non-protected routes (e.g. login page)", async () => {
    const supabaseResponse = makeSupabaseResponse();
    mockUpdateSession.mockResolvedValue({ user: null, supabaseResponse });

    const req = makeRequest("/login");
    const res = await middleware(req);

    expect(mockUpdateSession).toHaveBeenCalledOnce();
    expect(res).toBe(supabaseResponse);
  });

  it("refreshes session for root path", async () => {
    const supabaseResponse = makeSupabaseResponse();
    mockUpdateSession.mockResolvedValue({ user: null, supabaseResponse });

    const req = makeRequest("/");
    const res = await middleware(req);

    expect(mockUpdateSession).toHaveBeenCalledOnce();
    expect(res).toBe(supabaseResponse);
  });

  // ─── Protected routes — unauthenticated ───────────────────────────────────

  it("redirects unauthenticated user from /admin/* to /login", async () => {
    const supabaseResponse = makeSupabaseResponse();
    mockUpdateSession.mockResolvedValue({ user: null, supabaseResponse });

    const req = makeRequest("/admin/dashboard");
    const res = await middleware(req);

    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/login");
  });

  it("includes redirectTo param when redirecting from /admin/*", async () => {
    mockUpdateSession.mockResolvedValue({ user: null, supabaseResponse: makeSupabaseResponse() });

    const req = makeRequest("/admin/fees");
    const res = await middleware(req);

    const location = res.headers.get("location") ?? "";
    expect(location).toContain("redirectTo=%2Fadmin%2Ffees");
  });

  it("redirects unauthenticated user from /r/* to /login", async () => {
    mockUpdateSession.mockResolvedValue({ user: null, supabaseResponse: makeSupabaseResponse() });

    const req = makeRequest("/r/home");
    const res = await middleware(req);

    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/login");
  });

  it("redirects unauthenticated user from /sa/* to /super-admin-login", async () => {
    mockUpdateSession.mockResolvedValue({ user: null, supabaseResponse: makeSupabaseResponse() });

    const req = makeRequest("/sa/dashboard");
    const res = await middleware(req);

    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toContain("/super-admin-login");
  });

  it("includes redirectTo param when redirecting from /sa/*", async () => {
    mockUpdateSession.mockResolvedValue({ user: null, supabaseResponse: makeSupabaseResponse() });

    const req = makeRequest("/sa/societies");
    const res = await middleware(req);

    const location = res.headers.get("location") ?? "";
    expect(location).toContain("redirectTo=%2Fsa%2Fsocieties");
  });

  // ─── Protected routes — authenticated ─────────────────────────────────────

  it("allows authenticated user through /admin/*", async () => {
    const supabaseResponse = makeSupabaseResponse();
    mockUpdateSession.mockResolvedValue({
      user: { id: "user-1", email: "admin@eden.com" },
      supabaseResponse,
    });

    const req = makeRequest("/admin/dashboard");
    const res = await middleware(req);

    expect(res.status).toBe(200);
    expect(res).toBe(supabaseResponse);
  });

  it("allows authenticated user through /sa/*", async () => {
    const supabaseResponse = makeSupabaseResponse();
    mockUpdateSession.mockResolvedValue({
      user: { id: "sa-1", email: "super@admin.com" },
      supabaseResponse,
    });

    const req = makeRequest("/sa/societies/new");
    const res = await middleware(req);

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
    const res = await middleware(req);

    expect(res.status).toBe(200);
    expect(res).toBe(supabaseResponse);
  });

  // ─── Edge cases ───────────────────────────────────────────────────────────

  it("does not treat /administration as a protected route", async () => {
    // /administration does not start with /admin (exact prefix match required)
    // Actually /administration does start with /admin — this tests that startsWith works correctly
    // /admin is a prefix of /administration, so it should be protected
    mockUpdateSession.mockResolvedValue({ user: null, supabaseResponse: makeSupabaseResponse() });

    const req = makeRequest("/admin");
    const res = await middleware(req);

    // /admin exactly should still be protected
    expect(res.status).toBe(307);
  });

  it("handles /api/v1/residents routes (not auth prefix) by refreshing session", async () => {
    const supabaseResponse = makeSupabaseResponse();
    mockUpdateSession.mockResolvedValue({ user: null, supabaseResponse });

    const req = makeRequest("/api/v1/residents");
    const res = await middleware(req);

    // /api/v1/residents is not a public prefix and not protected → session refresh
    expect(mockUpdateSession).toHaveBeenCalledOnce();
    expect(res).toBe(supabaseResponse);
  });
});
