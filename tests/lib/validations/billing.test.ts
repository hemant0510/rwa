import { describe, it, expect } from "vitest";

import {
  recordSubscriptionPaymentSchema,
  correctSubscriptionPaymentSchema,
  reverseSubscriptionPaymentSchema,
  generateInvoiceSchema,
  updateInvoiceSchema,
  sendReminderSchema,
  sendBulkRemindersSchema,
} from "@/lib/validations/billing";

// ──────────────────────────────────────────
// recordSubscriptionPaymentSchema
// ──────────────────────────────────────────
describe("recordSubscriptionPaymentSchema", () => {
  const validCash = {
    amount: 5000,
    paymentMode: "CASH" as const,
    paymentDate: "2026-03-10",
  };

  it("passes with valid cash payment", () => {
    expect(recordSubscriptionPaymentSchema.safeParse(validCash).success).toBe(true);
  });

  it("passes with UPI + referenceNo", () => {
    const result = recordSubscriptionPaymentSchema.safeParse({
      ...validCash,
      paymentMode: "UPI",
      referenceNo: "UPI-REF-123",
    });
    expect(result.success).toBe(true);
  });

  it("fails with UPI without referenceNo", () => {
    const result = recordSubscriptionPaymentSchema.safeParse({
      ...validCash,
      paymentMode: "UPI",
    });
    expect(result.success).toBe(false);
  });

  it("fails with BANK_TRANSFER without referenceNo", () => {
    const result = recordSubscriptionPaymentSchema.safeParse({
      ...validCash,
      paymentMode: "BANK_TRANSFER",
    });
    expect(result.success).toBe(false);
  });

  it("fails with CHEQUE without referenceNo", () => {
    const result = recordSubscriptionPaymentSchema.safeParse({
      ...validCash,
      paymentMode: "CHEQUE",
    });
    expect(result.success).toBe(false);
  });

  it("passes with BANK_TRANSFER + referenceNo", () => {
    const result = recordSubscriptionPaymentSchema.safeParse({
      ...validCash,
      paymentMode: "BANK_TRANSFER",
      referenceNo: "NEFT-456",
    });
    expect(result.success).toBe(true);
  });

  it("passes with CASH without referenceNo", () => {
    expect(recordSubscriptionPaymentSchema.safeParse(validCash).success).toBe(true);
  });

  it("passes with OTHER without referenceNo", () => {
    const result = recordSubscriptionPaymentSchema.safeParse({
      ...validCash,
      paymentMode: "OTHER",
    });
    expect(result.success).toBe(true);
  });

  it("fails with zero amount", () => {
    expect(recordSubscriptionPaymentSchema.safeParse({ ...validCash, amount: 0 }).success).toBe(
      false,
    );
  });

  it("fails with negative amount", () => {
    expect(recordSubscriptionPaymentSchema.safeParse({ ...validCash, amount: -100 }).success).toBe(
      false,
    );
  });

  it("fails with invalid payment mode", () => {
    expect(
      recordSubscriptionPaymentSchema.safeParse({ ...validCash, paymentMode: "BITCOIN" }).success,
    ).toBe(false);
  });

  it("fails with invalid date format", () => {
    expect(
      recordSubscriptionPaymentSchema.safeParse({ ...validCash, paymentDate: "03-10-2026" })
        .success,
    ).toBe(false);
  });

  it("passes with optional notes", () => {
    expect(
      recordSubscriptionPaymentSchema.safeParse({ ...validCash, notes: "First payment" }).success,
    ).toBe(true);
  });

  it("fails with notes over 500 chars", () => {
    expect(
      recordSubscriptionPaymentSchema.safeParse({ ...validCash, notes: "A".repeat(501) }).success,
    ).toBe(false);
  });

  it("defaults sendEmail to false when omitted", () => {
    const result = recordSubscriptionPaymentSchema.safeParse(validCash);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.sendEmail).toBe(false);
    }
  });

  it("accepts sendEmail = true", () => {
    const result = recordSubscriptionPaymentSchema.safeParse({ ...validCash, sendEmail: true });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.sendEmail).toBe(true);
    }
  });

  it("fails with empty referenceNo for UPI (whitespace only)", () => {
    const result = recordSubscriptionPaymentSchema.safeParse({
      ...validCash,
      paymentMode: "UPI",
      referenceNo: "   ",
    });
    expect(result.success).toBe(false);
  });

  it("accepts optional billingOptionId as UUID", () => {
    const result = recordSubscriptionPaymentSchema.safeParse({
      ...validCash,
      billingOptionId: "550e8400-e29b-41d4-a716-446655440000",
    });
    expect(result.success).toBe(true);
    if (result.success)
      expect(result.data.billingOptionId).toBe("550e8400-e29b-41d4-a716-446655440000");
  });

  it("fails with billingOptionId that is not a UUID", () => {
    const result = recordSubscriptionPaymentSchema.safeParse({
      ...validCash,
      billingOptionId: "not-a-uuid",
    });
    expect(result.success).toBe(false);
  });

  it("passes without billingOptionId", () => {
    const result = recordSubscriptionPaymentSchema.safeParse(validCash);
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.billingOptionId).toBeUndefined();
  });
});

