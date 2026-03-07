import { describe, it, expect } from "vitest";

import { createExpenseSchema, reverseExpenseSchema } from "@/lib/validations/expense";

describe("createExpenseSchema", () => {
  const validExpense = {
    date: "2025-04-15",
    amount: 5000,
    category: "MAINTENANCE" as const,
    description: "Monthly garden maintenance",
  };

  it("passes with valid input", () => {
    const result = createExpenseSchema.safeParse(validExpense);
    expect(result.success).toBe(true);
  });

  it("fails with zero amount", () => {
    const result = createExpenseSchema.safeParse({ ...validExpense, amount: 0 });
    expect(result.success).toBe(false);
  });

  it("fails with negative amount", () => {
    const result = createExpenseSchema.safeParse({ ...validExpense, amount: -100 });
    expect(result.success).toBe(false);
  });

  it("fails with short description", () => {
    const result = createExpenseSchema.safeParse({ ...validExpense, description: "Ab" });
    expect(result.success).toBe(false);
  });

  it("fails with description over 500 chars", () => {
    const result = createExpenseSchema.safeParse({ ...validExpense, description: "A".repeat(501) });
    expect(result.success).toBe(false);
  });

  it("fails with invalid category", () => {
    const result = createExpenseSchema.safeParse({ ...validExpense, category: "INVALID" });
    expect(result.success).toBe(false);
  });

  it("accepts all valid categories", () => {
    const categories = [
      "MAINTENANCE",
      "SECURITY",
      "CLEANING",
      "STAFF_SALARY",
      "INFRASTRUCTURE",
      "UTILITIES",
      "EMERGENCY",
      "ADMINISTRATIVE",
      "OTHER",
    ];
    for (const category of categories) {
      const result = createExpenseSchema.safeParse({ ...validExpense, category });
      expect(result.success).toBe(true);
    }
  });
});

describe("reverseExpenseSchema", () => {
  it("passes with valid reason", () => {
    const result = reverseExpenseSchema.safeParse({ reason: "Expense was incorrectly logged" });
    expect(result.success).toBe(true);
  });

  it("fails with short reason", () => {
    const result = reverseExpenseSchema.safeParse({ reason: "Bad" });
    expect(result.success).toBe(false);
  });

  it("fails with reason over 500 chars", () => {
    const result = reverseExpenseSchema.safeParse({ reason: "A".repeat(501) });
    expect(result.success).toBe(false);
  });
});
