import { describe, it, expect, vi, beforeEach } from "vitest";

import {
  getBillingDashboard,
  getSubscription,
  getSubscriptionList,
  getExpiringSubscriptions,
  recordSubscriptionPayment,
  getSubscriptionPayments,
  correctSubscriptionPayment,
  reverseSubscriptionPayment,
  getInvoices,
  generateInvoice,
  getInvoiceDetail,
  updateInvoice,
  sendReminder,
  getAllPayments,
  getAllInvoices,
  sendBulkReminders,
} from "@/services/billing";

const mockFetch = vi.fn();
global.fetch = mockFetch;

function okJson(data: unknown) {
  return { ok: true, json: () => Promise.resolve(data) };
}
function errJson(data: unknown) {
  return { ok: false, json: () => Promise.resolve(data) };
}
function errNoBody() {
  return { ok: false, json: () => Promise.resolve({}) };
}

describe("billing service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── Dashboard ──
  describe("getBillingDashboard", () => {
    it("fetches dashboard data", async () => {
      const data = { totalActive: 5 };
      mockFetch.mockResolvedValue(okJson(data));
      const result = await getBillingDashboard();
      expect(mockFetch).toHaveBeenCalledWith("/api/v1/super-admin/billing/dashboard");
      expect(result).toEqual(data);
    });

    it("throws on failure", async () => {
      mockFetch.mockResolvedValue(errNoBody());
      await expect(getBillingDashboard()).rejects.toThrow("Failed to fetch billing dashboard");
    });
  });

  // ── Subscription List ──
  describe("getSubscriptionList", () => {
    it("fetches with no filters", async () => {
      mockFetch.mockResolvedValue(okJson([]));
      await getSubscriptionList();
      expect(mockFetch).toHaveBeenCalledWith("/api/v1/super-admin/billing/subscriptions?");
    });

    it("appends filter params", async () => {
      mockFetch.mockResolvedValue(okJson([]));
      await getSubscriptionList({ status: "ACTIVE", page: 1 });
      const url = mockFetch.mock.calls[0][0] as string;
      expect(url).toContain("status=ACTIVE");
      expect(url).toContain("page=1");
    });

    it("skips undefined/null/empty values", async () => {
      mockFetch.mockResolvedValue(okJson([]));
      await getSubscriptionList({ status: undefined, search: "" });
      const url = mockFetch.mock.calls[0][0] as string;
      expect(url).not.toContain("status");
      expect(url).not.toContain("search");
    });

    it("throws on failure", async () => {
      mockFetch.mockResolvedValue(errNoBody());
      await expect(getSubscriptionList()).rejects.toThrow("Failed to fetch subscriptions");
    });
  });

  // ── Expiring ──
  describe("getExpiringSubscriptions", () => {
    it("fetches with default days=30", async () => {
      mockFetch.mockResolvedValue(okJson([]));
      await getExpiringSubscriptions();
      expect(mockFetch).toHaveBeenCalledWith("/api/v1/super-admin/billing/expiring?days=30");
    });

    it("fetches with custom days", async () => {
      mockFetch.mockResolvedValue(okJson([]));
      await getExpiringSubscriptions(7);
      expect(mockFetch).toHaveBeenCalledWith("/api/v1/super-admin/billing/expiring?days=7");
    });

    it("throws on failure", async () => {
      mockFetch.mockResolvedValue(errNoBody());
      await expect(getExpiringSubscriptions()).rejects.toThrow(
        "Failed to fetch expiring subscriptions",
      );
    });
  });

  // ── Get Subscription ──
  describe("getSubscription", () => {
    const mockSub = {
      id: "sub-1",
      status: "TRIAL",
      currentPeriodEnd: null,
      finalPrice: null,
      plan: {
        id: "plan-1",
        name: "Basic",
        billingOptions: [
          { id: "opt-1", billingCycle: "MONTHLY", price: 499 },
          { id: "opt-2", billingCycle: "ANNUAL", price: 4990 },
        ],
      },
      billingOption: null,
    };

    it("fetches subscription for society", async () => {
      mockFetch.mockResolvedValue(okJson(mockSub));
      const result = await getSubscription("soc-1");
      expect(mockFetch).toHaveBeenCalledWith("/api/v1/societies/soc-1/subscription");
      expect(result).toEqual(mockSub);
    });

    it("throws on failure", async () => {
      mockFetch.mockResolvedValue(errNoBody());
      await expect(getSubscription("soc-1")).rejects.toThrow("Failed to fetch subscription");
    });
  });

  // ── Record Payment ──
  describe("recordSubscriptionPayment", () => {
    const payload = {
      amount: 5000,
      paymentMode: "UPI" as const,
      referenceNo: "REF-1",
      paymentDate: "2026-03-10",
    };

    it("posts payment and returns data", async () => {
      mockFetch.mockResolvedValue(okJson({ id: "p1" }));
      const result = await recordSubscriptionPayment("soc-1", payload);
      expect(mockFetch).toHaveBeenCalledWith(
        "/api/v1/societies/soc-1/subscription/payments",
        expect.objectContaining({ method: "POST" }),
      );
      expect(result).toEqual({ id: "p1" });
    });

    it("throws with server error message", async () => {
      mockFetch.mockResolvedValue(errJson({ error: { message: "No active subscription" } }));
      await expect(recordSubscriptionPayment("soc-1", payload)).rejects.toThrow(
        "No active subscription",
      );
    });

    it("throws fallback message when no error body", async () => {
      mockFetch.mockResolvedValue(errJson({}));
      await expect(recordSubscriptionPayment("soc-1", payload)).rejects.toThrow(
        "Failed to record subscription payment",
      );
    });

    it("includes billingOptionId in request body when provided", async () => {
      mockFetch.mockResolvedValue(okJson({ id: "p1" }));
      await recordSubscriptionPayment("soc-1", {
        ...payload,
        billingOptionId: "550e8400-e29b-41d4-a716-446655440000",
      });
      const body = JSON.parse((mockFetch.mock.calls[0][1] as RequestInit).body as string);
      expect(body.billingOptionId).toBe("550e8400-e29b-41d4-a716-446655440000");
    });
  });

  // ── Get Payments ──
  describe("getSubscriptionPayments", () => {
    it("fetches payments for society", async () => {
      mockFetch.mockResolvedValue(okJson([{ id: "p1" }]));
      const result = await getSubscriptionPayments("soc-1");
      expect(mockFetch).toHaveBeenCalledWith("/api/v1/societies/soc-1/subscription/payments");
      expect(result).toEqual([{ id: "p1" }]);
    });

    it("throws on failure", async () => {
      mockFetch.mockResolvedValue(errNoBody());
      await expect(getSubscriptionPayments("soc-1")).rejects.toThrow(
        "Failed to fetch subscription payments",
      );
    });
  });

  // ── Correct Payment ──
  describe("correctSubscriptionPayment", () => {
    it("patches payment", async () => {
      mockFetch.mockResolvedValue(okJson({ id: "p1" }));
      await correctSubscriptionPayment("soc-1", "p1", { reason: "Corrected amount" });
      expect(mockFetch).toHaveBeenCalledWith(
        "/api/v1/societies/soc-1/subscription/payments/p1",
        expect.objectContaining({ method: "PATCH" }),
      );
    });

    it("throws with server error", async () => {
      mockFetch.mockResolvedValue(errJson({ error: { message: "48h window expired" } }));
      await expect(correctSubscriptionPayment("soc-1", "p1", { reason: "Fix" })).rejects.toThrow(
        "48h window expired",
      );
    });

    it("throws fallback on empty error", async () => {
      mockFetch.mockResolvedValue(errJson({}));
      await expect(correctSubscriptionPayment("soc-1", "p1", { reason: "Fix" })).rejects.toThrow(
        "Failed to correct payment",
      );
    });
  });

  // ── Reverse Payment ──
  describe("reverseSubscriptionPayment", () => {
    it("posts reversal", async () => {
      mockFetch.mockResolvedValue(okJson({ id: "rev-1" }));
      await reverseSubscriptionPayment("soc-1", "p1", { reason: "Duplicate" });
      expect(mockFetch).toHaveBeenCalledWith(
        "/api/v1/societies/soc-1/subscription/payments/p1/reverse",
        expect.objectContaining({ method: "POST" }),
      );
    });

    it("throws with server error", async () => {
      mockFetch.mockResolvedValue(errJson({ error: { message: "Already reversed" } }));
      await expect(reverseSubscriptionPayment("soc-1", "p1", { reason: "Dup" })).rejects.toThrow(
        "Already reversed",
      );
    });

    it("throws fallback on empty error", async () => {
      mockFetch.mockResolvedValue(errJson({}));
      await expect(reverseSubscriptionPayment("soc-1", "p1", { reason: "Dup" })).rejects.toThrow(
        "Failed to reverse payment",
      );
    });
  });

  // ── Get Invoices ──
  describe("getInvoices", () => {
    it("fetches invoices for society", async () => {
      mockFetch.mockResolvedValue(okJson([{ id: "inv-1" }]));
      const result = await getInvoices("soc-1");
      expect(mockFetch).toHaveBeenCalledWith("/api/v1/societies/soc-1/subscription/invoices");
      expect(result).toEqual([{ id: "inv-1" }]);
    });

    it("throws on failure", async () => {
      mockFetch.mockResolvedValue(errNoBody());
      await expect(getInvoices("soc-1")).rejects.toThrow("Failed to fetch invoices");
    });
  });

  // ── Generate Invoice ──
  describe("generateInvoice", () => {
    const data = { periodStart: "2026-04-01", periodEnd: "2027-04-01", dueDate: "2027-04-15" };

    it("posts invoice generation", async () => {
      mockFetch.mockResolvedValue(okJson({ id: "inv-1" }));
      await generateInvoice("soc-1", data);
      expect(mockFetch).toHaveBeenCalledWith(
        "/api/v1/societies/soc-1/subscription/invoices",
        expect.objectContaining({ method: "POST" }),
      );
    });

    it("throws with server error", async () => {
      mockFetch.mockResolvedValue(errJson({ error: { message: "Unpaid invoice exists" } }));
      await expect(generateInvoice("soc-1", data)).rejects.toThrow("Unpaid invoice exists");
    });

    it("throws fallback on empty error", async () => {
      mockFetch.mockResolvedValue(errJson({}));
      await expect(generateInvoice("soc-1", data)).rejects.toThrow("Failed to generate invoice");
    });
  });

  // ── Invoice Detail ──
  describe("getInvoiceDetail", () => {
    it("fetches single invoice", async () => {
      mockFetch.mockResolvedValue(okJson({ id: "inv-1" }));
      const result = await getInvoiceDetail("soc-1", "inv-1");
      expect(mockFetch).toHaveBeenCalledWith("/api/v1/societies/soc-1/subscription/invoices/inv-1");
      expect(result).toEqual({ id: "inv-1" });
    });

    it("throws on failure", async () => {
      mockFetch.mockResolvedValue(errNoBody());
      await expect(getInvoiceDetail("soc-1", "inv-1")).rejects.toThrow(
        "Failed to fetch invoice detail",
      );
    });
  });

  // ── Update Invoice ──
  describe("updateInvoice", () => {
    it("patches invoice status", async () => {
      mockFetch.mockResolvedValue(okJson({ status: "WAIVED" }));
      await updateInvoice("soc-1", "inv-1", { status: "WAIVED" });
      expect(mockFetch).toHaveBeenCalledWith(
        "/api/v1/societies/soc-1/subscription/invoices/inv-1",
        expect.objectContaining({ method: "PATCH" }),
      );
    });

    it("throws with server error", async () => {
      mockFetch.mockResolvedValue(errJson({ error: { message: "Invoice not found" } }));
      await expect(updateInvoice("soc-1", "inv-1", { status: "WAIVED" })).rejects.toThrow(
        "Invoice not found",
      );
    });

    it("throws fallback on empty error", async () => {
      mockFetch.mockResolvedValue(errJson({}));
      await expect(updateInvoice("soc-1", "inv-1", {})).rejects.toThrow("Failed to update invoice");
    });
  });

  // ── Send Reminder ──
  describe("sendReminder", () => {
    it("posts reminder", async () => {
      mockFetch.mockResolvedValue(okJson({ sent: 1 }));
      await sendReminder("soc-1", "expiry-reminder");
      expect(mockFetch).toHaveBeenCalledWith(
        "/api/v1/super-admin/billing/send-reminder",
        expect.objectContaining({ method: "POST" }),
      );
    });

    it("throws with server error", async () => {
      mockFetch.mockResolvedValue(errJson({ error: { message: "No admins found" } }));
      await expect(sendReminder("soc-1", "expiry-reminder")).rejects.toThrow("No admins found");
    });

    it("throws fallback on empty error", async () => {
      mockFetch.mockResolvedValue(errJson({}));
      await expect(sendReminder("soc-1", "expiry-reminder")).rejects.toThrow(
        "Failed to send reminder",
      );
    });
  });

  // ── Get All Payments ──
  describe("getAllPayments", () => {
    it("fetches with default params", async () => {
      mockFetch.mockResolvedValue(okJson({ rows: [], total: 0 }));
      await getAllPayments();
      const url = mockFetch.mock.calls[0][0] as string;
      expect(url).toContain("/api/v1/super-admin/billing/payments");
    });

    it("appends page and limit params", async () => {
      mockFetch.mockResolvedValue(okJson({ rows: [], total: 0 }));
      await getAllPayments({ page: 2, limit: 25 });
      const url = mockFetch.mock.calls[0][0] as string;
      expect(url).toContain("page=2");
      expect(url).toContain("limit=25");
    });

    it("throws on failure", async () => {
      mockFetch.mockResolvedValue(errNoBody());
      await expect(getAllPayments()).rejects.toThrow("Failed to fetch all payments");
    });
  });

  // ── Get All Invoices ──
  describe("getAllInvoices", () => {
    it("fetches with status filter", async () => {
      mockFetch.mockResolvedValue(okJson({ rows: [], total: 0 }));
      await getAllInvoices({ status: "UNPAID" });
      const url = mockFetch.mock.calls[0][0] as string;
      expect(url).toContain("status=UNPAID");
    });

    it("throws on failure", async () => {
      mockFetch.mockResolvedValue(errNoBody());
      await expect(getAllInvoices()).rejects.toThrow("Failed to fetch all invoices");
    });
  });

  // ── Send Bulk Reminders ──
  describe("sendBulkReminders", () => {
    it("posts bulk reminders", async () => {
      mockFetch.mockResolvedValue(okJson({ sent: 3, failed: 0 }));
      const result = await sendBulkReminders(["s1", "s2", "s3"], "overdue-reminder");
      expect(mockFetch).toHaveBeenCalledWith(
        "/api/v1/super-admin/billing/send-bulk-reminders",
        expect.objectContaining({ method: "POST" }),
      );
      expect(result).toEqual({ sent: 3, failed: 0 });
    });

    it("throws with server error", async () => {
      mockFetch.mockResolvedValue(errJson({ error: { message: "Rate limited" } }));
      await expect(sendBulkReminders(["s1"], "expiry-reminder")).rejects.toThrow("Rate limited");
    });

    it("throws fallback on empty error", async () => {
      mockFetch.mockResolvedValue(errJson({}));
      await expect(sendBulkReminders(["s1"], "expiry-reminder")).rejects.toThrow(
        "Failed to send bulk reminders",
      );
    });
  });
});
