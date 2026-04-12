import { describe, it, expect, vi, beforeEach } from "vitest";

import {
  getVehicles,
  createVehicle,
  updateVehicle,
  deleteVehicle,
  uploadVehiclePhoto,
  uploadVehicleRc,
  uploadVehicleInsurance,
  searchVehicles,
} from "@/services/vehicles";

const mockFetch = vi.fn();
global.fetch = mockFetch;

const okJson = (data: unknown) => ({
  ok: true,
  json: () => Promise.resolve(data),
});
const errorJson = (msg: string) => ({
  ok: false,
  json: () => Promise.resolve({ error: { message: msg } }),
});
const errorNoJson = () => ({ ok: false, json: () => Promise.reject(new Error("no json")) });

const mockVehicle = {
  id: "veh-1",
  unitId: "unit-1",
  societyId: "soc-1",
  vehicleType: "FOUR_WHEELER",
  registrationNumber: "DL3CAB1234",
  make: "Maruti",
  model: "Swift",
  colour: "White",
  parkingSlot: "A-1",
  fastagId: null,
  notes: null,
  ownerId: "user-1",
  dependentOwnerId: null,
  vehiclePhotoUrl: null,
  rcDocUrl: null,
  rcDocSignedUrl: null,
  rcExpiry: null,
  rcStatus: "NOT_SET",
  insuranceUrl: null,
  insuranceSignedUrl: null,
  insuranceExpiry: null,
  insuranceStatus: "NOT_SET",
  pucExpiry: null,
  pucStatus: "NOT_SET",
  isActive: true,
  createdAt: "2026-04-01T00:00:00Z",
  updatedAt: "2026-04-01T00:00:00Z",
  owner: { name: "Resident User" },
  dependentOwner: null,
};

