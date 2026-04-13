import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  getResidentFamily,
  getResidentVehicles,
  searchAdminVehicles,
  updateAdminVehicle,
} from "@/services/admin-residents";

const mockFetch = vi.fn();
global.fetch = mockFetch;

function okJson(data: unknown) {
  return { ok: true, json: () => Promise.resolve(data) };
}
function errJson(data: unknown) {
  return { ok: false, json: () => Promise.resolve(data) };
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("admin-residents service", () => {
  describe("getResidentFamily", () => {
    it("fetches members and returns array", async () => {
      mockFetch.mockResolvedValue(okJson({ members: [{ id: "d1", name: "Asha" }] }));
      const result = await getResidentFamily("r1");
      expect(mockFetch).toHaveBeenCalledWith("/api/v1/residents/r1/family");
      expect(result).toHaveLength(1);
    });

    it("throws on server error with message", async () => {
      mockFetch.mockResolvedValue(errJson({ error: { message: "Forbidden" } }));
      await expect(getResidentFamily("r1")).rejects.toThrow("Forbidden");
    });

    it("throws default message on error without message", async () => {
      mockFetch.mockResolvedValue(errJson({}));
      await expect(getResidentFamily("r1")).rejects.toThrow("Failed to load family members");
    });

    it("throws default when response body is not valid JSON", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        json: () => Promise.reject(new Error("bad")),
      });
      await expect(getResidentFamily("r1")).rejects.toThrow("Failed to load family members");
    });
  });

  describe("getResidentVehicles", () => {
    it("fetches vehicles", async () => {
      mockFetch.mockResolvedValue(okJson({ vehicles: [] }));
      const result = await getResidentVehicles("r1");
      expect(mockFetch).toHaveBeenCalledWith("/api/v1/residents/r1/vehicles");
      expect(result).toEqual([]);
    });

    it("throws on server error", async () => {
      mockFetch.mockResolvedValue(errJson({ error: { message: "Denied" } }));
      await expect(getResidentVehicles("r1")).rejects.toThrow("Denied");
    });

    it("throws default when error body malformed", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        json: () => Promise.reject(new Error("x")),
      });
      await expect(getResidentVehicles("r1")).rejects.toThrow("Failed to load vehicles");
    });
  });

  describe("updateAdminVehicle", () => {
    it("sends PATCH with admin-editable fields", async () => {
      mockFetch.mockResolvedValue(okJson({ vehicle: { id: "v1" } }));
      const result = await updateAdminVehicle("v1", { parkingSlot: "B-12" });
      expect(mockFetch).toHaveBeenCalledWith(
        "/api/v1/admin/vehicles/v1",
        expect.objectContaining({
          method: "PATCH",
          body: JSON.stringify({ parkingSlot: "B-12" }),
        }),
      );
      expect(result.id).toBe("v1");
    });

    it("throws on server error", async () => {
      mockFetch.mockResolvedValue(errJson({ error: { message: "Nope" } }));
      await expect(updateAdminVehicle("v1", {})).rejects.toThrow("Nope");
    });

    it("throws default when no message", async () => {
      mockFetch.mockResolvedValue(errJson({}));
      await expect(updateAdminVehicle("v1", {})).rejects.toThrow("Failed to update vehicle");
    });

    it("throws default when response body malformed", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        json: () => Promise.reject(new Error("bad")),
      });
      await expect(updateAdminVehicle("v1", {})).rejects.toThrow("Failed to update vehicle");
    });
  });

  describe("searchAdminVehicles", () => {
    it("sends search query param", async () => {
      mockFetch.mockResolvedValue(okJson({ vehicles: [], total: 0, page: 1, limit: 20 }));
      await searchAdminVehicles("DL3");
      const url = mockFetch.mock.calls[0][0] as string;
      expect(url).toContain("/api/v1/admin/vehicles/search");
      expect(url).toContain("q=DL3");
    });

    it("includes pagination params when given", async () => {
      mockFetch.mockResolvedValue(okJson({ vehicles: [], total: 0, page: 2, limit: 10 }));
      await searchAdminVehicles("DL3", { page: 2, limit: 10 });
      const url = mockFetch.mock.calls[0][0] as string;
      expect(url).toContain("page=2");
      expect(url).toContain("limit=10");
    });

    it("throws on server error", async () => {
      mockFetch.mockResolvedValue(errJson({ error: { message: "Bad" } }));
      await expect(searchAdminVehicles("DL3")).rejects.toThrow("Bad");
    });

    it("throws default when no message", async () => {
      mockFetch.mockResolvedValue(errJson({}));
      await expect(searchAdminVehicles("DL3")).rejects.toThrow("Failed to search vehicles");
    });

    it("throws default when response body malformed", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        json: () => Promise.reject(new Error("bad")),
      });
      await expect(searchAdminVehicles("DL3")).rejects.toThrow("Failed to search vehicles");
    });
  });
});
