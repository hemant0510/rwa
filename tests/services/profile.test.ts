import { describe, it, expect, vi, beforeEach } from "vitest";

import { updateProfileDeclarations } from "@/services/profile";

const mockFetch = vi.fn();
global.fetch = mockFetch;

function okJson(data: unknown) {
  return { ok: true, json: () => Promise.resolve(data) };
}
function errJson(data: unknown) {
  return { ok: false, json: () => Promise.resolve(data) };
}

describe("profile service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("updateProfileDeclarations", () => {
    it("sends PATCH request with JSON body", async () => {
      mockFetch.mockResolvedValue(
        okJson({
          bloodGroup: "O_POS",
          householdStatus: "NOT_SET",
          vehicleStatus: "NOT_SET",
          completeness: { percentage: 50, tier: "STANDARD" },
        }),
      );
      const result = await updateProfileDeclarations({ bloodGroup: "O_POS" });
      expect(mockFetch).toHaveBeenCalledWith(
        "/api/v1/residents/me/profile",
        expect.objectContaining({
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ bloodGroup: "O_POS" }),
        }),
      );
      expect(result.bloodGroup).toBe("O_POS");
      expect(result.completeness.percentage).toBe(50);
    });

    it("sends household/vehicle declarations", async () => {
      mockFetch.mockResolvedValue(
        okJson({
          bloodGroup: null,
          householdStatus: "DECLARED_NONE",
          vehicleStatus: "DECLARED_NONE",
          completeness: { percentage: 20, tier: "BASIC" },
        }),
      );
      await updateProfileDeclarations({
        householdStatus: "DECLARED_NONE",
        vehicleStatus: "DECLARED_NONE",
      });
      expect(mockFetch).toHaveBeenCalledWith(
        "/api/v1/residents/me/profile",
        expect.objectContaining({
          body: JSON.stringify({
            householdStatus: "DECLARED_NONE",
            vehicleStatus: "DECLARED_NONE",
          }),
        }),
      );
    });

    it("throws with API error message when response is not ok", async () => {
      mockFetch.mockResolvedValue(errJson({ error: { message: "Invalid body" } }));
      await expect(updateProfileDeclarations({ bloodGroup: "X" })).rejects.toThrow("Invalid body");
    });

    it("throws with default message when error body lacks message", async () => {
      mockFetch.mockResolvedValue(errJson({}));
      await expect(updateProfileDeclarations({ bloodGroup: "X" })).rejects.toThrow(
        "Failed to update profile",
      );
    });
  });
});
