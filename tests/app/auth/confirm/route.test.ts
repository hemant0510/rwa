import { NextRequest } from "next/server";

import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockVerifyOtp, mockCreateServerClient } = vi.hoisted(() => ({
  mockVerifyOtp: vi.fn(),
  mockCreateServerClient: vi.fn(),
}));

vi.mock("@supabase/ssr", () => ({
  createServerClient: mockCreateServerClient,
}));

function installDefaultMock() {
  mockCreateServerClient.mockImplementation(
    (
      _url: string,
      _key: string,
      opts: { cookies: { getAll: () => unknown; setAll: (c: unknown[]) => void } },
    ) => {
      opts.cookies.getAll();
      opts.cookies.setAll([{ name: "sb-token", value: "v", options: {} }]);
      return { auth: { verifyOtp: mockVerifyOtp } };
    },
  );
}

installDefaultMock();

const { GET } = await import("@/app/auth/confirm/route");

function makeRequest(url: string) {
  return new NextRequest(`http://localhost:3000${url}`, { method: "GET" });
}

describe("GET /auth/confirm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    installDefaultMock();
  });

  it("verifies OTP and redirects to next on success", async () => {
    mockVerifyOtp.mockResolvedValue({ error: null });

    const res = await GET(
      makeRequest("/auth/confirm?token_hash=tkn&type=invite&next=%2Fcounsellor%2Fset-password"),
    );

    expect(mockVerifyOtp).toHaveBeenCalledWith({ type: "invite", token_hash: "tkn" });
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("http://localhost:3000/counsellor/set-password");
  });

  it("defaults next to / when missing", async () => {
    mockVerifyOtp.mockResolvedValue({ error: null });

    const res = await GET(makeRequest("/auth/confirm?token_hash=tkn&type=recovery"));

    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("http://localhost:3000/");
  });

  it("redirects with error when token_hash missing", async () => {
    const res = await GET(makeRequest("/auth/confirm?type=invite"));

    expect(mockVerifyOtp).not.toHaveBeenCalled();
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("http://localhost:3000/auth/auth-error");
  });

  it("redirects with error when type is missing", async () => {
    const res = await GET(makeRequest("/auth/confirm?token_hash=tkn"));

    expect(mockVerifyOtp).not.toHaveBeenCalled();
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("http://localhost:3000/auth/auth-error");
  });

  it("redirects with error when type is not in allowlist", async () => {
    const res = await GET(makeRequest("/auth/confirm?token_hash=tkn&type=phone_change"));

    expect(mockVerifyOtp).not.toHaveBeenCalled();
    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("http://localhost:3000/auth/auth-error");
  });

  it("redirects with error when verifyOtp fails", async () => {
    mockVerifyOtp.mockResolvedValue({ error: { message: "expired" } });

    const res = await GET(makeRequest("/auth/confirm?token_hash=tkn&type=invite"));

    expect(res.status).toBe(307);
    expect(res.headers.get("location")).toBe("http://localhost:3000/auth/auth-error");
  });
});
