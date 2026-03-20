import { describe, it, expect, vi, beforeEach } from "vitest";

import { validateMigrationFile, importMigrationRecords } from "@/services/migration";

const mockFetch = vi.fn();
global.fetch = mockFetch;

function okJson(data: unknown) {
  return { ok: true, json: () => Promise.resolve(data) };
}
function errJson(data: unknown) {
  return { ok: false, json: () => Promise.resolve(data) };
}

// Minimal mock for fetch blob (downloadMigrationTemplate)
function okBlob(text = "xlsx content") {
  const blob = new Blob([text]);
  return {
    ok: true,
    blob: () => Promise.resolve(blob),
    headers: { get: () => 'attachment; filename="template.xlsx"' },
  };
}

describe("migration service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("validateMigrationFile", () => {
    it("sends POST with FormData", async () => {
      mockFetch.mockResolvedValue(
        okJson({ total: 1, valid: 1, invalid: 0, errors: [], preview: [] }),
      );
      const file = new File(["content"], "test.xlsx");
      const result = await validateMigrationFile("soc-1", file);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/migration/validate"),
        expect.objectContaining({ method: "POST" }),
      );
      expect(result.total).toBe(1);
    });

    it("throws error on failed response", async () => {
      mockFetch.mockResolvedValue(errJson({ error: { message: "Validation failed" } }));
      const file = new File(["content"], "test.xlsx");
      await expect(validateMigrationFile("soc-1", file)).rejects.toThrow("Validation failed");
    });

    it("throws fallback error when no message", async () => {
      mockFetch.mockResolvedValue(errJson({}));
      const file = new File(["content"], "test.xlsx");
      await expect(validateMigrationFile("soc-1", file)).rejects.toThrow("Validation failed");
    });
  });

  describe("importMigrationRecords", () => {
    const validRecords = [
      {
        fullName: "John Doe",
        email: "john@example.com",
        mobile: "9876543210",
        ownershipType: "OWNER",
        feeStatus: "PAID",
        unitFields: {},
      },
    ];

    it("sends POST with JSON body", async () => {
      mockFetch.mockResolvedValue(
        okJson({
          results: [{ rowIndex: 0, success: true, rwaid: "RWA-1" }],
          summary: { total: 1, imported: 1, failed: 0 },
        }),
      );
      const result = await importMigrationRecords("soc-1", validRecords);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/migration/import"),
        expect.objectContaining({
          method: "POST",
          headers: expect.objectContaining({ "Content-Type": "application/json" }),
        }),
      );
      expect(result.summary.imported).toBe(1);
    });

    it("throws error on failed response", async () => {
      mockFetch.mockResolvedValue(errJson({ error: { message: "Import failed" } }));
      await expect(importMigrationRecords("soc-1", validRecords)).rejects.toThrow("Import failed");
    });

    it("throws fallback error when no message", async () => {
      mockFetch.mockResolvedValue(errJson({}));
      await expect(importMigrationRecords("soc-1", validRecords)).rejects.toThrow("Import failed");
    });
  });

  describe("downloadMigrationTemplate", () => {
    it("triggers download when fetch succeeds", async () => {
      mockFetch.mockResolvedValue(okBlob());

      // Mock URL and document APIs
      const createObjectURL = vi.fn(() => "blob:mock-url");
      const revokeObjectURL = vi.fn();
      global.URL.createObjectURL = createObjectURL;
      global.URL.revokeObjectURL = revokeObjectURL;

      const clickFn = vi.fn();
      const mockAnchor = { href: "", download: "", click: clickFn } as unknown as HTMLAnchorElement;
      vi.spyOn(document, "createElement").mockReturnValueOnce(mockAnchor);

      const { downloadMigrationTemplate } = await import("@/services/migration");
      await downloadMigrationTemplate("soc-1");

      expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining("/migration/template"));
      expect(clickFn).toHaveBeenCalled();
    });

    it("throws when fetch fails", async () => {
      mockFetch.mockResolvedValue({ ok: false });
      const { downloadMigrationTemplate } = await import("@/services/migration");
      await expect(downloadMigrationTemplate("soc-1")).rejects.toThrow(
        "Failed to download template",
      );
    });

    it("uses fallback filename when Content-Disposition header is absent", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        blob: () => Promise.resolve(new Blob(["content"])),
        headers: { get: () => null },
      });

      global.URL.createObjectURL = vi.fn(() => "blob:mock-url");
      global.URL.revokeObjectURL = vi.fn();

      const clickFn = vi.fn();
      const mockAnchor = {
        href: "",
        download: "",
        click: clickFn,
      } as unknown as HTMLAnchorElement;
      vi.spyOn(document, "createElement").mockReturnValueOnce(mockAnchor);

      const { downloadMigrationTemplate } = await import("@/services/migration");
      await downloadMigrationTemplate("soc-1");

      expect(clickFn).toHaveBeenCalled();
      expect(mockAnchor.download).toBe("migration-template.xlsx");
    });
  });
});
