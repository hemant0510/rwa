import { describe, it, expect, vi, beforeEach } from "vitest";

import {
  getPlans,
  getPlan,
  createPlan,
  updatePlan,
  archivePlan,
  addBillingOption,
  updateBillingOption,
  reorderPlans,
} from "@/services/plans";

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

describe("plans service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getPlans", () => {
    it("fetches all plans and returns array", async () => {
      const plans = [{ id: "plan-1", name: "Basic" }];
      mockFetch.mockResolvedValue(okJson(plans));

      const result = await getPlans();

      expect(mockFetch).toHaveBeenCalledWith("/api/v1/super-admin/plans");
      expect(result).toEqual(plans);
    });

    it("throws when response is not ok", async () => {
      mockFetch.mockResolvedValue(errNoBody());

      await expect(getPlans()).rejects.toThrow("Failed to fetch plans");
    });
  });

  describe("getPlan", () => {
    it("fetches single plan by id", async () => {
      const plan = { id: "plan-1", name: "Basic" };
      mockFetch.mockResolvedValue(okJson(plan));

      const result = await getPlan("plan-1");

      expect(mockFetch).toHaveBeenCalledWith("/api/v1/super-admin/plans/plan-1");
      expect(result).toEqual(plan);
    });

    it("throws when response is not ok", async () => {
      mockFetch.mockResolvedValue(errNoBody());

      await expect(getPlan("plan-1")).rejects.toThrow("Failed to fetch plan");
    });
  });

  describe("createPlan", () => {
    it("sends POST with JSON body", async () => {
      const payload = { name: "Pro", planType: "FLAT_FEE" };
      const created = { id: "plan-new", ...payload };
      mockFetch.mockResolvedValue(okJson(created));

      const result = await createPlan(payload);

      expect(mockFetch).toHaveBeenCalledWith("/api/v1/super-admin/plans", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      expect(result).toEqual(created);
    });

    it("throws with server error message on failure", async () => {
      mockFetch.mockResolvedValue(errJson({ error: { message: "Slug already exists" } }));

      await expect(createPlan({ name: "Basic" })).rejects.toThrow("Slug already exists");
    });

    it("throws generic message when error body has no message", async () => {
      mockFetch.mockResolvedValue(errJson({}));

      await expect(createPlan({})).rejects.toThrow("Failed to create plan");
    });
  });

  describe("updatePlan", () => {
    it("sends PATCH with plan id and data", async () => {
      const updated = { id: "plan-1", name: "Basic Updated" };
      mockFetch.mockResolvedValue(okJson(updated));

      const result = await updatePlan("plan-1", { name: "Basic Updated" });

      expect(mockFetch).toHaveBeenCalledWith("/api/v1/super-admin/plans/plan-1", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Basic Updated" }),
      });
      expect(result).toEqual(updated);
    });

    it("throws with server error message on failure", async () => {
      mockFetch.mockResolvedValue(errJson({ error: { message: "Plan not found" } }));

      await expect(updatePlan("bad-id", {})).rejects.toThrow("Plan not found");
    });

    it("throws generic message when error body has no message", async () => {
      mockFetch.mockResolvedValue(errJson({}));

      await expect(updatePlan("plan-1", {})).rejects.toThrow("Failed to update plan");
    });
  });

  describe("archivePlan", () => {
    it("sends DELETE request", async () => {
      mockFetch.mockResolvedValue({ ok: true });

      await archivePlan("plan-1");

      expect(mockFetch).toHaveBeenCalledWith("/api/v1/super-admin/plans/plan-1", {
        method: "DELETE",
      });
    });

    it("throws with server error message on failure", async () => {
      mockFetch.mockResolvedValue(errJson({ error: { message: "Active subscribers exist" } }));

      await expect(archivePlan("plan-1")).rejects.toThrow("Active subscribers exist");
    });

    it("throws generic message when error body has no message", async () => {
      mockFetch.mockResolvedValue(errJson({}));

      await expect(archivePlan("plan-1")).rejects.toThrow("Failed to archive plan");
    });
  });

  describe("addBillingOption", () => {
    it("sends POST to billing-options endpoint", async () => {
      const option = { id: "opt-1", billingCycle: "ANNUAL", price: 9990 };
      mockFetch.mockResolvedValue(okJson(option));

      const result = await addBillingOption("plan-1", { billingCycle: "ANNUAL", price: 9990 });

      expect(mockFetch).toHaveBeenCalledWith("/api/v1/super-admin/plans/plan-1/billing-options", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ billingCycle: "ANNUAL", price: 9990 }),
      });
      expect(result).toEqual(option);
    });

    it("throws with server error message on failure", async () => {
      mockFetch.mockResolvedValue(errJson({ error: { message: "Cycle already exists" } }));

      await expect(
        addBillingOption("plan-1", { billingCycle: "ANNUAL", price: 9990 }),
      ).rejects.toThrow("Cycle already exists");
    });

    it("throws generic message when error body has no message", async () => {
      mockFetch.mockResolvedValue(errJson({}));

      await expect(
        addBillingOption("plan-1", { billingCycle: "MONTHLY", price: 999 }),
      ).rejects.toThrow("Failed to add billing option");
    });
  });

  describe("updateBillingOption", () => {
    it("sends PATCH to billing-options/[bid] endpoint", async () => {
      const updated = { id: "opt-1", price: 10990 };
      mockFetch.mockResolvedValue(okJson(updated));

      const result = await updateBillingOption("plan-1", "opt-1", { price: 10990 });

      expect(mockFetch).toHaveBeenCalledWith(
        "/api/v1/super-admin/plans/plan-1/billing-options/opt-1",
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ price: 10990 }),
        },
      );
      expect(result).toEqual(updated);
    });

    it("throws with server error message on failure", async () => {
      mockFetch.mockResolvedValue(errJson({ error: { message: "Billing option not found" } }));

      await expect(updateBillingOption("plan-1", "bad-id", { price: 100 })).rejects.toThrow(
        "Billing option not found",
      );
    });

    it("throws generic message when error body has no message", async () => {
      mockFetch.mockResolvedValue(errJson({}));

      await expect(updateBillingOption("plan-1", "opt-1", { price: 100 })).rejects.toThrow(
        "Failed to update billing option",
      );
    });
  });

  describe("reorderPlans", () => {
    it("sends POST to reorder endpoint", async () => {
      mockFetch.mockResolvedValue({ ok: true });
      const order = [
        { id: "plan-1", displayOrder: 1 },
        { id: "plan-2", displayOrder: 2 },
      ];

      await reorderPlans(order);

      expect(mockFetch).toHaveBeenCalledWith("/api/v1/super-admin/plans/reorder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order }),
      });
    });

    it("throws when response is not ok", async () => {
      mockFetch.mockResolvedValue(errNoBody());

      await expect(reorderPlans([])).rejects.toThrow("Failed to reorder plans");
    });
  });
});
