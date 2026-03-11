import { describe, it, expect, vi, beforeEach } from "vitest";

import {
  getResidents,
  getResident,
  approveResident,
  rejectResident,
  updateResident,
  deleteResident,
  permanentDeleteResident,
  sendResidentVerificationEmail,
  bulkUploadResidents,
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

    it("throws with fallback message when no error message", async () => {
      mockFetch.mockResolvedValue(errJson({}));
      await expect(updateResident("res-1", {})).rejects.toThrow("Failed to update resident");
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

    it("throws with fallback message when no error message", async () => {
      mockFetch.mockResolvedValue(errJson({}));
      await expect(deleteResident("res-1", "reason")).rejects.toThrow(
        "Failed to deactivate resident",
      );
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

    it("throws with fallback message when no error message", async () => {
      mockFetch.mockResolvedValue(errJson({}));
      await expect(permanentDeleteResident("res-1")).rejects.toThrow(
        "Failed to permanently delete resident",
      );
    });
  });

  describe("getResidents — new filter params", () => {
    it("passes limit param", async () => {
      mockFetch.mockResolvedValue(okJson({ data: [], total: 0, page: 1, limit: 50 }));
      await getResidents("soc-1", { limit: 50 });
      expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining("limit=50"));
    });

    it("passes emailVerified=true param", async () => {
      mockFetch.mockResolvedValue(okJson({ data: [], total: 0, page: 1, limit: 20 }));
      await getResidents("soc-1", { emailVerified: "true" });
      expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining("emailVerified=true"));
    });

    it("passes emailVerified=false param", async () => {
      mockFetch.mockResolvedValue(okJson({ data: [], total: 0, page: 1, limit: 20 }));
      await getResidents("soc-1", { emailVerified: "false" });
      expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining("emailVerified=false"));
    });

    it("passes ownershipType param when not 'all'", async () => {
      mockFetch.mockResolvedValue(okJson({ data: [], total: 0, page: 1, limit: 20 }));
      await getResidents("soc-1", { ownershipType: "OWNER" });
      expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining("ownershipType=OWNER"));
    });

    it("omits ownershipType when value is 'all'", async () => {
      mockFetch.mockResolvedValue(okJson({ data: [], total: 0, page: 1, limit: 20 }));
      await getResidents("soc-1", { ownershipType: "all" });
      expect(mockFetch).not.toHaveBeenCalledWith(expect.stringContaining("ownershipType="));
    });

    it("passes year param when not 'all'", async () => {
      mockFetch.mockResolvedValue(okJson({ data: [], total: 0, page: 1, limit: 20 }));
      await getResidents("soc-1", { year: "2026" });
      expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining("year=2026"));
    });

    it("omits year when value is 'all'", async () => {
      mockFetch.mockResolvedValue(okJson({ data: [], total: 0, page: 1, limit: 20 }));
      await getResidents("soc-1", { year: "all" });
      expect(mockFetch).not.toHaveBeenCalledWith(expect.stringContaining("year="));
    });
  });

  describe("sendResidentVerificationEmail", () => {
    it("sends POST to send-verification endpoint", async () => {
      mockFetch.mockResolvedValue(okJson({ success: true, message: "Sent" }));
      const result = await sendResidentVerificationEmail("res-1");
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/residents/res-1/send-verification"),
        expect.objectContaining({ method: "POST" }),
      );
      expect(result.success).toBe(true);
    });

    it("throws with API error message on failure", async () => {
      mockFetch.mockResolvedValue(errJson({ error: { message: "Email not configured" } }));
      await expect(sendResidentVerificationEmail("res-1")).rejects.toThrow("Email not configured");
    });

    it("throws with fallback message when no error message", async () => {
      mockFetch.mockResolvedValue(errJson({}));
      await expect(sendResidentVerificationEmail("res-1")).rejects.toThrow(
        "Failed to send verification email",
      );
    });
  });

  describe("bulkUploadResidents", () => {
    const records = [
      { fullName: "John", email: "j@e.com", mobile: "9876543210", ownershipType: "OWNER" as const },
    ];

    it("sends POST with societyCode and records", async () => {
      mockFetch.mockResolvedValue(
        okJson({ results: [{ rowIndex: 0, success: true, rwaid: "RWAID-001" }] }),
      );
      const result = await bulkUploadResidents("EDEN", records);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/residents/bulk-upload"),
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ societyCode: "EDEN", records }),
        }),
      );
      expect(result.results[0].success).toBe(true);
    });

    it("throws with API error message on failure", async () => {
      mockFetch.mockResolvedValue(errJson({ error: { message: "Society not found" } }));
      await expect(bulkUploadResidents("BAD", records)).rejects.toThrow("Society not found");
    });

    it("throws with fallback message when no error message", async () => {
      mockFetch.mockResolvedValue(errJson({}));
      await expect(bulkUploadResidents("EDEN", records)).rejects.toThrow("Bulk upload failed");
    });
  });
});
