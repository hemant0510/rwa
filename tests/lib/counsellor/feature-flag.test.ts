import { describe, it, expect, vi, beforeEach } from "vitest";

const mockPrisma = vi.hoisted(() => ({
  platformConfig: { findUnique: vi.fn() },
}));

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

import { COUNSELLOR_ROLE_FLAG_KEY, isCounsellorRoleEnabled } from "@/lib/counsellor/feature-flag";

describe("isCounsellorRoleEnabled", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("exports the canonical flag key", () => {
    expect(COUNSELLOR_ROLE_FLAG_KEY).toBe("counsellor_role_enabled");
  });

  it("returns false when no row is found", async () => {
    mockPrisma.platformConfig.findUnique.mockResolvedValue(null);
    expect(await isCounsellorRoleEnabled()).toBe(false);
  });

  it("returns true when value is 'true'", async () => {
    mockPrisma.platformConfig.findUnique.mockResolvedValue({ value: "true" });
    expect(await isCounsellorRoleEnabled()).toBe(true);
  });

  it("returns false when value is anything other than 'true'", async () => {
    mockPrisma.platformConfig.findUnique.mockResolvedValue({ value: "false" });
    expect(await isCounsellorRoleEnabled()).toBe(false);
  });

  it("returns false and logs on DB error", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    mockPrisma.platformConfig.findUnique.mockRejectedValue(new Error("boom"));
    expect(await isCounsellorRoleEnabled()).toBe(false);
    expect(spy).toHaveBeenCalled();
    spy.mockRestore();
  });
});
