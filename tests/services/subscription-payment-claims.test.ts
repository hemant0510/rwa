import { describe, it, expect, vi, beforeEach } from "vitest";

import {
  submitSubscriptionClaim,
  getMySubscriptionClaims,
  getSaSubscriptionClaims,
  getSaPendingSubClaimsCount,
  verifySubscriptionClaim,
  rejectSubscriptionClaim,
} from "@/services/subscription-payment-claims";

const mockFetch = vi.fn();
global.fetch = mockFetch;

const SOCIETY_ID = "soc-1";
const CLAIM_ID = "claim-1";

const mockClaim = {
  id: CLAIM_ID,
  societyId: SOCIETY_ID,
  amount: 5000,
  utrNumber: "UTR1234567890",
  paymentDate: "2026-04-01",
  periodStart: "2026-04-01",
  periodEnd: "2026-06-30",
  status: "PENDING",
};

const validSubmitData = {
  amount: 5000,
  utrNumber: "UTR1234567890",
  paymentDate: "2026-04-01",
  periodStart: "2026-04-01",
  periodEnd: "2026-06-30",
};

describe("subscription-payment-claims service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── submitSubscriptionClaim ─────────────────────────────────────────────────

  describe("submitSubscriptionClaim", () => {
    it("POSTs claim data to the society endpoint and returns created claim", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ claim: mockClaim }),
      });
      const result = await submitSubscriptionClaim(SOCIETY_ID, validSubmitData);
      expect(result.claim.utrNumber).toBe("UTR1234567890");
      expect(mockFetch).toHaveBeenCalledWith(
        `/api/v1/societies/${SOCIETY_ID}/subscription-payment-claims`,
        expect.objectContaining({
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(validSubmitData),
        }),
      );
    });

    it("includes screenshotUrl when provided", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ claim: mockClaim }),
      });
      await submitSubscriptionClaim(SOCIETY_ID, {
        ...validSubmitData,
        screenshotUrl: "https://example.com/ss.png",
      });
      const body = JSON.parse(mockFetch.mock.calls[0][1].body as string);
      expect(body.screenshotUrl).toBe("https://example.com/ss.png");
    });

    it("throws with server error text on failure", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        text: () => Promise.resolve("DUPLICATE_CLAIM"),
      });
      await expect(submitSubscriptionClaim(SOCIETY_ID, validSubmitData)).rejects.toThrow(
        "DUPLICATE_CLAIM",
      );
    });
  });

  // ── getMySubscriptionClaims ─────────────────────────────────────────────────

  describe("getMySubscriptionClaims", () => {
    it("GETs the society's subscription claims list", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ claims: [mockClaim] }),
      });
      const result = await getMySubscriptionClaims(SOCIETY_ID);
      expect(result.claims).toHaveLength(1);
      expect(result.claims[0].utrNumber).toBe("UTR1234567890");
      expect(mockFetch).toHaveBeenCalledWith(
        `/api/v1/societies/${SOCIETY_ID}/subscription-payment-claims`,
      );
    });

    it("throws on error response", async () => {
      mockFetch.mockResolvedValue({ ok: false });
      await expect(getMySubscriptionClaims(SOCIETY_ID)).rejects.toThrow(
        "Failed to fetch sub claims",
      );
    });
  });

  // ── getSaSubscriptionClaims ─────────────────────────────────────────────────

  describe("getSaSubscriptionClaims", () => {
    it("GETs super-admin subscription claims without params", async () => {
      const mockResponse = { claims: [mockClaim], total: 1, page: 1, pageSize: 10 };
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      });
      const result = await getSaSubscriptionClaims();
      expect(result.claims).toHaveLength(1);
      expect(result.total).toBe(1);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/v1/super-admin/subscription-payment-claims?"),
      );
    });

    it("appends status, page, and pageSize as query params", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ claims: [], total: 0, page: 2, pageSize: 5 }),
      });
      await getSaSubscriptionClaims({ status: "VERIFIED", page: 2, pageSize: 5 });
      const url = mockFetch.mock.calls[0][0] as string;
      expect(url).toContain("status=VERIFIED");
      expect(url).toContain("page=2");
      expect(url).toContain("pageSize=5");
    });

    it("throws on error response", async () => {
      mockFetch.mockResolvedValue({ ok: false });
      await expect(getSaSubscriptionClaims()).rejects.toThrow(
        "Failed to fetch subscription claims",
      );
    });
  });

  // ── getSaPendingSubClaimsCount ──────────────────────────────────────────────

  describe("getSaPendingSubClaimsCount", () => {
    it("GETs the pending subscription claims count", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ count: 7 }),
      });
      const result = await getSaPendingSubClaimsCount();
      expect(result.count).toBe(7);
      expect(mockFetch).toHaveBeenCalledWith(
        "/api/v1/super-admin/subscription-payment-claims/pending-count",
      );
    });

    it("throws on error response", async () => {
      mockFetch.mockResolvedValue({ ok: false });
      await expect(getSaPendingSubClaimsCount()).rejects.toThrow("Failed to fetch count");
    });
  });

  // ── verifySubscriptionClaim ─────────────────────────────────────────────────

  describe("verifySubscriptionClaim", () => {
    it("PATCHes the verify endpoint and returns updated claim", async () => {
      const verifiedClaim = { ...mockClaim, status: "VERIFIED" };
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ claim: verifiedClaim }),
      });
      const result = await verifySubscriptionClaim(CLAIM_ID);
      expect(result.claim.status).toBe("VERIFIED");
      expect(mockFetch).toHaveBeenCalledWith(
        `/api/v1/super-admin/subscription-payment-claims/${CLAIM_ID}/verify`,
        expect.objectContaining({
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        }),
      );
    });

    it("throws with server error text on failure", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        text: () => Promise.resolve("NOT_FOUND"),
      });
      await expect(verifySubscriptionClaim(CLAIM_ID)).rejects.toThrow("NOT_FOUND");
    });
  });

  // ── rejectSubscriptionClaim ─────────────────────────────────────────────────

  describe("rejectSubscriptionClaim", () => {
    it("PATCHes the reject endpoint with reason and returns updated claim", async () => {
      const rejectedClaim = { ...mockClaim, status: "REJECTED" };
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ claim: rejectedClaim }),
      });
      const result = await rejectSubscriptionClaim(CLAIM_ID, "Invalid UTR");
      expect(result.claim.status).toBe("REJECTED");
      expect(mockFetch).toHaveBeenCalledWith(
        `/api/v1/super-admin/subscription-payment-claims/${CLAIM_ID}/reject`,
        expect.objectContaining({
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ rejectionReason: "Invalid UTR" }),
        }),
      );
    });

    it("throws with server error text on failure", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        text: () => Promise.resolve("CLAIM_ALREADY_REJECTED"),
      });
      await expect(rejectSubscriptionClaim(CLAIM_ID, "reason")).rejects.toThrow(
        "CLAIM_ALREADY_REJECTED",
      );
    });
  });
});
