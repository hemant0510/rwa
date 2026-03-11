import { describe, it, expect, vi, beforeEach } from "vitest";

import { getBroadcasts, sendBroadcast } from "@/services/notifications";

const mockFetch = vi.fn();
global.fetch = mockFetch;

function okJson(data: unknown) {
  return { ok: true, json: () => Promise.resolve(data) };
}
function errJson(data: unknown) {
  return { ok: false, json: () => Promise.resolve(data) };
}

describe("notifications service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getBroadcasts", () => {
    it("fetches broadcasts", async () => {
      mockFetch.mockResolvedValue(okJson({ data: [] }));
      const result = await getBroadcasts("soc-1");
      expect(result.data).toEqual([]);
    });

    it("throws on error", async () => {
      mockFetch.mockResolvedValue({ ok: false });
      await expect(getBroadcasts("soc-1")).rejects.toThrow();
    });
  });

  describe("sendBroadcast", () => {
    it("sends POST with broadcast data", async () => {
      mockFetch.mockResolvedValue(okJson({ message: "Sent" }));
      await sendBroadcast("soc-1", { message: "Hello!", recipientFilter: "ALL" });
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/broadcasts"),
        expect.objectContaining({ method: "POST" }),
      );
    });

    it("throws with API error", async () => {
      mockFetch.mockResolvedValue(errJson({ error: { message: "No recipients" } }));
      await expect(
        sendBroadcast("soc-1", { message: "Hello", recipientFilter: "ALL" }),
      ).rejects.toThrow("No recipients");
    });

    it("throws with fallback message when no error message", async () => {
      mockFetch.mockResolvedValue(errJson({}));
      await expect(
        sendBroadcast("soc-1", { message: "Hello", recipientFilter: "ALL" }),
      ).rejects.toThrow("Failed to send broadcast");
    });
  });
});
