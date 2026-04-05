import { describe, it, expect, vi, beforeEach } from "vitest";

import {
  submitPaymentClaim,
  getMyPaymentClaims,
  uploadClaimScreenshot,
  getPaymentClaimsPendingCount,
} from "@/services/payment-claims";

const mockFetch = vi.fn();
global.fetch = mockFetch;

const SOCIETY_ID = "soc-1";

const mockClaim = {
  id: "claim-1",
  membershipFeeId: "fee-1",
  claimedAmount: 2000,
  utrNumber: "ABCD1234567890",
  paymentDate: "2026-04-04",
  status: "PENDING",
};

const validSubmitData = {
  membershipFeeId: "fee-1",
  claimedAmount: 2000,
  utrNumber: "ABCD1234567890",
  paymentDate: "2026-04-04",
};

describe("payment-claims service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── submitPaymentClaim ──────────────────────────────────────────────────────

  describe("submitPaymentClaim", () => {
    it("POSTs claim data and returns created claim", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ claim: mockClaim }),
      });
      const result = await submitPaymentClaim(validSubmitData);
      expect(result.claim.utrNumber).toBe("ABCD1234567890");
      expect(mockFetch).toHaveBeenCalledWith(
        "/api/v1/residents/me/payment-claims",
        expect.objectContaining({ method: "POST" }),
      );
    });

    it("includes screenshotUrl when provided", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ claim: mockClaim }),
      });
      await submitPaymentClaim({ ...validSubmitData, screenshotUrl: "https://example.com/ss.png" });
      const body = JSON.parse(mockFetch.mock.calls[0][1].body as string);
      expect(body.screenshotUrl).toBe("https://example.com/ss.png");
    });

    it("throws with server error text on failure", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        text: () => Promise.resolve("CLAIM_ALREADY_PENDING"),
      });
      await expect(submitPaymentClaim(validSubmitData)).rejects.toThrow("CLAIM_ALREADY_PENDING");
    });
  });

  // ── getMyPaymentClaims ──────────────────────────────────────────────────────

  describe("getMyPaymentClaims", () => {
    it("GETs the resident's claims list", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ claims: [mockClaim] }),
      });
      const result = await getMyPaymentClaims();
      expect(result.claims).toHaveLength(1);
      expect(result.claims[0].utrNumber).toBe("ABCD1234567890");
      expect(mockFetch).toHaveBeenCalledWith("/api/v1/residents/me/payment-claims");
    });

    it("throws on error response", async () => {
      mockFetch.mockResolvedValue({ ok: false });
      await expect(getMyPaymentClaims()).rejects.toThrow("Failed to fetch claims");
    });
  });

  // ── uploadClaimScreenshot ────────────────────────────────────────────────────

  describe("uploadClaimScreenshot", () => {
    it("POSTs file as FormData and returns URL", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ url: "https://example.com/ss.png" }),
      });
      const file = new File(["content"], "ss.png", { type: "image/png" });
      const result = await uploadClaimScreenshot(file);
      expect(result.url).toBe("https://example.com/ss.png");
      expect(mockFetch).toHaveBeenCalledWith(
        "/api/v1/residents/me/payment-claims/upload-screenshot",
        expect.objectContaining({ method: "POST" }),
      );
    });

    it("throws on error response", async () => {
      mockFetch.mockResolvedValue({ ok: false });
      const file = new File(["x"], "ss.png", { type: "image/png" });
      await expect(uploadClaimScreenshot(file)).rejects.toThrow("Upload failed");
    });
  });

  // ── getPaymentClaimsPendingCount ─────────────────────────────────────────────

  describe("getPaymentClaimsPendingCount", () => {
    it("GETs the pending count for a society", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ count: 3 }),
      });
      const result = await getPaymentClaimsPendingCount(SOCIETY_ID);
      expect(result.count).toBe(3);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining(`/societies/${SOCIETY_ID}/payment-claims/pending-count`),
      );
    });

    it("throws on error response", async () => {
      mockFetch.mockResolvedValue({ ok: false });
      await expect(getPaymentClaimsPendingCount(SOCIETY_ID)).rejects.toThrow(
        "Failed to fetch count",
      );
    });
  });
});
