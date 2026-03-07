import { describe, it, expect, vi, beforeEach } from "vitest";

import { getSuperAdminStats } from "@/services/super-admin";

const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("super-admin service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getSuperAdminStats", () => {
    it("fetches stats", async () => {
      const stats = { total: 10, active: 8, trial: 1, suspended: 1, recentSocieties: [] };
      mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve(stats) });
      const result = await getSuperAdminStats();
      expect(result.total).toBe(10);
      expect(result.active).toBe(8);
    });

    it("throws on error", async () => {
      mockFetch.mockResolvedValue({ ok: false });
      await expect(getSuperAdminStats()).rejects.toThrow("Failed to fetch stats");
    });
  });
});
