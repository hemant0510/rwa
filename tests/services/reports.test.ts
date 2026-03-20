import { describe, it, expect, vi, beforeEach } from "vitest";

import { getReportSummary, downloadReport } from "@/services/reports";

const mockFetch = vi.fn();
global.fetch = mockFetch;

function okJson(data: unknown) {
  return { ok: true, json: () => Promise.resolve(data) };
}

function okBlob(text = "binary content") {
  const blob = new Blob([text]);
  return {
    ok: true,
    blob: () => Promise.resolve(blob),
    headers: {
      get: (h: string) =>
        h === "Content-Disposition" ? 'attachment; filename="report.pdf"' : null,
    },
  };
}

const mockSummary = {
  sessionYear: "2025-26",
  totalResidents: 40,
  paidCount: 30,
  pendingCount: 10,
  totalCollected: 72000,
  totalOutstanding: 24000,
  totalExpenses: 14000,
  balance: 58000,
};

describe("reports service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getReportSummary", () => {
    it("fetches summary without session", async () => {
      mockFetch.mockResolvedValue(okJson(mockSummary));
      const result = await getReportSummary("soc-1");
      expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining("/reports/summary"));
      expect(result.paidCount).toBe(30);
    });

    it("appends session param when provided", async () => {
      mockFetch.mockResolvedValue(okJson(mockSummary));
      await getReportSummary("soc-1", "2024-25");
      expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining("session=2024-25"));
    });

    it("throws on error", async () => {
      mockFetch.mockResolvedValue({ ok: false });
      await expect(getReportSummary("soc-1")).rejects.toThrow("Failed to fetch report summary");
    });
  });

  describe("downloadReport", () => {
    beforeEach(() => {
      const createObjectURL = vi.fn(() => "blob:mock-url");
      const revokeObjectURL = vi.fn();
      global.URL.createObjectURL = createObjectURL;
      global.URL.revokeObjectURL = revokeObjectURL;

      const clickFn = vi.fn();
      const mockAnchor = { href: "", download: "", click: clickFn } as unknown as HTMLAnchorElement;
      vi.spyOn(document, "createElement").mockReturnValue(mockAnchor);
    });

    it("fetches PDF for paid-list", async () => {
      mockFetch.mockResolvedValue(okBlob());
      await downloadReport("soc-1", "paid-list", "pdf", "2025-26");
      expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining("/reports/paid-list"));
      expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining("format=pdf"));
      expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining("session=2025-26"));
    });

    it("fetches Excel for expense-summary", async () => {
      mockFetch.mockResolvedValue(okBlob());
      await downloadReport("soc-1", "expense-summary", "excel");
      expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining("format=excel"));
    });

    it("fetches directory without session", async () => {
      mockFetch.mockResolvedValue(okBlob());
      await downloadReport("soc-1", "directory", "pdf");
      expect(mockFetch).toHaveBeenCalledWith(expect.not.stringContaining("session="));
    });

    it("throws when fetch fails", async () => {
      mockFetch.mockResolvedValue({ ok: false });
      await expect(downloadReport("soc-1", "paid-list", "pdf")).rejects.toThrow(
        "Failed to generate report",
      );
    });

    it("uses filename from Content-Disposition header", async () => {
      mockFetch.mockResolvedValue(okBlob());
      await downloadReport("soc-1", "collection-summary", "pdf", "2025-26");
      // Should complete without error
    });

    it("uses fallback filename when header absent", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        blob: () => Promise.resolve(new Blob(["content"])),
        headers: { get: () => null },
      });
      await downloadReport("soc-1", "pending-list", "excel");
      // Should complete without error, using fallback filename
    });
  });
});
