import { describe, it, expect, vi, beforeEach } from "vitest";

import {
  getSAProfile,
  updateSAProfile,
  changeSAPassword,
  getPlatformConfig,
  updatePlatformConfig,
} from "@/services/sa-settings";

const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("sa-settings service", () => {
  beforeEach(() => vi.clearAllMocks());

  it("getSAProfile fetches profile", async () => {
    mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve({ id: "sa-1" }) });
    const result = await getSAProfile();
    expect(result.id).toBe("sa-1");
    expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining("/settings/profile"));
  });

  it("getSAProfile throws on error", async () => {
    mockFetch.mockResolvedValue({ ok: false });
    await expect(getSAProfile()).rejects.toThrow();
  });

  it("updateSAProfile sends PATCH", async () => {
    mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve({ id: "sa-1" }) });
    await updateSAProfile({ name: "New Name" });
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/profile"),
      expect.objectContaining({ method: "PATCH" }),
    );
  });

  it("updateSAProfile throws on error", async () => {
    mockFetch.mockResolvedValue({ ok: false });
    await expect(updateSAProfile({ name: "Test" })).rejects.toThrow();
  });

  it("changeSAPassword sends POST", async () => {
    mockFetch.mockResolvedValue({ ok: true });
    await changeSAPassword({
      currentPassword: "old",
      newPassword: "new12345",
      confirmPassword: "new12345",
    });
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/change-password"),
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("changeSAPassword throws with error message", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ error: { message: "Wrong password" } }),
    });
    await expect(
      changeSAPassword({
        currentPassword: "old",
        newPassword: "new12345",
        confirmPassword: "new12345",
      }),
    ).rejects.toThrow("Wrong password");
  });

  it("changeSAPassword throws fallback message", async () => {
    mockFetch.mockResolvedValue({ ok: false, json: () => Promise.resolve({}) });
    await expect(
      changeSAPassword({ currentPassword: "old", newPassword: "new", confirmPassword: "new" }),
    ).rejects.toThrow("Failed to change password");
  });

  it("getPlatformConfig fetches config", async () => {
    mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve({ trial_days: 14 }) });
    const result = await getPlatformConfig();
    expect(result.trial_days).toBe(14);
  });

  it("getPlatformConfig throws on error", async () => {
    mockFetch.mockResolvedValue({ ok: false });
    await expect(getPlatformConfig()).rejects.toThrow();
  });

  it("updatePlatformConfig sends PATCH", async () => {
    mockFetch.mockResolvedValue({ ok: true });
    await updatePlatformConfig({ trial_days: 30 });
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/platform-config"),
      expect.objectContaining({ method: "PATCH" }),
    );
  });

  it("updatePlatformConfig throws on error", async () => {
    mockFetch.mockResolvedValue({ ok: false });
    await expect(updatePlatformConfig({ trial_days: 30 })).rejects.toThrow();
  });
});
