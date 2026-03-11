import { describe, it, expect, vi, beforeEach } from "vitest";

import {
  getSubscription,
  assignPlan,
  switchPlan,
  applyDiscount,
  getSubscriptionHistory,
} from "@/services/subscriptions";

const mockFetch = vi.fn();
global.fetch = mockFetch;

function okJson(data: unknown) {
  return { ok: true, json: () => Promise.resolve(data) };
}
function errJson(data: unknown) {
  return { ok: false, json: () => Promise.resolve(data) };
}
function errNoBody() {
  return { ok: false };
}
function notFound() {
  return { ok: false, status: 404 };
}

const BASE = (id: string) => `/api/v1/societies/${id}/subscription`;

describe("subscriptions service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getSubscription", () => {
    it("fetches subscription for a society", async () => {
      const sub = { id: "sub-1", status: "ACTIVE" };
      mockFetch.mockResolvedValue(okJson(sub));

      const result = await getSubscription("soc-1");

      expect(mockFetch).toHaveBeenCalledWith(BASE("soc-1"));
      expect(result).toEqual(sub);
    });

    it("returns null when 404 (no subscription yet)", async () => {
      mockFetch.mockResolvedValue(notFound());

      const result = await getSubscription("soc-1");

      expect(result).toBeNull();
    });

    it("throws when response is a non-404 error", async () => {
      mockFetch.mockResolvedValue(errNoBody());

      await expect(getSubscription("soc-1")).rejects.toThrow("Failed to fetch subscription");
    });
  });

  describe("assignPlan", () => {
    it("sends POST with plan and billing option", async () => {
      const created = { id: "sub-new", status: "ACTIVE" };
      mockFetch.mockResolvedValue(okJson(created));

      const result = await assignPlan("soc-1", {
        planId: "plan-1",
        billingOptionId: "opt-1",
      });

      expect(mockFetch).toHaveBeenCalledWith(BASE("soc-1"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId: "plan-1", billingOptionId: "opt-1" }),
      });
      expect(result).toEqual(created);
    });

    it("includes optional discountId and notes", async () => {
      mockFetch.mockResolvedValue(okJson({ id: "sub-1" }));

      await assignPlan("soc-1", {
        planId: "plan-1",
        billingOptionId: "opt-1",
        discountId: "disc-1",
        notes: "Pilot customer",
      });

      const body = JSON.parse((mockFetch.mock.calls[0] as [string, { body: string }])[1].body);
      expect(body.discountId).toBe("disc-1");
      expect(body.notes).toBe("Pilot customer");
    });

    it("throws with server error message on failure", async () => {
      mockFetch.mockResolvedValue(errJson({ error: { message: "Plan not found" } }));

      await expect(assignPlan("soc-1", { planId: "bad", billingOptionId: "bad" })).rejects.toThrow(
        "Plan not found",
      );
    });

    it("throws generic message when error body has no message", async () => {
      mockFetch.mockResolvedValue(errJson({}));

      await expect(assignPlan("soc-1", { planId: "p", billingOptionId: "o" })).rejects.toThrow(
        "Failed to assign plan",
      );
    });
  });

  describe("switchPlan", () => {
    it("sends PATCH to /switch endpoint", async () => {
      const result = { id: "sub-1", status: "ACTIVE" };
      mockFetch.mockResolvedValue(okJson(result));

      await switchPlan("soc-1", { planId: "plan-2", billingOptionId: "opt-2" });

      expect(mockFetch).toHaveBeenCalledWith(`${BASE("soc-1")}/switch`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ planId: "plan-2", billingOptionId: "opt-2" }),
      });
    });

    it("includes optional notes", async () => {
      mockFetch.mockResolvedValue(okJson({ id: "sub-1" }));

      await switchPlan("soc-1", {
        planId: "plan-2",
        billingOptionId: "opt-2",
        notes: "Upgrade requested",
      });

      const body = JSON.parse((mockFetch.mock.calls[0] as [string, { body: string }])[1].body);
      expect(body.notes).toBe("Upgrade requested");
    });

    it("throws with server error message on failure", async () => {
      mockFetch.mockResolvedValue(errJson({ error: { message: "Cannot switch to same plan" } }));

      await expect(switchPlan("soc-1", { planId: "p", billingOptionId: "o" })).rejects.toThrow(
        "Cannot switch to same plan",
      );
    });

    it("throws generic message when error body has no message", async () => {
      mockFetch.mockResolvedValue(errJson({}));

      await expect(switchPlan("soc-1", { planId: "p", billingOptionId: "o" })).rejects.toThrow(
        "Failed to switch plan",
      );
    });
  });

  describe("applyDiscount", () => {
    it("sends POST to /apply-discount endpoint", async () => {
      const result = { id: "sub-1", discountId: "d-1" };
      mockFetch.mockResolvedValue(okJson(result));

      await applyDiscount("soc-1", { discountId: "d-1" });

      expect(mockFetch).toHaveBeenCalledWith(`${BASE("soc-1")}/apply-discount`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ discountId: "d-1" }),
      });
    });

    it("supports custom discount percentage", async () => {
      mockFetch.mockResolvedValue(okJson({ id: "sub-1" }));

      await applyDiscount("soc-1", { customDiscountPct: 25, notes: "Loyalty" });

      const body = JSON.parse((mockFetch.mock.calls[0] as [string, { body: string }])[1].body);
      expect(body.customDiscountPct).toBe(25);
      expect(body.notes).toBe("Loyalty");
    });

    it("throws with server error message on failure", async () => {
      mockFetch.mockResolvedValue(errJson({ error: { message: "Discount not found" } }));

      await expect(applyDiscount("soc-1", {})).rejects.toThrow("Discount not found");
    });

    it("throws generic message when error body has no message", async () => {
      mockFetch.mockResolvedValue(errJson({}));

      await expect(applyDiscount("soc-1", {})).rejects.toThrow("Failed to apply discount");
    });
  });

  describe("getSubscriptionHistory", () => {
    it("fetches history for a society", async () => {
      const history = [{ id: "h-1", changeType: "PLAN_SELECTED" }];
      mockFetch.mockResolvedValue(okJson(history));

      const result = await getSubscriptionHistory("soc-1");

      expect(mockFetch).toHaveBeenCalledWith(`${BASE("soc-1")}/history`);
      expect(result).toEqual(history);
    });

    it("throws when response is not ok", async () => {
      mockFetch.mockResolvedValue(errNoBody());

      await expect(getSubscriptionHistory("soc-1")).rejects.toThrow(
        "Failed to fetch subscription history",
      );
    });
  });
});
