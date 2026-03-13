import { describe, it, expect, vi, beforeEach } from "vitest";

const mockPrisma = vi.hoisted(() => ({
  societySubscription: {
    findFirst: vi.fn(),
  },
  subscriptionInvoice: {
    findFirst: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    count: vi.fn(),
  },
  subscriptionPayment: {
    aggregate: vi.fn(),
  },
  societySubscriptionHistory: {
    create: vi.fn(),
  },
}));

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

import {
  getLatestSubscription,
  getLatestPendingInvoice,
  getInvoicePaidTotal,
  computeInvoiceStatus,
  updateInvoicePaidState,
  nextInvoiceNo,
  ensureOpenInvoice,
  createInvoiceHistory,
} from "@/lib/billing-server";

describe("billing-server", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ── computeInvoiceStatus (pure) ──
  describe("computeInvoiceStatus", () => {
    it("returns UNPAID when paid is 0", () => {
      expect(computeInvoiceStatus(1000, 0)).toBe("UNPAID");
    });

    it("returns UNPAID when paid is negative", () => {
      expect(computeInvoiceStatus(1000, -50)).toBe("UNPAID");
    });

    it("returns PAID when paid equals finalAmount", () => {
      expect(computeInvoiceStatus(1000, 1000)).toBe("PAID");
    });

    it("returns PAID when paid exceeds finalAmount", () => {
      expect(computeInvoiceStatus(1000, 1500)).toBe("PAID");
    });

    it("returns PARTIALLY_PAID when paid is between 0 and finalAmount", () => {
      expect(computeInvoiceStatus(1000, 500)).toBe("PARTIALLY_PAID");
    });

    it("returns PARTIALLY_PAID for small partial payment", () => {
      expect(computeInvoiceStatus(1000, 1)).toBe("PARTIALLY_PAID");
    });

    it("returns PARTIALLY_PAID when paid is just under finalAmount", () => {
      expect(computeInvoiceStatus(1000, 999)).toBe("PARTIALLY_PAID");
    });
  });

  // ── getLatestSubscription ──
  describe("getLatestSubscription", () => {
    it("queries with correct societyId", async () => {
      mockPrisma.societySubscription.findFirst.mockResolvedValue({ id: "sub-1" });
      const result = await getLatestSubscription("soc-1");
      expect(mockPrisma.societySubscription.findFirst).toHaveBeenCalledWith({
        where: { societyId: "soc-1" },
        include: { plan: true, billingOption: true, discount: true },
        orderBy: { createdAt: "desc" },
      });
      expect(result).toEqual({ id: "sub-1" });
    });

    it("returns null when no subscription found", async () => {
      mockPrisma.societySubscription.findFirst.mockResolvedValue(null);
      const result = await getLatestSubscription("soc-missing");
      expect(result).toBeNull();
    });
  });

  // ── getLatestPendingInvoice ──
  describe("getLatestPendingInvoice", () => {
    it("queries with correct filters", async () => {
      mockPrisma.subscriptionInvoice.findFirst.mockResolvedValue({ id: "inv-1" });
      const result = await getLatestPendingInvoice("soc-1", "sub-1");
      expect(mockPrisma.subscriptionInvoice.findFirst).toHaveBeenCalledWith({
        where: {
          societyId: "soc-1",
          subscriptionId: "sub-1",
          status: { in: ["UNPAID", "PARTIALLY_PAID", "OVERDUE"] },
        },
        orderBy: { createdAt: "desc" },
      });
      expect(result).toEqual({ id: "inv-1" });
    });

    it("returns null when no pending invoice", async () => {
      mockPrisma.subscriptionInvoice.findFirst.mockResolvedValue(null);
      const result = await getLatestPendingInvoice("soc-1", "sub-1");
      expect(result).toBeNull();
    });
  });

  // ── getInvoicePaidTotal ──
  describe("getInvoicePaidTotal", () => {
    it("returns sum of payments", async () => {
      mockPrisma.subscriptionPayment.aggregate.mockResolvedValue({
        _sum: { amount: 5000 },
      });
      const result = await getInvoicePaidTotal("inv-1");
      expect(result).toBe(5000);
    });

    it("returns 0 when no payments", async () => {
      mockPrisma.subscriptionPayment.aggregate.mockResolvedValue({
        _sum: { amount: null },
      });
      const result = await getInvoicePaidTotal("inv-1");
      expect(result).toBe(0);
    });
  });

  // ── updateInvoicePaidState ──
  describe("updateInvoicePaidState", () => {
    it("returns null when invoice not found", async () => {
      mockPrisma.subscriptionInvoice.findUnique.mockResolvedValue(null);
      const result = await updateInvoicePaidState("inv-missing");
      expect(result).toBeNull();
    });

    it("updates to PAID and sets paidAt when fully paid", async () => {
      mockPrisma.subscriptionInvoice.findUnique.mockResolvedValue({
        id: "inv-1",
        finalAmount: 1000,
      });
      mockPrisma.subscriptionPayment.aggregate.mockResolvedValue({
        _sum: { amount: 1000 },
      });
      mockPrisma.subscriptionInvoice.update.mockResolvedValue({ status: "PAID" });

      await updateInvoicePaidState("inv-1");

      expect(mockPrisma.subscriptionInvoice.update).toHaveBeenCalledWith({
        where: { id: "inv-1" },
        data: {
          status: "PAID",
          paidAt: expect.any(Date),
        },
      });
    });

    it("updates to PARTIALLY_PAID with null paidAt", async () => {
      mockPrisma.subscriptionInvoice.findUnique.mockResolvedValue({
        id: "inv-1",
        finalAmount: 1000,
      });
      mockPrisma.subscriptionPayment.aggregate.mockResolvedValue({
        _sum: { amount: 500 },
      });
      mockPrisma.subscriptionInvoice.update.mockResolvedValue({ status: "PARTIALLY_PAID" });

      await updateInvoicePaidState("inv-1");

      expect(mockPrisma.subscriptionInvoice.update).toHaveBeenCalledWith({
        where: { id: "inv-1" },
        data: { status: "PARTIALLY_PAID", paidAt: null },
      });
    });

    it("updates to UNPAID when no payments", async () => {
      mockPrisma.subscriptionInvoice.findUnique.mockResolvedValue({
        id: "inv-1",
        finalAmount: 1000,
      });
      mockPrisma.subscriptionPayment.aggregate.mockResolvedValue({
        _sum: { amount: null },
      });
      mockPrisma.subscriptionInvoice.update.mockResolvedValue({ status: "UNPAID" });

      await updateInvoicePaidState("inv-1");

      expect(mockPrisma.subscriptionInvoice.update).toHaveBeenCalledWith({
        where: { id: "inv-1" },
        data: { status: "UNPAID", paidAt: null },
      });
    });
  });

  // ── nextInvoiceNo ──
  describe("nextInvoiceNo", () => {
    it("returns invoice number on first attempt when no collision", async () => {
      mockPrisma.subscriptionInvoice.count.mockResolvedValue(5);
      mockPrisma.subscriptionInvoice.findUnique.mockResolvedValue(null);

      const result = await nextInvoiceNo();

      expect(result).toMatch(/^INV-\d{4}-000006$/);
    });

    it("retries when invoice number already exists", async () => {
      mockPrisma.subscriptionInvoice.count.mockResolvedValue(5);
      mockPrisma.subscriptionInvoice.findUnique
        .mockResolvedValueOnce({ id: "existing" })
        .mockResolvedValueOnce(null);

      const result = await nextInvoiceNo();

      expect(result).toMatch(/^INV-\d{4}-000007$/);
      expect(mockPrisma.subscriptionInvoice.findUnique).toHaveBeenCalledTimes(2);
    });

    it("falls back to timestamp-based number after max retries", async () => {
      mockPrisma.subscriptionInvoice.count.mockResolvedValue(5);
      mockPrisma.subscriptionInvoice.findUnique.mockResolvedValue({ id: "existing" });

      const result = await nextInvoiceNo(2);

      expect(result).toMatch(/^INV-\d{4}-\d+$/);
      expect(mockPrisma.subscriptionInvoice.findUnique).toHaveBeenCalledTimes(2);
    });
  });

  // ── ensureOpenInvoice ──
  describe("ensureOpenInvoice", () => {
    const baseParams = {
      societyId: "soc-1",
      subscriptionId: "sub-1",
      billingCycle: "ANNUAL" as const,
      planName: "Premium",
      baseAmount: 25000,
      discountAmount: 5000,
      finalAmount: 20000,
    };

    it("returns existing pending invoice if one exists", async () => {
      const existing = { id: "inv-existing", status: "UNPAID" };
      mockPrisma.subscriptionInvoice.findFirst.mockResolvedValue(existing);

      const result = await ensureOpenInvoice(baseParams);

      expect(result).toEqual(existing);
      expect(mockPrisma.subscriptionInvoice.create).not.toHaveBeenCalled();
    });

    it("creates new invoice when no pending one exists", async () => {
      mockPrisma.subscriptionInvoice.findFirst.mockResolvedValue(null);
      mockPrisma.subscriptionInvoice.count.mockResolvedValue(0);
      mockPrisma.subscriptionInvoice.findUnique.mockResolvedValue(null);
      const created = { id: "inv-new", status: "UNPAID" };
      mockPrisma.subscriptionInvoice.create.mockResolvedValue(created);

      const result = await ensureOpenInvoice(baseParams);

      expect(result).toEqual(created);
      expect(mockPrisma.subscriptionInvoice.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          societyId: "soc-1",
          subscriptionId: "sub-1",
          planName: "Premium",
          billingCycle: "ANNUAL",
          baseAmount: 25000,
          discountAmount: 5000,
          finalAmount: 20000,
          status: "UNPAID",
        }),
      });
    });

    it("uses provided periodStart and periodEnd", async () => {
      mockPrisma.subscriptionInvoice.findFirst.mockResolvedValue(null);
      mockPrisma.subscriptionInvoice.count.mockResolvedValue(0);
      mockPrisma.subscriptionInvoice.findUnique.mockResolvedValue(null);
      mockPrisma.subscriptionInvoice.create.mockResolvedValue({ id: "inv-new" });

      const start = new Date("2026-04-01");
      const end = new Date("2027-04-01");
      await ensureOpenInvoice({ ...baseParams, periodStart: start, periodEnd: end });

      expect(mockPrisma.subscriptionInvoice.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          periodStart: start,
          periodEnd: end,
        }),
      });
    });
  });

  // ── createInvoiceHistory ──
  describe("createInvoiceHistory", () => {
    it("creates history entry via transaction client", async () => {
      const mockTx = {
        societySubscriptionHistory: { create: vi.fn().mockResolvedValue({}) },
      };

      await createInvoiceHistory(mockTx as never, {
        subscriptionId: "sub-1",
        societyId: "soc-1",
        changeType: "INVOICE_GENERATED",
        notes: "Auto-generated",
      });

      expect(mockTx.societySubscriptionHistory.create).toHaveBeenCalledWith({
        data: {
          subscriptionId: "sub-1",
          societyId: "soc-1",
          changeType: "INVOICE_GENERATED",
          performedBy: "SA",
          notes: "Auto-generated",
        },
      });
    });

    it("works without notes", async () => {
      const mockTx = {
        societySubscriptionHistory: { create: vi.fn().mockResolvedValue({}) },
      };

      await createInvoiceHistory(mockTx as never, {
        subscriptionId: "sub-1",
        societyId: "soc-1",
        changeType: "INVOICE_WAIVED",
      });

      expect(mockTx.societySubscriptionHistory.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          changeType: "INVOICE_WAIVED",
          notes: undefined,
        }),
      });
    });
  });
});
