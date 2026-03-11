import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockCookies } = vi.hoisted(() => ({
  mockCookies: vi.fn(),
}));

vi.mock("next/headers", () => ({
  cookies: mockCookies,
}));

import { getActiveSocietyId } from "@/lib/active-society-server";

describe("getActiveSocietyId", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns the cookie value when cookie exists", async () => {
    mockCookies.mockResolvedValue({
      get: vi.fn().mockReturnValue({ value: "soc-42" }),
    });
    const result = await getActiveSocietyId();
    expect(result).toBe("soc-42");
  });

  it("returns null when cookie does not exist", async () => {
    mockCookies.mockResolvedValue({
      get: vi.fn().mockReturnValue(undefined),
    });
    const result = await getActiveSocietyId();
    expect(result).toBeNull();
  });
});
