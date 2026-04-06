import { beforeEach, describe, expect, it, vi } from "vitest";

import {
  getAdminPaymentClaims,
  getAdminPendingClaimsCount,
  rejectClaim,
  verifyClaim,
} from "@/services/admin-payment-claims";

const mockFetch = vi.fn();
global.fetch = mockFetch;

const SOCIETY_ID = "soc-1";
const CLAIM_ID = "claim-1";

const mockClaim = { id: CLAIM_ID, status: "PENDING" };

describe("admin-payment-claims service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── getAdminPaymentClaims ──────────────────────────────────────────────────

  describe("getAdminPaymentClaims", () => {
    it("fetches claims with no params", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ claims: [mockClaim], total: 1, page: 1, pageSize: 20 }),
      });
      const result = await getAdminPaymentClaims(SOCIETY_ID);
      expect(result.claims).toHaveLength(1);
      expect(mockFetch).toHaveBeenCalledWith(`/api/v1/societies/${SOCIETY_ID}/payment-claims?`);
    });

    it("appends status query param", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ claims: [], total: 0, page: 1, pageSize: 20 }),
      });
      await getAdminPaymentClaims(SOCIETY_ID, { status: "PENDING" });
      expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining("status=PENDING"));
    });

    it("appends page and pageSize params", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ claims: [], total: 0, page: 2, pageSize: 5 }),
      });
      await getAdminPaymentClaims(SOCIETY_ID, { page: 2, pageSize: 5 });
      expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining("page=2"));
    });

    it("throws on error response", async () => {
      mockFetch.mockResolvedValue({ ok: false });
      await expect(getAdminPaymentClaims(SOCIETY_ID)).rejects.toThrow("Failed to fetch claims");
    });
  });

  // ── getAdminPendingClaimsCount ─────────────────────────────────────────────

  describe("getAdminPendingClaimsCount", () => {
    it("returns pending count", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ count: 3 }),
      });
      const result = await getAdminPendingClaimsCount(SOCIETY_ID);
      expect(result.count).toBe(3);
      expect(mockFetch).toHaveBeenCalledWith(
        `/api/v1/societies/${SOCIETY_ID}/payment-claims/pending-count`,
      );
    });

    it("throws on error response", async () => {
      mockFetch.mockResolvedValue({ ok: false });
      await expect(getAdminPendingClaimsCount(SOCIETY_ID)).rejects.toThrow(
        "Failed to fetch pending count",
      );
    });
  });

  // ── verifyClaim ────────────────────────────────────────────────────────────

  describe("verifyClaim", () => {
    it("PATCHes verify endpoint and returns claim", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ claim: { ...mockClaim, status: "VERIFIED" } }),
      });
      const result = await verifyClaim(SOCIETY_ID, CLAIM_ID, "Looks good");
      expect(result.claim.status).toBe("VERIFIED");
      expect(mockFetch).toHaveBeenCalledWith(
        `/api/v1/societies/${SOCIETY_ID}/payment-claims/${CLAIM_ID}/verify`,
        expect.objectContaining({
          method: "PATCH",
          body: JSON.stringify({ adminNotes: "Looks good" }),
        }),
      );
    });

    it("throws on error response", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        text: () => Promise.resolve("CLAIM_ALREADY_PROCESSED"),
      });
      await expect(verifyClaim(SOCIETY_ID, CLAIM_ID)).rejects.toThrow("CLAIM_ALREADY_PROCESSED");
    });
  });

  // ── rejectClaim ────────────────────────────────────────────────────────────

  describe("rejectClaim", () => {
    it("PATCHes reject endpoint and returns claim", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ claim: { ...mockClaim, status: "REJECTED" } }),
      });
      const result = await rejectClaim(SOCIETY_ID, CLAIM_ID, "UTR not found in bank");
      expect(result.claim.status).toBe("REJECTED");
      expect(mockFetch).toHaveBeenCalledWith(
        `/api/v1/societies/${SOCIETY_ID}/payment-claims/${CLAIM_ID}/reject`,
        expect.objectContaining({
          method: "PATCH",
          body: JSON.stringify({ rejectionReason: "UTR not found in bank" }),
        }),
      );
    });

    it("throws on error response", async () => {
      mockFetch.mockResolvedValue({ ok: false, text: () => Promise.resolve("NOT_FOUND") });
      await expect(rejectClaim(SOCIETY_ID, CLAIM_ID, "reason")).rejects.toThrow("NOT_FOUND");
    });
  });
});
