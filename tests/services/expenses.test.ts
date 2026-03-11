import { describe, it, expect, vi, beforeEach } from "vitest";

import { getExpenses, getExpenseSummary, createExpense, reverseExpense } from "@/services/expenses";

const mockFetch = vi.fn();
global.fetch = mockFetch;

function okJson(data: unknown) {
  return { ok: true, json: () => Promise.resolve(data) };
}
function errJson(data: unknown) {
  return { ok: false, json: () => Promise.resolve(data) };
}

describe("expenses service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("getExpenses", () => {
    it("fetches expenses with params", async () => {
      mockFetch.mockResolvedValue(okJson({ data: [], total: 0, page: 1, limit: 20 }));
      await getExpenses("soc-1", { category: "MAINTENANCE", from: "2025-01-01", page: 2 });
      expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining("category=MAINTENANCE"));
      expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining("page=2"));
    });

    it("includes to and limit params when provided", async () => {
      mockFetch.mockResolvedValue(okJson({ data: [], total: 0, page: 1, limit: 10 }));
      await getExpenses("soc-1", { to: "2025-12-31", limit: 10 });
      expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining("to=2025-12-31"));
      expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining("limit=10"));
    });

    it("fetches without params", async () => {
      mockFetch.mockResolvedValue(okJson({ data: [], total: 0, page: 1, limit: 20 }));
      await getExpenses("soc-1");
      expect(mockFetch).toHaveBeenCalled();
    });

    it("throws on error", async () => {
      mockFetch.mockResolvedValue({ ok: false });
      await expect(getExpenses("soc-1")).rejects.toThrow();
    });
  });

  describe("getExpenseSummary", () => {
    it("fetches summary", async () => {
      mockFetch.mockResolvedValue(okJson({ totalExpenses: 5000, balanceInHand: 10000 }));
      const result = await getExpenseSummary("soc-1");
      expect(result.totalExpenses).toBe(5000);
    });

    it("throws on error", async () => {
      mockFetch.mockResolvedValue({ ok: false });
      await expect(getExpenseSummary("soc-1")).rejects.toThrow();
    });
  });

  describe("createExpense", () => {
    it("sends POST", async () => {
      mockFetch.mockResolvedValue(okJson({ id: "exp-1" }));
      await createExpense("soc-1", {
        date: "2025-04-15",
        amount: 5000,
        category: "MAINTENANCE",
        description: "Garden maintenance",
      });
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/expenses"),
        expect.objectContaining({ method: "POST" }),
      );
    });

    it("throws with API error", async () => {
      mockFetch.mockResolvedValue(errJson({ error: { message: "Invalid category" } }));
      await expect(
        createExpense("soc-1", {
          date: "2025-04-15",
          amount: 100,
          category: "MAINTENANCE",
          description: "Test",
        }),
      ).rejects.toThrow("Invalid category");
    });

    it("throws with fallback message when no error message", async () => {
      mockFetch.mockResolvedValue(errJson({}));
      await expect(
        createExpense("soc-1", {
          date: "2025-04-15",
          amount: 100,
          category: "MAINTENANCE",
          description: "Test",
        }),
      ).rejects.toThrow("Failed to create expense");
    });
  });

  describe("reverseExpense", () => {
    it("sends POST to reverse endpoint", async () => {
      mockFetch.mockResolvedValue(okJson({ message: "Reversed" }));
      await reverseExpense("soc-1", "exp-1", { reason: "Logged by mistake" });
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/expenses/exp-1/reverse"),
        expect.objectContaining({ method: "POST" }),
      );
    });

    it("throws with API error", async () => {
      mockFetch.mockResolvedValue(errJson({ error: { message: "Window expired" } }));
      await expect(reverseExpense("soc-1", "exp-1", { reason: "Test reason" })).rejects.toThrow(
        "Window expired",
      );
    });

    it("throws with fallback message when no error message", async () => {
      mockFetch.mockResolvedValue(errJson({}));
      await expect(reverseExpense("soc-1", "exp-1", { reason: "Test" })).rejects.toThrow(
        "Failed to reverse expense",
      );
    });
  });
});
