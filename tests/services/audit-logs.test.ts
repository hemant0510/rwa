import { describe, it, expect, vi, beforeEach } from "vitest";

import { buildExportUrl, getAuditLogs } from "@/services/audit-logs";

const mockFetch = vi.fn();
global.fetch = mockFetch;

const mockResponse = {
  items: [],
  total: 0,
  page: 1,
  limit: 50,
  totalPages: 0,
};

describe("audit-logs service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getAuditLogs", () => {
    it("fetches audit logs with no filters", async () => {
      mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve(mockResponse) });
      const result = await getAuditLogs();
      expect(result.items).toEqual([]);
      expect(result.total).toBe(0);
      expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining("audit-logs"));
    });

    it("appends non-empty filters as query params", async () => {
      mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve(mockResponse) });
      await getAuditLogs({ from: "2026-03-01", to: "2026-03-31", page: 2 });
      const url = mockFetch.mock.calls[0][0] as string;
      expect(url).toContain("from=2026-03-01");
      expect(url).toContain("to=2026-03-31");
      expect(url).toContain("page=2");
    });

    it("omits undefined and empty-string filters", async () => {
      mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve(mockResponse) });
      await getAuditLogs({ from: undefined, societyId: "" });
      const url = mockFetch.mock.calls[0][0] as string;
      expect(url).not.toContain("from=");
      expect(url).not.toContain("societyId=");
    });

    it("throws on non-ok response", async () => {
      mockFetch.mockResolvedValue({ ok: false });
      await expect(getAuditLogs()).rejects.toThrow("Failed to fetch audit logs");
    });
  });

  describe("buildExportUrl", () => {
    it("returns export URL with no filters", () => {
      const url = buildExportUrl({});
      expect(url).toContain("audit-logs/export");
    });

    it("includes provided filters in URL", () => {
      const url = buildExportUrl({ from: "2026-03-01", actionType: "SOCIETY_UPDATED" });
      expect(url).toContain("from=2026-03-01");
      expect(url).toContain("actionType=SOCIETY_UPDATED");
    });

    it("omits undefined and empty-string values from URL", () => {
      const url = buildExportUrl({ from: undefined, societyId: "" });
      expect(url).not.toContain("from=");
      expect(url).not.toContain("societyId=");
    });
  });
});
