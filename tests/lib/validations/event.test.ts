import { describe, it, expect } from "vitest";

import {
  createEventSchema,
  updateEventSchema,
  triggerPaymentSchema,
  cancelEventSchema,
  registerEventSchema,
  recordEventPaymentSchema,
  addEventExpenseSchema,
  settleEventSchema,
} from "@/lib/validations/event";

describe("createEventSchema", () => {
  const validFixed = {
    title: "Yoga Workshop",
    category: "WORKSHOP" as const,
    feeModel: "FIXED" as const,
    chargeUnit: "PER_PERSON" as const,
    eventDate: "2026-12-01T10:00:00Z",
    feeAmount: 200,
  };

  const validFree = {
    title: "Annual General Meeting",
    category: "MEETING" as const,
    feeModel: "FREE" as const,
    eventDate: "2026-12-01T10:00:00Z",
  };

  const validFlexible = {
    title: "Holi Celebration",
    category: "FESTIVAL" as const,
    feeModel: "FLEXIBLE" as const,
    chargeUnit: "PER_PERSON" as const,
    eventDate: "2026-12-01T10:00:00Z",
    estimatedBudget: 50000,
    minParticipants: 50,
  };

  const validContribution = {
    title: "Mata ki Chowki",
    category: "CULTURAL" as const,
    feeModel: "CONTRIBUTION" as const,
    chargeUnit: "PER_HOUSEHOLD" as const,
    eventDate: "2026-12-01T10:00:00Z",
    suggestedAmount: 500,
  };

  it("passes with valid FIXED event", () => {
    expect(createEventSchema.safeParse(validFixed).success).toBe(true);
  });

  it("passes with valid FREE event", () => {
    expect(createEventSchema.safeParse(validFree).success).toBe(true);
  });

  it("passes with valid FLEXIBLE event", () => {
    expect(createEventSchema.safeParse(validFlexible).success).toBe(true);
  });

  it("passes with valid CONTRIBUTION event", () => {
    expect(createEventSchema.safeParse(validContribution).success).toBe(true);
  });

  it("fails when title is too short", () => {
    expect(createEventSchema.safeParse({ ...validFixed, title: "Ab" }).success).toBe(false);
  });

  it("fails when title exceeds 200 chars", () => {
    expect(createEventSchema.safeParse({ ...validFixed, title: "A".repeat(201) }).success).toBe(
      false,
    );
  });

  it("fails with invalid category", () => {
    expect(createEventSchema.safeParse({ ...validFixed, category: "INVALID" }).success).toBe(false);
  });

  it("accepts all valid categories", () => {
    for (const category of ["FESTIVAL", "SPORTS", "WORKSHOP", "CULTURAL", "MEETING", "OTHER"]) {
      expect(createEventSchema.safeParse({ ...validFixed, category }).success).toBe(true);
    }
  });

  it("fails with invalid feeModel", () => {
    expect(createEventSchema.safeParse({ ...validFixed, feeModel: "INVALID" }).success).toBe(false);
  });

  it("fails when FIXED event has no feeAmount", () => {
    const { feeAmount: _, ...noFee } = validFixed;
    expect(createEventSchema.safeParse(noFee).success).toBe(false);
  });

  it("fails when FREE event has feeAmount", () => {
    expect(createEventSchema.safeParse({ ...validFree, feeAmount: 100 }).success).toBe(false);
  });

  it("fails when FLEXIBLE event has feeAmount", () => {
    expect(createEventSchema.safeParse({ ...validFlexible, feeAmount: 100 }).success).toBe(false);
  });

  it("fails when CONTRIBUTION event has feeAmount", () => {
    expect(createEventSchema.safeParse({ ...validContribution, feeAmount: 100 }).success).toBe(
      false,
    );
  });

  it("fails when registrationDeadline is after eventDate", () => {
    expect(
      createEventSchema.safeParse({
        ...validFixed,
        registrationDeadline: "2027-01-01T10:00:00Z",
      }).success,
    ).toBe(false);
  });

  it("passes when registrationDeadline is before eventDate", () => {
    expect(
      createEventSchema.safeParse({
        ...validFixed,
        registrationDeadline: "2026-11-30T10:00:00Z",
      }).success,
    ).toBe(true);
  });

  it("accepts optional fields as null", () => {
    expect(
      createEventSchema.safeParse({
        ...validFixed,
        description: null,
        location: null,
        maxParticipants: null,
      }).success,
    ).toBe(true);
  });

  it("accepts optional description and location strings", () => {
    expect(
      createEventSchema.safeParse({
        ...validFixed,
        description: "A fun workshop",
        location: "Club House",
      }).success,
    ).toBe(true);
  });

  it("fails with missing eventDate", () => {
    const { eventDate: _, ...noDate } = validFixed;
    expect(createEventSchema.safeParse(noDate).success).toBe(false);
  });
});

describe("updateEventSchema", () => {
  it("passes with partial update", () => {
    expect(updateEventSchema.safeParse({ title: "Updated Title" }).success).toBe(true);
  });

  it("passes with multiple fields", () => {
    expect(updateEventSchema.safeParse({ title: "New Title", category: "SPORTS" }).success).toBe(
      true,
    );
  });

  it("fails when no fields are provided", () => {
    expect(updateEventSchema.safeParse({}).success).toBe(false);
  });

  it("fails with invalid category", () => {
    expect(updateEventSchema.safeParse({ category: "INVALID" }).success).toBe(false);
  });
});

