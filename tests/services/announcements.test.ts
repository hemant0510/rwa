import { describe, it, expect, vi, beforeEach } from "vitest";

import {
  getAnnouncements,
  createAnnouncement,
  getAnnouncementDetail,
  getUnreadAnnouncements,
  markAnnouncementRead,
} from "@/services/announcements";

const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("announcements service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getAnnouncements", () => {
    it("fetches announcements from SA endpoint", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([{ id: "ann-1" }]),
      });
      const result = await getAnnouncements();
      expect(result).toHaveLength(1);
      expect(mockFetch).toHaveBeenCalledWith("/api/v1/super-admin/announcements");
    });

    it("throws on non-ok response", async () => {
      mockFetch.mockResolvedValue({ ok: false });
      await expect(getAnnouncements()).rejects.toThrow("Failed to fetch announcements");
    });
  });

  describe("createAnnouncement", () => {
    it("creates announcement via POST", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ id: "ann-new" }),
      });
      const result = await createAnnouncement({
        subject: "Test",
        body: "Test body content",
        priority: "NORMAL",
        scope: "ALL",
        sentVia: ["IN_APP"],
      });
      expect(result.id).toBe("ann-new");
      expect(mockFetch).toHaveBeenCalledWith(
        "/api/v1/super-admin/announcements",
        expect.objectContaining({ method: "POST" }),
      );
    });

    it("throws with error message on non-ok response", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ error: { message: "Validation failed" } }),
      });
      await expect(
        createAnnouncement({
          subject: "Test",
          body: "Test body content",
          priority: "NORMAL",
          scope: "ALL",
          sentVia: ["IN_APP"],
        }),
      ).rejects.toThrow("Validation failed");
    });

    it("throws fallback message when error has no message", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({}),
      });
      await expect(
        createAnnouncement({
          subject: "Test",
          body: "Test body content",
          priority: "NORMAL",
          scope: "ALL",
          sentVia: ["IN_APP"],
        }),
      ).rejects.toThrow("Failed to create announcement");
    });
  });

  describe("getAnnouncementDetail", () => {
    it("fetches detail from SA endpoint", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ id: "ann-1", totalTargeted: 10 }),
      });
      const result = await getAnnouncementDetail("ann-1");
      expect(result.totalTargeted).toBe(10);
      expect(mockFetch).toHaveBeenCalledWith("/api/v1/super-admin/announcements/ann-1");
    });

    it("throws on non-ok response", async () => {
      mockFetch.mockResolvedValue({ ok: false });
      await expect(getAnnouncementDetail("ann-1")).rejects.toThrow(
        "Failed to fetch announcement detail",
      );
    });
  });

  describe("getUnreadAnnouncements", () => {
    it("fetches from admin endpoint", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve([]),
      });
      const result = await getUnreadAnnouncements();
      expect(result).toEqual([]);
      expect(mockFetch).toHaveBeenCalledWith("/api/v1/admin/announcements");
    });

    it("throws on non-ok response", async () => {
      mockFetch.mockResolvedValue({ ok: false });
      await expect(getUnreadAnnouncements()).rejects.toThrow(
        "Failed to fetch unread announcements",
      );
    });
  });

  describe("markAnnouncementRead", () => {
    it("posts to admin read endpoint", async () => {
      mockFetch.mockResolvedValue({ ok: true });
      await markAnnouncementRead("ann-1");
      expect(mockFetch).toHaveBeenCalledWith("/api/v1/admin/announcements/ann-1/read", {
        method: "POST",
      });
    });

    it("throws on non-ok response", async () => {
      mockFetch.mockResolvedValue({ ok: false });
      await expect(markAnnouncementRead("ann-1")).rejects.toThrow(
        "Failed to mark announcement as read",
      );
    });
  });
});
