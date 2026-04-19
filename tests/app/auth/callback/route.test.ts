import { NextRequest } from "next/server";

import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockExchangeCode, mockCreateServerClient } = vi.hoisted(() => ({
  mockExchangeCode: vi.fn(),
  mockCreateServerClient: vi.fn(),
}));

vi.mock("@supabase/ssr", () => ({
  createServerClient: mockCreateServerClient,
}));

// Default mock: invokes both cookie callbacks to reach full coverage,
// then returns the auth stub used by the route handler.
function installDefaultMock() {
  mockCreateServerClient.mockImplementation(
    (
      _url: string,
      _key: string,
      opts: { cookies: { getAll: () => unknown; setAll: (c: unknown[]) => void } },
    ) => {
      opts.cookies.getAll();
      opts.cookies.setAll([{ name: "sb-token", value: "v", options: {} }]);
      return { auth: { exchangeCodeForSession: mockExchangeCode } };
    },
  );
}

installDefaultMock();

const { GET } = await import("@/app/auth/callback/route");

function makeRequest(url: string) {
  return new NextRequest(`http://localhost:3000${url}`, { method: "GET" });
}

describe("GET /auth/callback", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    installDefaultMock();
  });

  it("exchanges code and redirects to next param on success", async () => {
    mockExchangeCode.mockResolvedValue({ error: null });

    const res = await GET(makeRequest("/auth/callback?code=abc123&next=/counsellor/set-password"));

    expect(mockExchangeCode).toHaveBeenCalledWith("abc123");
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("http://localhost:3000/counsellor/set-password");
  });

  it("redirects to / when next param is missing", async () => {
    mockExchangeCode.mockResolvedValue({ error: null });

    const res = await GET(makeRequest("/auth/callback?code=abc123"));

    expect(mockExchangeCode).toHaveBeenCalledWith("abc123");
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("http://localhost:3000/");
  });

  it("redirects to /?error=auth_callback_failed when code exchange fails", async () => {
    mockExchangeCode.mockResolvedValue({ error: new Error("invalid code") });

    const res = await GET(makeRequest("/auth/callback?code=bad-code"));

    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("http://localhost:3000/auth/auth-error");
  });

  it("redirects to /?error=auth_callback_failed when no code param", async () => {
    const res = await GET(makeRequest("/auth/callback"));

    expect(mockExchangeCode).not.toHaveBeenCalled();
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("http://localhost:3000/auth/auth-error");
  });

  it("redirects to /?error=auth_callback_failed when code is empty", async () => {
    const res = await GET(makeRequest("/auth/callback?code="));

    expect(mockExchangeCode).not.toHaveBeenCalled();
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("http://localhost:3000/auth/auth-error");
  });
});
