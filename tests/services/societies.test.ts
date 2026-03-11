import { describe, it, expect, vi, beforeEach } from "vitest";

import {
  getSocieties,
  getSociety,
  createSociety,
  checkSocietyCode,
  getSocietyByCode,
  updateSociety,
  deleteSociety,
} from "@/services/societies";

const mockFetch = vi.fn();
global.fetch = mockFetch;

function okJson(data: unknown) {
  return { ok: true, json: () => Promise.resolve(data) };
}
function errJson(data: unknown) {
  return { ok: false, json: () => Promise.resolve(data) };
}

describe("societies service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getSocieties", () => {
    it("fetches societies with params", async () => {
      mockFetch.mockResolvedValue(okJson({ data: [], total: 0 }));
      await getSocieties({ status: "ACTIVE", search: "eden", page: 1 });
      expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining("status=ACTIVE"));
    });

    it("fetches without params", async () => {
      mockFetch.mockResolvedValue(okJson({ data: [], total: 0 }));
      await getSocieties();
      expect(mockFetch).toHaveBeenCalled();
    });

    it("throws on error", async () => {
      mockFetch.mockResolvedValue({ ok: false });
      await expect(getSocieties()).rejects.toThrow();
    });
  });

  describe("getSociety", () => {
    it("fetches a single society", async () => {
      mockFetch.mockResolvedValue(okJson({ id: "soc-1" }));
      const result = await getSociety("soc-1");
      expect(result.id).toBe("soc-1");
    });

    it("throws on error", async () => {
      mockFetch.mockResolvedValue({ ok: false });
      await expect(getSociety("soc-1")).rejects.toThrow("Failed to fetch society");
    });
  });

  describe("createSociety", () => {
    it("throws on error", async () => {
      mockFetch.mockResolvedValue({ ok: false });
      await expect(
        createSociety({
          name: "X",
          state: "HR",
          city: "G",
          pincode: "122001",
          type: "APARTMENT_COMPLEX",
          societyCode: "TEST",
          joiningFee: 0,
          annualFee: 0,
          adminName: "Admin",
          adminEmail: "admin@test.com",
          adminPassword: "pass123",
          adminPasswordConfirm: "pass123",
        }),
      ).rejects.toThrow("Failed to create society");
    });

    it("sends POST with data", async () => {
      mockFetch.mockResolvedValue(okJson({ id: "soc-new" }));
      await createSociety({
        name: "Test Society",
        state: "HR",
        city: "Gurugram",
        pincode: "122001",
        type: "APARTMENT_COMPLEX",
        societyCode: "TEST",
        joiningFee: 1000,
        annualFee: 1200,
        adminName: "Admin",
        adminEmail: "admin@test.com",
        adminPassword: "password123",
        adminPasswordConfirm: "password123",
      });
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/societies"),
        expect.objectContaining({ method: "POST" }),
      );
    });
  });

  describe("checkSocietyCode", () => {
    it("checks code availability", async () => {
      mockFetch.mockResolvedValue(okJson({ available: true }));
      const result = await checkSocietyCode("EDEN");
      expect(result.available).toBe(true);
    });

    it("throws on error", async () => {
      mockFetch.mockResolvedValue({ ok: false });
      await expect(checkSocietyCode("BAD")).rejects.toThrow("Failed to check code");
    });
  });

  describe("getSocietyByCode", () => {
    it("fetches society by code", async () => {
      mockFetch.mockResolvedValue(okJson({ name: "Eden Estate" }));
      const result = await getSocietyByCode("EDEN");
      expect(result.name).toBe("Eden Estate");
    });

    it("throws when not found", async () => {
      mockFetch.mockResolvedValue({ ok: false });
      await expect(getSocietyByCode("INVALID")).rejects.toThrow("Society not found");
    });
  });

  describe("updateSociety", () => {
    it("sends PUT with data", async () => {
      mockFetch.mockResolvedValue(okJson({ id: "soc-1" }));
      await updateSociety("soc-1", {
        name: "Updated",
        state: "HR",
        city: "Gurugram",
        pincode: "122001",
        type: "APARTMENT_COMPLEX",
        joiningFee: 1000,
        annualFee: 1500,
      });
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/societies/soc-1"),
        expect.objectContaining({ method: "PUT" }),
      );
    });

    it("throws with API error", async () => {
      mockFetch.mockResolvedValue(errJson({ error: { message: "Duplicate code" } }));
      await expect(
        updateSociety("soc-1", {
          name: "X",
          state: "HR",
          city: "G",
          pincode: "122001",
          type: "APARTMENT_COMPLEX",
          joiningFee: 0,
          annualFee: 0,
        }),
      ).rejects.toThrow("Duplicate code");
    });

    it("throws with fallback message when no error message", async () => {
      mockFetch.mockResolvedValue(errJson({}));
      await expect(
        updateSociety("soc-1", {
          name: "X",
          state: "HR",
          city: "G",
          pincode: "122001",
          type: "APARTMENT_COMPLEX",
          joiningFee: 0,
          annualFee: 0,
        }),
      ).rejects.toThrow("Failed to update society");
    });
  });

  describe("deleteSociety", () => {
    it("sends DELETE", async () => {
      mockFetch.mockResolvedValue(okJson({ message: "Deleted" }));
      await deleteSociety("soc-1");
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/societies/soc-1"),
        expect.objectContaining({ method: "DELETE" }),
      );
    });

    it("throws with API error", async () => {
      mockFetch.mockResolvedValue(errJson({ error: { message: "Has active residents" } }));
      await expect(deleteSociety("soc-1")).rejects.toThrow("Has active residents");
    });

    it("throws with fallback message when no error message", async () => {
      mockFetch.mockResolvedValue(errJson({}));
      await expect(deleteSociety("soc-1")).rejects.toThrow("Failed to delete society");
    });
  });
});
