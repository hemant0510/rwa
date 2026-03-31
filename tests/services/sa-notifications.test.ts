import { describe, it, expect, vi, beforeEach } from "vitest";

import { getNotifications } from "@/services/sa-notifications";

const mockFetch = vi.fn();
global.fetch = mockFetch;

function okJson(data: unknown) {
  return { ok: true, json: () => Promise.resolve(data) };
}
function errJson() {
  return { ok: false, json: () => Promise.resolve({ error: "fail" }) };
}

describe("sa-notifications service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getNotifications", () => {
    it("fetches notifications and returns alert array", async () => {
      const alerts = [{ id: "a-1", type: "TRIAL_EXPIRING", priority: "HIGH" }];
      mockFetch.mockResolvedValue(okJson(alerts));
      const result = await getNotifications();
      expect(mockFetch).toHaveBeenCalledWith("/api/v1/super-admin/notifications");
      expect(result).toEqual(alerts);
    });

    it("throws when response is not ok", async () => {
      mockFetch.mockResolvedValue(errJson());
      await expect(getNotifications()).rejects.toThrow("Failed to fetch notifications");
    });
  });
});
