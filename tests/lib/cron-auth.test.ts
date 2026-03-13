import { describe, it, expect, vi, afterEach } from "vitest";

import { verifyCronSecret } from "@/lib/cron-auth";

function makeRequest(authHeader?: string): Request {
  const headers = new Headers();
  if (authHeader) headers.set("authorization", authHeader);
  return new Request("https://example.com/api/cron/test", { headers });
}

describe("verifyCronSecret", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns true when Bearer token matches CRON_SECRET", () => {
    vi.stubEnv("CRON_SECRET", "my-secret-123");
    expect(verifyCronSecret(makeRequest("Bearer my-secret-123"))).toBe(true);
  });

  it("returns false when token does not match", () => {
    vi.stubEnv("CRON_SECRET", "my-secret-123");
    expect(verifyCronSecret(makeRequest("Bearer wrong-secret"))).toBe(false);
  });

  it("returns false when authorization header is missing", () => {
    vi.stubEnv("CRON_SECRET", "my-secret-123");
    expect(verifyCronSecret(makeRequest())).toBe(false);
  });

  it("returns false when CRON_SECRET env var is not set", () => {
    vi.stubEnv("CRON_SECRET", "");
    expect(verifyCronSecret(makeRequest("Bearer something"))).toBe(false);
  });

  it("returns false when header is not Bearer format", () => {
    vi.stubEnv("CRON_SECRET", "my-secret-123");
    expect(verifyCronSecret(makeRequest("my-secret-123"))).toBe(false);
  });
});
