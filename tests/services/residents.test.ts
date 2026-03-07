import { describe, it, expect, vi, beforeEach } from "vitest";

import {
  getResidents,
  getResident,
  approveResident,
  rejectResident,
  updateResident,
  deleteResident,
  permanentDeleteResident,
} from "@/services/residents";

const mockFetch = vi.fn();
global.fetch = mockFetch;

function okJson(data: unknown) {
  return { ok: true, json: () => Promise.resolve(data) };
}
function errJson(data: unknown) {
  return { ok: false, json: () => Promise.resolve(data) };
}

describe("residents service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getResidents", () => {
    it("fetches residents with params", async () => {
      mockFetch.mockResolvedValue(okJson({ data: [], total: 0 }));
      await getResidents("soc-1", { status: "ACTIVE_PAID", search: "hem", page: 2 });
      expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining("societyId=soc-1"));
      expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining("status=ACTIVE_PAID"));
      expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining("search=hem"));
      expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining("page=2"));
    });

    it("throws on error", async () => {
      mockFetch.mockResolvedValue({ ok: false });
      await expect(getResidents("soc-1")).rejects.toThrow("Failed to fetch residents");
    });
  });

  describe("getResident", () => {
    it("fetches a single resident", async () => {
      mockFetch.mockResolvedValue(okJson({ id: "res-1", name: "Test" }));
      const result = await getResident("res-1");
      expect(result.id).toBe("res-1");
    });

    it("throws on error", async () => {
      mockFetch.mockResolvedValue({ ok: false });
      await expect(getResident("res-1")).rejects.toThrow("Failed to fetch resident");
    });
  });

  describe("approveResident", () => {
    it("sends PATCH request", async () => {
      mockFetch.mockResolvedValue(okJson({ message: "Approved" }));
      await approveResident("res-1");
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/residents/res-1/approve"),
        expect.objectContaining({ method: "PATCH" }),
      );
    });

    it("throws on error", async () => {
      mockFetch.mockResolvedValue({ ok: false });
      await expect(approveResident("res-1")).rejects.toThrow();
    });
  });

  describe("rejectResident", () => {
    it("sends PATCH with reason", async () => {
      mockFetch.mockResolvedValue(okJson({ message: "Rejected" }));
      await rejectResident("res-1", "Not eligible");
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/residents/res-1/reject"),
        expect.objectContaining({
          method: "PATCH",
          body: JSON.stringify({ reason: "Not eligible" }),
        }),
      );
    });
  });

  describe("updateResident", () => {
    it("sends PATCH with data", async () => {
      mockFetch.mockResolvedValue(okJson({ id: "res-1", name: "Updated" }));
      const result = await updateResident("res-1", { name: "Updated" });
      expect(result.name).toBe("Updated");
    });

    it("throws with error message from API", async () => {
      mockFetch.mockResolvedValue(errJson({ error: { message: "Validation failed" } }));
      await expect(updateResident("res-1", {})).rejects.toThrow("Validation failed");
    });
  });

  describe("deleteResident", () => {
    it("sends DELETE with reason", async () => {
      mockFetch.mockResolvedValue(okJson({ message: "Deactivated" }));
      await deleteResident("res-1", "Left society");
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/residents/res-1"),
        expect.objectContaining({ method: "DELETE" }),
      );
    });

    it("throws with error message from API", async () => {
      mockFetch.mockResolvedValue(errJson({ error: { message: "Already deactivated" } }));
      await expect(deleteResident("res-1", "reason")).rejects.toThrow("Already deactivated");
    });
  });

  describe("permanentDeleteResident", () => {
    it("sends POST to permanent-delete", async () => {
      mockFetch.mockResolvedValue(okJson({ message: "Deleted" }));
      await permanentDeleteResident("res-1");
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/residents/res-1/permanent-delete"),
        expect.objectContaining({ method: "POST" }),
      );
    });

    it("throws with error message from API", async () => {
      mockFetch.mockResolvedValue(errJson({ error: { message: "Not deactivated" } }));
      await expect(permanentDeleteResident("res-1")).rejects.toThrow("Not deactivated");
    });
  });
});