describe("vehicles service", () => {
  beforeEach(() => vi.clearAllMocks());

  // ── getVehicles ─────────────────────────────────────────────────────────────

  describe("getVehicles", () => {
    it("fetches vehicles without params", async () => {
      mockFetch.mockResolvedValue(
        okJson({ vehicles: [mockVehicle], total: 1, page: 1, limit: 20 }),
      );
      const result = await getVehicles();
      expect(result.vehicles).toHaveLength(1);
      expect(mockFetch).toHaveBeenCalledWith("/api/v1/residents/me/vehicles");
    });

    it("passes page and limit as query params", async () => {
      mockFetch.mockResolvedValue(okJson({ vehicles: [], total: 0, page: 2, limit: 10 }));
      await getVehicles({ page: 2, limit: 10 });
      expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining("page=2"));
      expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining("limit=10"));
    });

    it("throws on non-ok response", async () => {
      mockFetch.mockResolvedValue({ ok: false });
      await expect(getVehicles()).rejects.toThrow("Failed to fetch vehicles");
    });
  });

  // ── createVehicle ───────────────────────────────────────────────────────────

  describe("createVehicle", () => {
    const input = {
      registrationNumber: "DL3CAB1234",
      vehicleType: "FOUR_WHEELER" as const,
      unitId: "00000000-0000-4000-8000-000000000001",
    };

    it("creates vehicle via POST", async () => {
      mockFetch.mockResolvedValue(okJson({ vehicle: mockVehicle }));
      const result = await createVehicle(input);
      expect(result.id).toBe("veh-1");
      expect(mockFetch).toHaveBeenCalledWith(
        "/api/v1/residents/me/vehicles",
        expect.objectContaining({ method: "POST" }),
      );
    });

    it("throws error message from API on failure", async () => {
      mockFetch.mockResolvedValue(errorJson("Duplicate registration number"));
      await expect(createVehicle(input)).rejects.toThrow("Duplicate registration number");
    });

    it("throws fallback message when error has no json", async () => {
      mockFetch.mockResolvedValue(errorNoJson());
      await expect(createVehicle(input)).rejects.toThrow("Failed to create vehicle");
    });
  });

  // ── updateVehicle ───────────────────────────────────────────────────────────

  describe("updateVehicle", () => {
    it("updates vehicle via PATCH", async () => {
      mockFetch.mockResolvedValue(okJson({ vehicle: { ...mockVehicle, colour: "Blue" } }));
      const result = await updateVehicle("veh-1", { colour: "Blue" });
      expect(result.colour).toBe("Blue");
      expect(mockFetch).toHaveBeenCalledWith(
        "/api/v1/residents/me/vehicles/veh-1",
        expect.objectContaining({ method: "PATCH" }),
      );
    });

    it("throws error message from API on failure", async () => {
      mockFetch.mockResolvedValue(errorJson("Not found"));
      await expect(updateVehicle("veh-1", {})).rejects.toThrow("Not found");
    });

    it("throws fallback when error has no json", async () => {
      mockFetch.mockResolvedValue(errorNoJson());
      await expect(updateVehicle("veh-1", {})).rejects.toThrow("Failed to update vehicle");
    });
  });

  // ── deleteVehicle ───────────────────────────────────────────────────────────

  describe("deleteVehicle", () => {
    it("deletes vehicle via DELETE", async () => {
      mockFetch.mockResolvedValue({ ok: true });
      await deleteVehicle("veh-1");
      expect(mockFetch).toHaveBeenCalledWith("/api/v1/residents/me/vehicles/veh-1", {
        method: "DELETE",
      });
    });

    it("throws error message on failure", async () => {
      mockFetch.mockResolvedValue(errorJson("Not found"));
      await expect(deleteVehicle("veh-1")).rejects.toThrow("Not found");
    });

    it("throws fallback when error has no json", async () => {
      mockFetch.mockResolvedValue(errorNoJson());
      await expect(deleteVehicle("veh-1")).rejects.toThrow("Failed to delete vehicle");
    });
  });

  // ── uploadVehiclePhoto ──────────────────────────────────────────────────────

  describe("uploadVehiclePhoto", () => {
    it("uploads photo via POST with form data", async () => {
      mockFetch.mockResolvedValue(okJson({ url: "https://example.com/photo.jpg" }));
      const file = new File(["content"], "photo.jpg", { type: "image/jpeg" });
      const result = await uploadVehiclePhoto("veh-1", file);
      expect(result.url).toBe("https://example.com/photo.jpg");
      expect(mockFetch).toHaveBeenCalledWith(
        "/api/v1/residents/me/vehicles/veh-1/photo",
        expect.objectContaining({ method: "POST" }),
      );
    });

    it("throws error message on failure", async () => {
      mockFetch.mockResolvedValue(errorJson("File too large"));
      const file = new File(["x"], "photo.jpg", { type: "image/jpeg" });
      await expect(uploadVehiclePhoto("veh-1", file)).rejects.toThrow("File too large");
    });

    it("throws fallback when error has no json", async () => {
      mockFetch.mockResolvedValue(errorNoJson());
      const file = new File(["x"], "photo.jpg", { type: "image/jpeg" });
      await expect(uploadVehiclePhoto("veh-1", file)).rejects.toThrow(
        "Failed to upload vehicle photo",
      );
    });
  });

  // ── uploadVehicleRc ─────────────────────────────────────────────────────────

  describe("uploadVehicleRc", () => {
    it("uploads RC via POST", async () => {
      mockFetch.mockResolvedValue(okJson({ url: "https://example.com/rc.pdf" }));
      const file = new File(["content"], "rc.pdf", { type: "application/pdf" });
      const result = await uploadVehicleRc("veh-1", file);
      expect(result.url).toBe("https://example.com/rc.pdf");
      expect(mockFetch).toHaveBeenCalledWith(
        "/api/v1/residents/me/vehicles/veh-1/rc",
        expect.objectContaining({ method: "POST" }),
      );
    });

    it("throws error message on failure", async () => {
      mockFetch.mockResolvedValue(errorJson("Server error"));
      const file = new File(["x"], "rc.pdf", { type: "application/pdf" });
      await expect(uploadVehicleRc("veh-1", file)).rejects.toThrow("Server error");
    });

    it("throws fallback when error has no json", async () => {
      mockFetch.mockResolvedValue(errorNoJson());
      const file = new File(["x"], "rc.pdf", { type: "application/pdf" });
      await expect(uploadVehicleRc("veh-1", file)).rejects.toThrow("Failed to upload RC document");
    });
  });

  // ── searchVehicles ──────────────────────────────────────────────────────────

  describe("searchVehicles", () => {
    const mockResults = [
      {
        id: "veh-1",
        registrationNumber: "DL3CAB1234",
        vehicleType: "FOUR_WHEELER",
        make: "Maruti",
        model: "Swift",
        colour: "White",
        unit: { displayLabel: "A-101" },
        owner: { name: "Resident User" },
        dependentOwner: null,
      },
    ];

    it("fetches vehicles by search query", async () => {
      mockFetch.mockResolvedValue(okJson({ vehicles: mockResults }));
      const result = await searchVehicles("DL3");
      expect(result).toHaveLength(1);
      expect(result[0].registrationNumber).toBe("DL3CAB1234");
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/v1/residents/me/vehicles/search?q=DL3"),
      );
    });

    it("throws error message from API on failure", async () => {
      mockFetch.mockResolvedValue(errorJson("Search query must be at least 3 characters"));
      await expect(searchVehicles("DL")).rejects.toThrow(
        "Search query must be at least 3 characters",
      );
    });

    it("throws fallback message when error has no json", async () => {
      mockFetch.mockResolvedValue(errorNoJson());
      await expect(searchVehicles("DL3")).rejects.toThrow("Failed to search vehicles");
    });
  });

  // ── uploadVehicleInsurance ──────────────────────────────────────────────────

  describe("uploadVehicleInsurance", () => {
    it("uploads insurance via POST", async () => {
      mockFetch.mockResolvedValue(okJson({ url: "https://example.com/ins.pdf" }));
      const file = new File(["content"], "ins.pdf", { type: "application/pdf" });
      const result = await uploadVehicleInsurance("veh-1", file);
      expect(result.url).toBe("https://example.com/ins.pdf");
      expect(mockFetch).toHaveBeenCalledWith(
        "/api/v1/residents/me/vehicles/veh-1/insurance",
        expect.objectContaining({ method: "POST" }),
      );
    });

    it("throws error message on failure", async () => {
      mockFetch.mockResolvedValue(errorJson("Server error"));
      const file = new File(["x"], "ins.pdf", { type: "application/pdf" });
      await expect(uploadVehicleInsurance("veh-1", file)).rejects.toThrow("Server error");
    });

    it("throws fallback when error has no json", async () => {
      mockFetch.mockResolvedValue(errorNoJson());
      const file = new File(["x"], "ins.pdf", { type: "application/pdf" });
      await expect(uploadVehicleInsurance("veh-1", file)).rejects.toThrow(
        "Failed to upload insurance document",
      );
    });
  });
});
