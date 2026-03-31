import { describe, it, expect, vi, beforeEach } from "vitest";

import {
  getGrowthStats,
  getPlanDistribution,
  getRevenueStats,
  getSuperAdminStats,
} from "@/services/super-admin";

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

  describe("getRevenueStats", () => {
    it("fetches revenue stats", async () => {
      const data = { mrr: 5000, totalRevenueThisMonth: 15000, overdueCount: 2, expiring30d: 3 };
      mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve(data) });
      const result = await getRevenueStats();
      expect(result.mrr).toBe(5000);
      expect(result.overdueCount).toBe(2);
    });

    it("throws on error", async () => {
      mockFetch.mockResolvedValue({ ok: false });
      await expect(getRevenueStats()).rejects.toThrow("Failed to fetch revenue stats");
    });
  });

  describe("getGrowthStats", () => {
    it("fetches growth stats", async () => {
      const data = { data: [{ month: "Apr 2026", count: 5 }], totalBefore: 2 };
      mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve(data) });
      const result = await getGrowthStats();
      expect(result.data).toHaveLength(1);
      expect(result.totalBefore).toBe(2);
    });

    it("throws on error", async () => {
      mockFetch.mockResolvedValue({ ok: false });
      await expect(getGrowthStats()).rejects.toThrow("Failed to fetch growth stats");
    });
  });

  describe("getPlanDistribution", () => {
    it("fetches plan distribution", async () => {
      const data = [{ planId: "p1", planName: "Basic", count: 4, percentage: 80 }];
      mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve(data) });
      const result = await getPlanDistribution();
      expect(result).toHaveLength(1);
      expect(result[0].planName).toBe("Basic");
    });

    it("throws on error", async () => {
      mockFetch.mockResolvedValue({ ok: false });
      await expect(getPlanDistribution()).rejects.toThrow("Failed to fetch plan distribution");
    });
  });
});