describe("triggerPaymentSchema", () => {
  it("passes with positive feeAmount", () => {
    expect(triggerPaymentSchema.safeParse({ feeAmount: 500 }).success).toBe(true);
  });

  it("fails with zero feeAmount", () => {
    expect(triggerPaymentSchema.safeParse({ feeAmount: 0 }).success).toBe(false);
  });

  it("fails with negative feeAmount", () => {
    expect(triggerPaymentSchema.safeParse({ feeAmount: -100 }).success).toBe(false);
  });
});

describe("cancelEventSchema", () => {
  it("passes with valid reason", () => {
    expect(cancelEventSchema.safeParse({ reason: "Not enough participants" }).success).toBe(true);
  });

  it("fails with short reason", () => {
    expect(cancelEventSchema.safeParse({ reason: "No" }).success).toBe(false);
  });

  it("fails with reason over 1000 chars", () => {
    expect(cancelEventSchema.safeParse({ reason: "A".repeat(1001) }).success).toBe(false);
  });
});

describe("registerEventSchema", () => {
  it("defaults memberCount to 1", () => {
    const result = registerEventSchema.safeParse({});
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.memberCount).toBe(1);
  });

  it("passes with valid memberCount", () => {
    expect(registerEventSchema.safeParse({ memberCount: 5 }).success).toBe(true);
  });

  it("fails with memberCount > 10", () => {
    expect(registerEventSchema.safeParse({ memberCount: 11 }).success).toBe(false);
  });

  it("fails with memberCount < 1", () => {
    expect(registerEventSchema.safeParse({ memberCount: 0 }).success).toBe(false);
  });

  it("fails with non-integer memberCount", () => {
    expect(registerEventSchema.safeParse({ memberCount: 2.5 }).success).toBe(false);
  });
});

describe("recordEventPaymentSchema", () => {
  const validPayment = {
    amount: 500,
    paymentMode: "CASH" as const,
    paymentDate: "2026-04-15",
  };

  it("passes with valid CASH payment", () => {
    expect(recordEventPaymentSchema.safeParse(validPayment).success).toBe(true);
  });

  it("passes with UPI and referenceNo", () => {
    expect(
      recordEventPaymentSchema.safeParse({
        ...validPayment,
        paymentMode: "UPI",
        referenceNo: "TXN123",
      }).success,
    ).toBe(true);
  });

  it("fails with UPI without referenceNo", () => {
    expect(
      recordEventPaymentSchema.safeParse({ ...validPayment, paymentMode: "UPI" }).success,
    ).toBe(false);
  });

  it("fails with BANK_TRANSFER without referenceNo", () => {
    expect(
      recordEventPaymentSchema.safeParse({ ...validPayment, paymentMode: "BANK_TRANSFER" }).success,
    ).toBe(false);
  });

  it("fails with zero amount", () => {
    expect(recordEventPaymentSchema.safeParse({ ...validPayment, amount: 0 }).success).toBe(false);
  });

  it("fails with invalid date format", () => {
    expect(
      recordEventPaymentSchema.safeParse({ ...validPayment, paymentDate: "15-04-2026" }).success,
    ).toBe(false);
  });

  it("accepts optional notes", () => {
    expect(
      recordEventPaymentSchema.safeParse({ ...validPayment, notes: "Paid in person" }).success,
    ).toBe(true);
  });
});

describe("addEventExpenseSchema", () => {
  const validExpense = {
    date: "2026-04-15",
    amount: 15000,
    category: "OTHER" as const,
    description: "DJ & Sound System",
  };

  it("passes with valid input", () => {
    expect(addEventExpenseSchema.safeParse(validExpense).success).toBe(true);
  });

  it("fails with short description", () => {
    expect(addEventExpenseSchema.safeParse({ ...validExpense, description: "DJ" }).success).toBe(
      false,
    );
  });

  it("fails with invalid category", () => {
    expect(addEventExpenseSchema.safeParse({ ...validExpense, category: "PARTY" }).success).toBe(
      false,
    );
  });

  it("accepts optional receiptUrl", () => {
    expect(
      addEventExpenseSchema.safeParse({
        ...validExpense,
        receiptUrl: "https://cdn.test/receipt.pdf",
      }).success,
    ).toBe(true);
  });

  it("accepts null receiptUrl", () => {
    expect(addEventExpenseSchema.safeParse({ ...validExpense, receiptUrl: null }).success).toBe(
      true,
    );
  });
});

describe("settleEventSchema", () => {
  it("passes with surplus disposal", () => {
    expect(settleEventSchema.safeParse({ surplusDisposal: "TRANSFERRED_TO_FUND" }).success).toBe(
      true,
    );
  });

  it("passes with deficit disposition", () => {
    expect(settleEventSchema.safeParse({ deficitDisposition: "FROM_SOCIETY_FUND" }).success).toBe(
      true,
    );
  });

  it("passes with notes only", () => {
    expect(settleEventSchema.safeParse({ notes: "All settled" }).success).toBe(true);
  });

  it("passes with empty object", () => {
    expect(settleEventSchema.safeParse({}).success).toBe(true);
  });

  it("accepts all surplus disposal types", () => {
    for (const type of ["REFUNDED", "TRANSFERRED_TO_FUND", "CARRIED_FORWARD"]) {
      expect(settleEventSchema.safeParse({ surplusDisposal: type }).success).toBe(true);
    }
  });

  it("accepts all deficit disposition types", () => {
    for (const type of ["FROM_SOCIETY_FUND", "ADDITIONAL_COLLECTION"]) {
      expect(settleEventSchema.safeParse({ deficitDisposition: type }).success).toBe(true);
    }
  });

  it("fails with invalid surplusDisposal", () => {
    expect(settleEventSchema.safeParse({ surplusDisposal: "INVALID" }).success).toBe(false);
  });
});
