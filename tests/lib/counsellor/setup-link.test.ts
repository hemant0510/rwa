import { describe, it, expect, vi, beforeEach } from "vitest";

import { generateCounsellorSetupLink } from "@/lib/counsellor/setup-link";

const mockGenerateLink = vi.fn();

function makeClient() {
  return {
    auth: { admin: { generateLink: mockGenerateLink } },
  };
}

describe("generateCounsellorSetupLink", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns invite link when invite succeeds", async () => {
    mockGenerateLink.mockResolvedValue({
      data: { properties: { hashed_token: "hash-abc", verification_type: "invite" } },
      error: null,
    });

    const result = await generateCounsellorSetupLink(makeClient(), "asha@x.com");

    expect(result.actionLink).toContain("/auth/confirm?");
    expect(result.actionLink).toContain("token_hash=hash-abc");
    expect(result.actionLink).toContain("type=invite");
    expect(result.actionLink).toContain("next=%2Fcounsellor%2Fset-password");
    expect(result.errorMessage).toBeNull();
    expect(mockGenerateLink).toHaveBeenCalledTimes(1);
  });

  it("falls back to recovery link when invite returns no usable properties", async () => {
    mockGenerateLink
      .mockResolvedValueOnce({ data: null, error: { message: "User already registered" } })
      .mockResolvedValueOnce({
        data: { properties: { hashed_token: "hash-rec", verification_type: "recovery" } },
        error: null,
      });

    const result = await generateCounsellorSetupLink(makeClient(), "asha@x.com");

    expect(result.actionLink).toContain("token_hash=hash-rec");
    expect(result.actionLink).toContain("type=recovery");
    expect(result.errorMessage).toBeNull();
    expect(mockGenerateLink).toHaveBeenCalledTimes(2);
  });

  it("returns error message when both invite and recovery fail", async () => {
    mockGenerateLink
      .mockResolvedValueOnce({ data: null, error: { message: "invite failed" } })
      .mockResolvedValueOnce({ data: null, error: { message: "recovery failed" } });

    const result = await generateCounsellorSetupLink(makeClient(), "asha@x.com");

    expect(result.actionLink).toBeNull();
    expect(result.errorMessage).toBe("recovery failed");
  });

  it("prefers invite error message when recovery error has no message", async () => {
    mockGenerateLink
      .mockResolvedValueOnce({ data: null, error: { message: "invite failed" } })
      .mockResolvedValueOnce({ data: null, error: {} });

    const result = await generateCounsellorSetupLink(makeClient(), "asha@x.com");

    expect(result.actionLink).toBeNull();
    expect(result.errorMessage).toBe("invite failed");
  });

  it("falls back to generic message when neither call supplies one", async () => {
    mockGenerateLink
      .mockResolvedValueOnce({ data: null, error: null })
      .mockResolvedValueOnce({ data: null, error: null });

    const result = await generateCounsellorSetupLink(makeClient(), "asha@x.com");

    expect(result.actionLink).toBeNull();
    expect(result.errorMessage).toBe("Failed to generate invite link");
  });

  it("treats invite properties missing hashed_token as failure and falls through", async () => {
    mockGenerateLink
      .mockResolvedValueOnce({ data: { properties: { verification_type: "invite" } }, error: null })
      .mockResolvedValueOnce({
        data: { properties: { hashed_token: "hash-rec", verification_type: "recovery" } },
        error: null,
      });

    const result = await generateCounsellorSetupLink(makeClient(), "asha@x.com");

    expect(result.actionLink).toContain("hash-rec");
  });

  it("treats invite properties missing verification_type as failure and falls through", async () => {
    mockGenerateLink
      .mockResolvedValueOnce({ data: { properties: { hashed_token: "hash-abc" } }, error: null })
      .mockResolvedValueOnce({
        data: { properties: { hashed_token: "hash-rec", verification_type: "recovery" } },
        error: null,
      });

    const result = await generateCounsellorSetupLink(makeClient(), "asha@x.com");

    expect(result.actionLink).toContain("hash-rec");
  });

  it("handles null properties payload from recovery", async () => {
    mockGenerateLink
      .mockResolvedValueOnce({ data: null, error: { message: "invite fail" } })
      .mockResolvedValueOnce({ data: { properties: null }, error: null });

    const result = await generateCounsellorSetupLink(makeClient(), "asha@x.com");

    expect(result.actionLink).toBeNull();
    expect(result.errorMessage).toBe("invite fail");
  });
});
