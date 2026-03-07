import { describe, it, expect } from "vitest";

import {
  recordPaymentSchema,
  grantExemptionSchema,
  correctPaymentSchema,
  reversePaymentSchema,
} from "@/lib/validations/fee";

describe("recordPaymentSchema", () => {
  const validCash = {
    amount: 1200,
    paymentMode: "CASH" as const,
    paymentDate: "2025-04-15",
  };

  it("passes with valid cash payment", () => {
    const result = recordPaymentSchema.safeParse(validCash);
    expect(result.success).toBe(true);
  });

  it("passes with UPI and referenceNo", () => {
    const result = recordPaymentSchema.safeParse({
      ...validCash,
      paymentMode: "UPI",
      referenceNo: "UPI123456",
    });
    expect(result.success).toBe(true);
  });

  it("fails with UPI without referenceNo", () => {
    const result = recordPaymentSchema.safeParse({
      ...validCash,
      paymentMode: "UPI",
    });
    expect(result.success).toBe(false);
  });

  it("fails with BANK_TRANSFER without referenceNo", () => {
    const result = recordPaymentSchema.safeParse({
      ...validCash,
      paymentMode: "BANK_TRANSFER",
    });
    expect(result.success).toBe(false);
  });

  it("passes with BANK_TRANSFER and referenceNo", () => {
    const result = recordPaymentSchema.safeParse({
      ...validCash,
      paymentMode: "BANK_TRANSFER",
      referenceNo: "NEFT123",
    });
    expect(result.success).toBe(true);
  });

  it("fails with zero amount", () => {
    const result = recordPaymentSchema.safeParse({ ...validCash, amount: 0 });
    expect(result.success).toBe(false);
  });

  it("fails with negative amount", () => {
    const result = recordPaymentSchema.safeParse({ ...validCash, amount: -100 });
    expect(result.success).toBe(false);
  });

  it("fails with invalid payment mode", () => {
    const result = recordPaymentSchema.safeParse({ ...validCash, paymentMode: "BITCOIN" });
    expect(result.success).toBe(false);
  });

  it("accepts optional notes", () => {
    const result = recordPaymentSchema.safeParse({ ...validCash, notes: "Partial payment" });
    expect(result.success).toBe(true);
  });

  it("fails with notes over 500 chars", () => {
    const result = recordPaymentSchema.safeParse({ ...validCash, notes: "A".repeat(501) });
    expect(result.success).toBe(false);
  });

  it("passes with OTHER mode without referenceNo", () => {
    const result = recordPaymentSchema.safeParse({ ...validCash, paymentMode: "OTHER" });
    expect(result.success).toBe(true);
  });
});

describe("grantExemptionSchema", () => {
  it("passes with valid reason", () => {
    const result = grantExemptionSchema.safeParse({ reason: "Senior citizen exemption granted" });
    expect(result.success).toBe(true);
  });

  it("fails with short reason", () => {
    const result = grantExemptionSchema.safeParse({ reason: "Short" });
    expect(result.success).toBe(false);
  });

  it("fails with reason over 500 chars", () => {
    const result = grantExemptionSchema.safeParse({ reason: "A".repeat(501) });
    expect(result.success).toBe(false);
  });
});

describe("correctPaymentSchema", () => {
  it("passes with valid correction", () => {
    const result = correctPaymentSchema.safeParse({
      amount: 500,
      reason: "Corrected amount",
    });
    expect(result.success).toBe(true);
  });

  it("fails without reason", () => {
    const result = correctPaymentSchema.safeParse({ amount: 500 });
    expect(result.success).toBe(false);
  });

  it("fails with short reason", () => {
    const result = correctPaymentSchema.safeParse({ amount: 500, reason: "Fix" });
    expect(result.success).toBe(false);
  });

  it("passes with only reason (all other fields optional)", () => {
    const result = correctPaymentSchema.safeParse({ reason: "Fixing the entry" });
    expect(result.success).toBe(true);
  });
});

describe("reversePaymentSchema", () => {
  it("passes with valid reason", () => {
    const result = reversePaymentSchema.safeParse({ reason: "Payment was duplicate" });
    expect(result.success).toBe(true);
  });

  it("fails with short reason", () => {
    const result = reversePaymentSchema.safeParse({ reason: "Dup" });
    expect(result.success).toBe(false);
  });

  it("fails with reason over 500 chars", () => {
    const result = reversePaymentSchema.safeParse({ reason: "A".repeat(501) });
    expect(result.success).toBe(false);
  });
});
