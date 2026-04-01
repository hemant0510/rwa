import { describe, it, expect, vi, beforeEach } from "vitest";

import {
  getAdminRequests,
  createRequest,
  getAdminRequestDetail,
  postAdminMessage,
  reopenRequest,
  getUnreadCount,
  getSARequests,
  getSAStats,
  getSARequestDetail,
  postSAMessage,
  changeSAStatus,
} from "@/services/support";

const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("support service", () => {
  beforeEach(() => vi.clearAllMocks());

  describe("admin API", () => {
    it("getAdminRequests fetches with filters", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: [], total: 0 }),
      });
      await getAdminRequests({ status: "OPEN" });
      expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining("status=OPEN"));
    });

    it("getAdminRequests omits empty filter values", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: [], total: 0 }),
      });
      await getAdminRequests({ status: "", page: "1" });
      const url = mockFetch.mock.calls[0][0] as string;
      expect(url).not.toContain("status=");
      expect(url).toContain("page=1");
    });

    it("getAdminRequests throws on error", async () => {
      mockFetch.mockResolvedValue({ ok: false });
      await expect(getAdminRequests()).rejects.toThrow();
    });

    it("createRequest posts data", async () => {
      mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve({ id: "r-1" }) });
      const result = await createRequest({
        type: "BUG_REPORT",
        subject: "Test issue",
        description: "Long enough description here",
      });
      expect(result.id).toBe("r-1");
    });

    it("createRequest throws with error message", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ error: { message: "Validation failed" } }),
      });
      await expect(
        createRequest({
          type: "BUG_REPORT",
          subject: "Test",
          description: "Long enough description",
        }),
      ).rejects.toThrow("Validation failed");
    });

    it("createRequest throws fallback message", async () => {
      mockFetch.mockResolvedValue({ ok: false, json: () => Promise.resolve({}) });
      await expect(
        createRequest({ type: "BUG_REPORT", subject: "Test", description: "Desc" }),
      ).rejects.toThrow("Failed to create request");
    });

    it("getAdminRequestDetail fetches by id", async () => {
      mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve({ id: "r-1" }) });
      await getAdminRequestDetail("r-1");
      expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining("/admin/support/r-1"));
    });

    it("getAdminRequestDetail throws on error", async () => {
      mockFetch.mockResolvedValue({ ok: false });
      await expect(getAdminRequestDetail("r-1")).rejects.toThrow();
    });

    it("postAdminMessage posts content", async () => {
      mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve({ id: "msg-1" }) });
      await postAdminMessage("r-1", { content: "Reply" });
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/r-1/messages"),
        expect.objectContaining({ method: "POST" }),
      );
    });

    it("postAdminMessage throws on error", async () => {
      mockFetch.mockResolvedValue({ ok: false });
      await expect(postAdminMessage("r-1", { content: "Test" })).rejects.toThrow();
    });

    it("reopenRequest posts to reopen endpoint", async () => {
      mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve({}) });
      await reopenRequest("r-1");
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/r-1/reopen"),
        expect.objectContaining({ method: "POST" }),
      );
    });

    it("reopenRequest throws with error message", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ error: { message: "Expired" } }),
      });
      await expect(reopenRequest("r-1")).rejects.toThrow("Expired");
    });

    it("reopenRequest throws fallback", async () => {
      mockFetch.mockResolvedValue({ ok: false, json: () => Promise.resolve({}) });
      await expect(reopenRequest("r-1")).rejects.toThrow("Failed to reopen");
    });

    it("getUnreadCount fetches count", async () => {
      mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve({ count: 5 }) });
      const result = await getUnreadCount();
      expect(result.count).toBe(5);
    });

    it("getUnreadCount throws on error", async () => {
      mockFetch.mockResolvedValue({ ok: false });
      await expect(getUnreadCount()).rejects.toThrow();
    });
  });

  describe("SA API", () => {
    it("getSARequests fetches with filters", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ data: [], total: 0 }),
      });
      await getSARequests({ societyId: "soc-1" });
      expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining("societyId=soc-1"));
    });

    it("getSARequests throws on error", async () => {
      mockFetch.mockResolvedValue({ ok: false });
      await expect(getSARequests()).rejects.toThrow();
    });

    it("getSAStats fetches stats", async () => {
      mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve({ open: 5 }) });
      const result = await getSAStats();
      expect(result.open).toBe(5);
    });

    it("getSAStats throws on error", async () => {
      mockFetch.mockResolvedValue({ ok: false });
      await expect(getSAStats()).rejects.toThrow();
    });

    it("getSARequestDetail fetches by id", async () => {
      mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve({ id: "r-1" }) });
      await getSARequestDetail("r-1");
      expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining("/super-admin/support/r-1"));
    });

    it("getSARequestDetail throws on error", async () => {
      mockFetch.mockResolvedValue({ ok: false });
      await expect(getSARequestDetail("r-1")).rejects.toThrow();
    });

    it("postSAMessage posts content", async () => {
      mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve({ id: "msg-1" }) });
      await postSAMessage("r-1", { content: "Reply" });
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/super-admin/support/r-1/messages"),
        expect.objectContaining({ method: "POST" }),
      );
    });

    it("postSAMessage throws on error", async () => {
      mockFetch.mockResolvedValue({ ok: false });
      await expect(postSAMessage("r-1", { content: "Test" })).rejects.toThrow();
    });

    it("changeSAStatus sends PATCH", async () => {
      mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve({}) });
      await changeSAStatus("r-1", "RESOLVED");
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/r-1/status"),
        expect.objectContaining({ method: "PATCH" }),
      );
    });

    it("changeSAStatus throws with error message", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ error: { message: "Invalid" } }),
      });
      await expect(changeSAStatus("r-1", "OPEN")).rejects.toThrow("Invalid");
    });

    it("changeSAStatus throws fallback", async () => {
      mockFetch.mockResolvedValue({ ok: false, json: () => Promise.resolve({}) });
      await expect(changeSAStatus("r-1", "OPEN")).rejects.toThrow("Failed to change status");
    });
  });
});