// ──────────────────────────────────────────
// correctSubscriptionPaymentSchema
// ──────────────────────────────────────────
describe("correctSubscriptionPaymentSchema", () => {
  it("passes with valid correction", () => {
    const result = correctSubscriptionPaymentSchema.safeParse({
      amount: 500,
      reason: "Corrected amount after review",
    });
    expect(result.success).toBe(true);
  });

  it("fails without reason", () => {
    expect(correctSubscriptionPaymentSchema.safeParse({ amount: 500 }).success).toBe(false);
  });

  it("fails with short reason (< 5 chars)", () => {
    expect(correctSubscriptionPaymentSchema.safeParse({ reason: "Fix" }).success).toBe(false);
  });

  it("passes with only reason (all other fields optional)", () => {
    expect(correctSubscriptionPaymentSchema.safeParse({ reason: "Fixing the entry" }).success).toBe(
      true,
    );
  });

  it("fails with negative amount", () => {
    expect(
      correctSubscriptionPaymentSchema.safeParse({ amount: -1, reason: "Some reason here" })
        .success,
    ).toBe(false);
  });
});

// ──────────────────────────────────────────
// reverseSubscriptionPaymentSchema
// ──────────────────────────────────────────
describe("reverseSubscriptionPaymentSchema", () => {
  it("passes with valid reason", () => {
    expect(
      reverseSubscriptionPaymentSchema.safeParse({ reason: "Duplicate payment" }).success,
    ).toBe(true);
  });

  it("fails with short reason", () => {
    expect(reverseSubscriptionPaymentSchema.safeParse({ reason: "Dup" }).success).toBe(false);
  });

  it("fails with reason over 500 chars", () => {
    expect(reverseSubscriptionPaymentSchema.safeParse({ reason: "A".repeat(501) }).success).toBe(
      false,
    );
  });
});

