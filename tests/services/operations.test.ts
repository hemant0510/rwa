import { describe, it, expect, vi, beforeEach } from "vitest";

import {
  getActivityFeed,
  getOperationsSummary,
  getPlatformResidents,
  getSocietyHealth,
} from "@/services/operations";

const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("operations service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getPlatformResidents", () => {
    const mockResponse = {
      data: [],
      total: 0,
      page: 1,
      limit: 50,
      totalPages: 0,
      kpis: { totalAll: 0, activePaid: 0, pending: 0, overdue: 0 },
    };

    it("fetches residents with no filters", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });
      const result = await getPlatformResidents();
      expect(result.data).toEqual([]);
      expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining("/super-admin/residents"));
    });

    it("appends non-empty filters as query params", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });
      await getPlatformResidents({
        search: "john",
        status: "ACTIVE",
        page: 2,
      });
      const url = mockFetch.mock.calls[0][0] as string;
      expect(url).toContain("search=john");
      expect(url).toContain("status=ACTIVE");
      expect(url).toContain("page=2");
    });

    it("omits undefined and empty-string filters", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });
      await getPlatformResidents({ search: undefined, societyId: "" });
      const url = mockFetch.mock.calls[0][0] as string;
      expect(url).not.toContain("search=");
      expect(url).not.toContain("societyId=");
    });

    it("throws on non-ok response", async () => {
      mockFetch.mockResolvedValue({ ok: false });
      await expect(getPlatformResidents()).rejects.toThrow("Failed to fetch platform residents");
    });
  });

  describe("getOperationsSummary", () => {
    const mockSummary = {
      totalResidents: 500,
      collectionRate: 80,
      totalExpensesThisMonth: 25000,
      activeEvents: 12,
      activePetitions: 3,
      broadcastsThisMonth: 8,
    };

    it("fetches operations summary", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockSummary),
      });
      const result = await getOperationsSummary();
      expect(result.totalResidents).toBe(500);
      expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining("/operations/summary"));
    });

    it("throws on non-ok response", async () => {
      mockFetch.mockResolvedValue({ ok: false });
      await expect(getOperationsSummary()).rejects.toThrow("Failed to fetch operations summary");
    });
  });

  describe("getSocietyHealth", () => {
    const mockHealth = { societies: [] };

    it("fetches society health data", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockHealth),
      });
      const result = await getSocietyHealth();
      expect(result.societies).toEqual([]);
      expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining("/operations/health"));
    });

    it("throws on non-ok response", async () => {
      mockFetch.mockResolvedValue({ ok: false });
      await expect(getSocietyHealth()).rejects.toThrow("Failed to fetch society health");
    });
  });

  describe("getActivityFeed", () => {
    const mockFeed = { activities: [] };

    it("fetches activity feed", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockFeed),
      });
      const result = await getActivityFeed();
      expect(result.activities).toEqual([]);
      expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining("/operations/activity"));
    });

    it("throws on non-ok response", async () => {
      mockFetch.mockResolvedValue({ ok: false });
      await expect(getActivityFeed()).rejects.toThrow("Failed to fetch activity feed");
    });
  });
});
