import { describe, it, expect, vi, beforeEach } from "vitest";

import {
  getPaymentSetup,
  getPlatformPaymentSetup,
  updatePlatformUpiSetup,
  updateUpiSetup,
  uploadPlatformQr,
  uploadSocietyQr,
} from "@/services/payment-setup";

const mockFetch = vi.fn();
global.fetch = mockFetch;

const SOCIETY_ID = "soc-1";

const mockUpiSettings = {
  upiId: "society@hdfc",
  upiQrUrl: "https://example.com/qr.png",
  upiAccountName: "Society RWA",
};

const mockPlatformSettings = {
  platformUpiId: "platform@sbi",
  platformUpiQrUrl: "https://example.com/platform-qr.png",
  platformUpiAccountName: "Platform RWA",
};

describe("payment-setup service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── getPaymentSetup ──────────────────────────────────────────────────────

  describe("getPaymentSetup", () => {
    it("fetches UPI settings for a society", async () => {
      mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve(mockUpiSettings) });
      const result = await getPaymentSetup(SOCIETY_ID);
      expect(result.upiId).toBe("society@hdfc");
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining(`/societies/${SOCIETY_ID}/payment-setup`),
      );
    });

    it("throws on error response", async () => {
      mockFetch.mockResolvedValue({ ok: false, json: () => Promise.resolve({}) });
      await expect(getPaymentSetup(SOCIETY_ID)).rejects.toThrow("Failed to fetch payment setup");
    });
  });

  // ── updateUpiSetup ───────────────────────────────────────────────────────

  describe("updateUpiSetup", () => {
    it("PATCHes UPI settings and returns updated data", async () => {
      mockFetch.mockResolvedValue({ ok: true, json: () => Promise.resolve(mockUpiSettings) });
      const result = await updateUpiSetup(SOCIETY_ID, { upiId: "society@hdfc" });
      expect(result.upiId).toBe("society@hdfc");
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining(`/societies/${SOCIETY_ID}/payment-setup/upi`),
        expect.objectContaining({ method: "PATCH" }),
      );
    });

    it("throws with server error text on failure", async () => {
      mockFetch.mockResolvedValue({ ok: false, text: () => Promise.resolve("Unauthorized") });
      await expect(updateUpiSetup(SOCIETY_ID, { upiId: "x@y" })).rejects.toThrow("Unauthorized");
    });
  });

  // ── uploadSocietyQr ──────────────────────────────────────────────────────

  describe("uploadSocietyQr", () => {
    it("POSTs file and returns public URL", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ url: "https://example.com/qr.png" }),
      });
      const file = new File(["content"], "qr.png", { type: "image/png" });
      const result = await uploadSocietyQr(SOCIETY_ID, file);
      expect(result.url).toBe("https://example.com/qr.png");
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining(`/societies/${SOCIETY_ID}/payment-setup/upi/upload-qr`),
        expect.objectContaining({ method: "POST" }),
      );
    });

    it("throws with server error text on failure", async () => {
      mockFetch.mockResolvedValue({ ok: false, text: () => Promise.resolve("File too large") });
      const file = new File(["x"], "qr.png", { type: "image/png" });
      await expect(uploadSocietyQr(SOCIETY_ID, file)).rejects.toThrow("File too large");
    });
  });

  // ── getPlatformPaymentSetup ──────────────────────────────────────────────

  describe("getPlatformPaymentSetup", () => {
    it("fetches platform UPI settings", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockPlatformSettings),
      });
      const result = await getPlatformPaymentSetup();
      expect(result.platformUpiId).toBe("platform@sbi");
      expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining("platform-payment-setup"));
    });

    it("throws on error response", async () => {
      mockFetch.mockResolvedValue({ ok: false, json: () => Promise.resolve({}) });
      await expect(getPlatformPaymentSetup()).rejects.toThrow(
        "Failed to fetch platform payment setup",
      );
    });
  });

  // ── updatePlatformUpiSetup ───────────────────────────────────────────────

  describe("updatePlatformUpiSetup", () => {
    it("PATCHes platform UPI settings and returns updated data", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockPlatformSettings),
      });
      const result = await updatePlatformUpiSetup({ platformUpiId: "platform@sbi" });
      expect(result.platformUpiId).toBe("platform@sbi");
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("platform-payment-setup/upi"),
        expect.objectContaining({ method: "PATCH" }),
      );
    });

    it("throws with server error text on failure", async () => {
      mockFetch.mockResolvedValue({ ok: false, text: () => Promise.resolve("Validation error") });
      await expect(updatePlatformUpiSetup({ platformUpiId: "x@y" })).rejects.toThrow(
        "Validation error",
      );
    });
  });

  // ── uploadPlatformQr ─────────────────────────────────────────────────────

  describe("uploadPlatformQr", () => {
    it("POSTs file and returns public URL", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ url: "https://example.com/platform-qr.png" }),
      });
      const file = new File(["content"], "platform-qr.png", { type: "image/png" });
      const result = await uploadPlatformQr(file);
      expect(result.url).toBe("https://example.com/platform-qr.png");
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("platform-payment-setup/upload-qr"),
        expect.objectContaining({ method: "POST" }),
      );
    });

    it("throws with server error text on failure", async () => {
      mockFetch.mockResolvedValue({ ok: false, text: () => Promise.resolve("Upload failed") });
      const file = new File(["x"], "qr.png", { type: "image/png" });
      await expect(uploadPlatformQr(file)).rejects.toThrow("Upload failed");
    });
  });
});
