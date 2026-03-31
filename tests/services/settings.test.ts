import { describe, it, expect, vi, beforeEach } from "vitest";

import {
  changePassword,
  getProfile,
  getPlatformConfig,
  updatePlatformConfig,
  updateProfile,
} from "@/services/settings";

const mockFetch = vi.fn();
global.fetch = mockFetch;

const mockProfile = {
  id: "p-1",
  name: "Super Admin",
  email: "admin@superadmin.com",
  createdAt: "2024-01-01T00:00:00Z",
  lastLogin: "2026-03-01T10:00:00Z",
};

const mockConfigs = [
  { key: "trial_duration_days", value: "30", type: "number", label: "Trial Duration (days)" },
];

describe("settings service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getProfile", () => {
    it("fetches profile on success", async () => {
      mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve(mockProfile) });
      const result = await getProfile();
      expect(result.name).toBe("Super Admin");
      expect(result.email).toBe("admin@superadmin.com");
    });

    it("throws on error response", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ error: { message: "Forbidden" } }),
      });
      await expect(getProfile()).rejects.toThrow("Forbidden");
    });

    it("throws fallback message when no error message in response", async () => {
      mockFetch.mockResolvedValue({ ok: false, json: () => Promise.resolve({}) });
      await expect(getProfile()).rejects.toThrow("Request failed");
    });
  });

  describe("updateProfile", () => {
    it("PATCHes profile and returns updated data", async () => {
      const updated = { ...mockProfile, name: "New Name" };
      mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve(updated) });
      const result = await updateProfile({ name: "New Name" });
      expect(result.name).toBe("New Name");
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("profile"),
        expect.objectContaining({ method: "PATCH" }),
      );
    });

    it("throws on error response", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ error: { message: "Validation failed" } }),
      });
      await expect(updateProfile({ name: "X" })).rejects.toThrow("Validation failed");
    });
  });

  describe("changePassword", () => {
    const validBody = {
      currentPassword: "OldPass1!",
      newPassword: "NewPass1!",
      confirmPassword: "NewPass1!",
    };

    it("POSTs change-password on success", async () => {
      mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve({ success: true }) });
      await expect(changePassword(validBody)).resolves.toBeUndefined();
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("change-password"),
        expect.objectContaining({ method: "POST" }),
      );
    });

    it("throws with error message on failure", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ error: { message: "Current password is incorrect" } }),
      });
      await expect(changePassword(validBody)).rejects.toThrow("Current password is incorrect");
    });

    it("throws fallback message when no error message in response", async () => {
      mockFetch.mockResolvedValue({ ok: false, json: () => Promise.resolve({}) });
      await expect(changePassword(validBody)).rejects.toThrow("Failed to change password");
    });
  });

  describe("getPlatformConfig", () => {
    it("fetches platform config", async () => {
      mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve(mockConfigs) });
      const result = await getPlatformConfig();
      expect(result).toHaveLength(1);
      expect(result[0].key).toBe("trial_duration_days");
    });

    it("throws on error response", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ error: { message: "Forbidden" } }),
      });
      await expect(getPlatformConfig()).rejects.toThrow("Forbidden");
    });
  });

  describe("updatePlatformConfig", () => {
    it("PATCHes config and returns updated list", async () => {
      mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve(mockConfigs) });
      const result = await updatePlatformConfig({ trial_duration_days: 60 });
      expect(result).toHaveLength(1);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("platform-config"),
        expect.objectContaining({ method: "PATCH" }),
      );
    });

    it("throws on error response", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ error: { message: "Validation failed" } }),
      });
      await expect(updatePlatformConfig({ trial_duration_days: -1 })).rejects.toThrow(
        "Validation failed",
      );
    });
  });
});
