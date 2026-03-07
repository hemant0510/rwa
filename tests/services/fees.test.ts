import { describe, it, expect, vi, beforeEach } from "vitest";

import {
  getFeeDashboard,
  recordPayment,
  grantExemption,
  getResidentPayments,
} from "@/services/fees";

const mockFetch = vi.fn();
global.fetch = mockFetch;

function okJson(data: unknown) {
  return { ok: true, json: () => Promise.resolve(data) };
}
function errJson(data: unknown) {
  return { ok: false, json: () => Promise.resolve(data) };
}

describe("fees service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getFeeDashboard", () => {
    it("fetches dashboard without session param", async () => {
      mockFetch.mockResolvedValue(okJson({ sessionYear: "2025-26", fees: [] }));
      await getFeeDashboard("soc-1");
      expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining("/fees/dashboard"));
      expect(mockFetch).toHaveBeenCalledWith(expect.not.stringContaining("session="));
    });

    it("fetches dashboard with session param", async () => {
      mockFetch.mockResolvedValue(okJson({ sessionYear: "2024-25", fees: [] }));
      await getFeeDashboard("soc-1", "2024-25");
      expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining("session=2024-25"));
    });

    it("throws on error", async () => {
      mockFetch.mockResolvedValue({ ok: false });
      await expect(getFeeDashboard("soc-1")).rejects.toThrow();
    });
  });

  describe("recordPayment", () => {
    it("sends POST with payment data", async () => {
      mockFetch.mockResolvedValue(okJson({ id: "pay-1" }));
      await recordPayment("soc-1", "fee-1", {
        amount: 1200,
        paymentMode: "CASH",
        paymentDate: "2025-04-15",
      });
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/fees/fee-1/payments"),
        expect.objectContaining({ method: "POST" }),
      );
    });

    it("throws with API error message", async () => {
      mockFetch.mockResolvedValue(errJson({ error: { message: "Overpayment" } }));
      await expect(
        recordPayment("soc-1", "fee-1", {
          amount: 99999,
          paymentMode: "CASH",
          paymentDate: "2025-04-15",
        }),
      ).rejects.toThrow("Overpayment");
    });
  });

  describe("grantExemption", () => {
    it("sends POST with exemption data", async () => {
      mockFetch.mockResolvedValue(okJson({ message: "Exempted" }));
      await grantExemption("soc-1", "fee-1", { reason: "Senior citizen exemption" });
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/fees/fee-1/exempt"),
        expect.objectContaining({ method: "POST" }),
      );
    });

    it("throws with API error message", async () => {
      mockFetch.mockResolvedValue(errJson({ error: { message: "Already exempted" } }));
      await expect(grantExemption("soc-1", "fee-1", { reason: "Test reason" })).rejects.toThrow(
        "Already exempted",
      );
    });
  });

  describe("getResidentPayments", () => {
    it("fetches payments", async () => {
      mockFetch.mockResolvedValue(okJson({ fees: [], payments: [] }));
      await getResidentPayments("res-1");
      expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining("/residents/res-1/payments"));
    });

    it("throws on error", async () => {
      mockFetch.mockResolvedValue({ ok: false });
      await expect(getResidentPayments("res-1")).rejects.toThrow();
    });
  });
});