// ──────────────────────────────────────────
// generateInvoiceSchema
// ──────────────────────────────────────────
describe("generateInvoiceSchema", () => {
  const valid = {
    periodStart: "2026-04-01",
    periodEnd: "2027-04-01",
    dueDate: "2027-04-15",
  };

  it("passes with valid dates", () => {
    expect(generateInvoiceSchema.safeParse(valid).success).toBe(true);
  });

  it("fails with invalid date format", () => {
    expect(generateInvoiceSchema.safeParse({ ...valid, periodStart: "04-01-2026" }).success).toBe(
      false,
    );
  });

  it("fails when periodStart >= periodEnd", () => {
    const result = generateInvoiceSchema.safeParse({
      ...valid,
      periodStart: "2027-04-01",
      periodEnd: "2026-04-01",
    });
    expect(result.success).toBe(false);
  });

  it("fails when periodStart equals periodEnd", () => {
    const result = generateInvoiceSchema.safeParse({
      ...valid,
      periodStart: "2026-04-01",
      periodEnd: "2026-04-01",
    });
    expect(result.success).toBe(false);
  });

  it("fails when dueDate < periodEnd", () => {
    const result = generateInvoiceSchema.safeParse({
      ...valid,
      dueDate: "2026-03-01",
    });
    expect(result.success).toBe(false);
  });

  it("passes when dueDate equals periodEnd", () => {
    const result = generateInvoiceSchema.safeParse({
      ...valid,
      dueDate: "2027-04-01",
    });
    expect(result.success).toBe(true);
  });

  it("accepts optional notes", () => {
    expect(generateInvoiceSchema.safeParse({ ...valid, notes: "Manual invoice" }).success).toBe(
      true,
    );
  });

  it("fails with notes over 500 chars", () => {
    expect(generateInvoiceSchema.safeParse({ ...valid, notes: "A".repeat(501) }).success).toBe(
      false,
    );
  });
});

// ──────────────────────────────────────────
// updateInvoiceSchema
// ──────────────────────────────────────────
describe("updateInvoiceSchema", () => {
  it("passes with valid status", () => {
    expect(updateInvoiceSchema.safeParse({ status: "WAIVED" }).success).toBe(true);
  });

  it("passes with just notes", () => {
    expect(updateInvoiceSchema.safeParse({ notes: "Waived per SA decision" }).success).toBe(true);
  });

  it("fails with invalid status", () => {
    expect(updateInvoiceSchema.safeParse({ status: "INVALID" }).success).toBe(false);
  });

  it("passes with empty object", () => {
    expect(updateInvoiceSchema.safeParse({}).success).toBe(true);
  });
});

// ──────────────────────────────────────────
// sendReminderSchema
// ──────────────────────────────────────────
describe("sendReminderSchema", () => {
  const valid = {
    societyId: "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11",
    templateKey: "expiry-reminder" as const,
  };

  it("passes with valid input", () => {
    expect(sendReminderSchema.safeParse(valid).success).toBe(true);
  });

  it("fails with invalid UUID", () => {
    expect(sendReminderSchema.safeParse({ ...valid, societyId: "not-a-uuid" }).success).toBe(false);
  });

  it("fails with invalid templateKey", () => {
    expect(sendReminderSchema.safeParse({ ...valid, templateKey: "invalid-key" }).success).toBe(
      false,
    );
  });

  it("passes with all three template keys", () => {
    expect(
      sendReminderSchema.safeParse({ ...valid, templateKey: "overdue-reminder" }).success,
    ).toBe(true);
    expect(sendReminderSchema.safeParse({ ...valid, templateKey: "trial-ending" }).success).toBe(
      true,
    );
  });
});

// ──────────────────────────────────────────
// sendBulkRemindersSchema
// ──────────────────────────────────────────
describe("sendBulkRemindersSchema", () => {
  const validId = "a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11";

  it("passes with valid input", () => {
    expect(
      sendBulkRemindersSchema.safeParse({ societyIds: [validId], templateKey: "expiry-reminder" })
        .success,
    ).toBe(true);
  });

  it("fails with empty array", () => {
    expect(
      sendBulkRemindersSchema.safeParse({ societyIds: [], templateKey: "expiry-reminder" }).success,
    ).toBe(false);
  });

  it("fails with > 100 societies", () => {
    const ids = Array.from({ length: 101 }, () => validId);
    expect(
      sendBulkRemindersSchema.safeParse({ societyIds: ids, templateKey: "expiry-reminder" })
        .success,
    ).toBe(false);
  });

  it("fails with invalid UUID in array", () => {
    expect(
      sendBulkRemindersSchema.safeParse({ societyIds: ["bad-id"], templateKey: "expiry-reminder" })
        .success,
    ).toBe(false);
  });
});
