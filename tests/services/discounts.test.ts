import { describe, it, expect, vi, beforeEach } from "vitest";

import {
  getDiscounts,
  createDiscount,
  updateDiscount,
  deactivateDiscount,
  validateCoupon,
} from "@/services/discounts";

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

describe("discounts service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getDiscounts", () => {
    it("fetches all discounts", async () => {
      const discounts = [{ id: "d-1", name: "Summer Sale" }];
      mockFetch.mockResolvedValue(okJson(discounts));

      const result = await getDiscounts();

      expect(mockFetch).toHaveBeenCalledWith("/api/v1/super-admin/discounts");
      expect(result).toEqual(discounts);
    });

    it("throws when response is not ok", async () => {
      mockFetch.mockResolvedValue(errNoBody());

      await expect(getDiscounts()).rejects.toThrow("Failed to fetch discounts");
    });
  });

  describe("createDiscount", () => {
    it("sends POST with JSON body", async () => {
      const payload = { name: "Sale", discountType: "PERCENTAGE", discountValue: 20 };
      const created = { id: "d-new", ...payload };
      mockFetch.mockResolvedValue(okJson(created));

      const result = await createDiscount(payload);

      expect(mockFetch).toHaveBeenCalledWith("/api/v1/super-admin/discounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      expect(result).toEqual(created);
    });

    it("throws with server error message on failure", async () => {
      mockFetch.mockResolvedValue(errJson({ error: { message: "Coupon already in use" } }));

      await expect(createDiscount({})).rejects.toThrow("Coupon already in use");
    });

    it("throws generic message when error body has no message", async () => {
      mockFetch.mockResolvedValue(errJson({}));

      await expect(createDiscount({})).rejects.toThrow("Failed to create discount");
    });
  });

  describe("updateDiscount", () => {
    it("sends PATCH with discount id and data", async () => {
      const updated = { id: "d-1", name: "Updated Sale" };
      mockFetch.mockResolvedValue(okJson(updated));

      const result = await updateDiscount("d-1", { name: "Updated Sale" });

      expect(mockFetch).toHaveBeenCalledWith("/api/v1/super-admin/discounts/d-1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Updated Sale" }),
      });
      expect(result).toEqual(updated);
    });

    it("throws with server error message on failure", async () => {
      mockFetch.mockResolvedValue(errJson({ error: { message: "Discount not found" } }));

      await expect(updateDiscount("bad-id", {})).rejects.toThrow("Discount not found");
    });

    it("throws generic message when error body has no message", async () => {
      mockFetch.mockResolvedValue(errJson({}));

      await expect(updateDiscount("d-1", {})).rejects.toThrow("Failed to update discount");
    });
  });

  describe("deactivateDiscount", () => {
    it("sends DELETE request", async () => {
      mockFetch.mockResolvedValue({ ok: true });

      await deactivateDiscount("d-1");

      expect(mockFetch).toHaveBeenCalledWith("/api/v1/super-admin/discounts/d-1", {
        method: "DELETE",
      });
    });

    it("throws when response is not ok", async () => {
      mockFetch.mockResolvedValue(errNoBody());

      await expect(deactivateDiscount("d-1")).rejects.toThrow("Failed to deactivate discount");
    });
  });

  describe("validateCoupon", () => {
    it("sends POST with uppercase coupon code", async () => {
      const response = {
        valid: true,
        discountId: "d-1",
        name: "Summer Sale",
        discountType: "PERCENTAGE",
        discountValue: 20,
      };
      mockFetch.mockResolvedValue(okJson(response));

      const result = await validateCoupon("summer20", "plan-1", "ANNUAL");

      expect(mockFetch).toHaveBeenCalledWith("/api/v1/super-admin/discounts/validate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          couponCode: "SUMMER20", // uppercased
          planId: "plan-1",
          billingCycle: "ANNUAL",
        }),
      });
      expect(result).toEqual(response);
    });

    it("preserves already-uppercase coupon code", async () => {
      mockFetch.mockResolvedValue(okJson({ valid: true, discountId: "d-1" }));

      await validateCoupon("SAVE50", "plan-1", "MONTHLY");

      const body = JSON.parse((mockFetch.mock.calls[0] as [string, { body: string }])[1].body);
      expect(body.couponCode).toBe("SAVE50");
    });

    it("throws with server error message on failure", async () => {
      mockFetch.mockResolvedValue(errJson({ error: { message: "Invalid coupon code" } }));

      await expect(validateCoupon("INVALID", "plan-1", "MONTHLY")).rejects.toThrow(
        "Invalid coupon code",
      );
    });

    it("throws generic message when error body has no message", async () => {
      mockFetch.mockResolvedValue(errJson({}));

      await expect(validateCoupon("X", "plan-1", "MONTHLY")).rejects.toThrow("Invalid coupon code");
    });
  });
});
