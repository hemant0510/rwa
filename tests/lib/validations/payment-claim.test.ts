import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

import {
  paymentClaimSchema,
  rejectClaimSchema,
  verifyClaimSchema,
  subscriptionClaimSchema,
} from "@/lib/validations/payment-claim";

const VALID_UUID = "11111111-1111-4111-8111-111111111111";

// Fix today's date so refine("not in the future") tests are deterministic
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-04-05T12:00:00Z"));
});

afterEach(() => {
  vi.useRealTimers();
});

// ─── paymentClaimSchema ───────────────────────────────────────────────────────

describe("paymentClaimSchema", () => {
  const valid = {
    membershipFeeId: VALID_UUID,
    claimedAmount: 2000,
    utrNumber: "ABCD1234567890",
    paymentDate: "2026-04-04",
    screenshotUrl: undefined,
  };

  it("passes with all valid fields", () => {
    expect(paymentClaimSchema.safeParse(valid).success).toBe(true);
  });

  it("passes with optional screenshotUrl provided", () => {
    expect(
      paymentClaimSchema.safeParse({ ...valid, screenshotUrl: "https://example.com/ss.png" })
        .success,
    ).toBe(true);
  });

  describe("membershipFeeId", () => {
    it("fails when not a UUID", () => {
      expect(
        paymentClaimSchema.safeParse({ ...valid, membershipFeeId: "not-a-uuid" }).success,
      ).toBe(false);
    });
  });

  describe("claimedAmount", () => {
    it("fails when amount is 0", () => {
      expect(paymentClaimSchema.safeParse({ ...valid, claimedAmount: 0 }).success).toBe(false);
    });

    it("fails when amount is negative", () => {
      expect(paymentClaimSchema.safeParse({ ...valid, claimedAmount: -100 }).success).toBe(false);
    });

    it("fails when amount exceeds max 999999", () => {
      expect(paymentClaimSchema.safeParse({ ...valid, claimedAmount: 1000000 }).success).toBe(
        false,
      );
    });

    it("passes with amount at max boundary 999999", () => {
      expect(paymentClaimSchema.safeParse({ ...valid, claimedAmount: 999999 }).success).toBe(true);
    });
  });

  describe("utrNumber", () => {
    it("fails when UTR is less than 10 chars", () => {
      const result = paymentClaimSchema.safeParse({ ...valid, utrNumber: "SHORT" });
      expect(result.success).toBe(false);
    });

    it("fails when UTR exceeds 50 chars", () => {
      const result = paymentClaimSchema.safeParse({
        ...valid,
        utrNumber: "A".repeat(51),
      });
      expect(result.success).toBe(false);
    });

    it("fails when UTR contains special characters", () => {
      expect(paymentClaimSchema.safeParse({ ...valid, utrNumber: "UTR-12345@6789" }).success).toBe(
        false,
      );
    });

    it("fails when UTR contains spaces", () => {
      expect(paymentClaimSchema.safeParse({ ...valid, utrNumber: "UTR 1234567890" }).success).toBe(
        false,
      );
    });

    it("passes with uppercase alphanumeric UTR", () => {
      expect(paymentClaimSchema.safeParse({ ...valid, utrNumber: "ABCD1234567890" }).success).toBe(
        true,
      );
    });

    it("passes with lowercase alphanumeric UTR (case-insensitive regex)", () => {
      expect(paymentClaimSchema.safeParse({ ...valid, utrNumber: "abcd1234567890" }).success).toBe(
        true,
      );
    });

    it("passes with exactly 10 chars", () => {
      expect(paymentClaimSchema.safeParse({ ...valid, utrNumber: "1234567890" }).success).toBe(
        true,
      );
    });
  });

  describe("paymentDate", () => {
    it("fails when date is in the future", () => {
      const result = paymentClaimSchema.safeParse({ ...valid, paymentDate: "2026-04-06" });
      expect(result.success).toBe(false);
    });

    it("passes when date is today", () => {
      expect(paymentClaimSchema.safeParse({ ...valid, paymentDate: "2026-04-05" }).success).toBe(
        true,
      );
    });

    it("passes when date is in the past", () => {
      expect(paymentClaimSchema.safeParse({ ...valid, paymentDate: "2026-01-01" }).success).toBe(
        true,
      );
    });

    it("fails with invalid date format", () => {
      expect(paymentClaimSchema.safeParse({ ...valid, paymentDate: "04-04-2026" }).success).toBe(
        false,
      );
    });
  });

  describe("screenshotUrl", () => {
    it("passes when omitted", () => {
      const { screenshotUrl: _, ...rest } = valid;
      expect(paymentClaimSchema.safeParse(rest).success).toBe(true);
    });

    it("fails when provided as invalid URL", () => {
      expect(paymentClaimSchema.safeParse({ ...valid, screenshotUrl: "not-a-url" }).success).toBe(
        false,
      );
    });
  });
});

// ─── rejectClaimSchema ────────────────────────────────────────────────────────

describe("rejectClaimSchema", () => {
  it("passes with a valid reason of at least 10 chars", () => {
    expect(
      rejectClaimSchema.safeParse({ rejectionReason: "Wrong amount entered by resident" }).success,
    ).toBe(true);
  });

  it("fails when reason is too short (< 10 chars)", () => {
    expect(rejectClaimSchema.safeParse({ rejectionReason: "Too short" }).success).toBe(false);
  });

  it("fails when reason is missing", () => {
    expect(rejectClaimSchema.safeParse({}).success).toBe(false);
  });

  it("fails when reason exceeds 500 chars", () => {
    expect(rejectClaimSchema.safeParse({ rejectionReason: "A".repeat(501) }).success).toBe(false);
  });

  it("passes with exactly 10 chars", () => {
    expect(rejectClaimSchema.safeParse({ rejectionReason: "1234567890" }).success).toBe(true);
  });

  it("passes with exactly 500 chars", () => {
    expect(rejectClaimSchema.safeParse({ rejectionReason: "A".repeat(500) }).success).toBe(true);
  });
});

// ─── verifyClaimSchema ────────────────────────────────────────────────────────

describe("verifyClaimSchema", () => {
  it("passes with empty body (no adminNotes)", () => {
    expect(verifyClaimSchema.safeParse({}).success).toBe(true);
  });

  it("passes with optional adminNotes provided", () => {
    expect(
      verifyClaimSchema.safeParse({ adminNotes: "UTR verified in bank statement" }).success,
    ).toBe(true);
  });

  it("fails when adminNotes exceeds 1000 chars", () => {
    expect(verifyClaimSchema.safeParse({ adminNotes: "A".repeat(1001) }).success).toBe(false);
  });

  it("passes with adminNotes exactly 1000 chars", () => {
    expect(verifyClaimSchema.safeParse({ adminNotes: "A".repeat(1000) }).success).toBe(true);
  });

  it("passes with undefined adminNotes", () => {
    expect(verifyClaimSchema.safeParse({ adminNotes: undefined }).success).toBe(true);
  });
});

// ─── subscriptionClaimSchema ──────────────────────────────────────────────────

describe("subscriptionClaimSchema", () => {
  const valid = {
    amount: 1799,
    utrNumber: "ABCD1234567890",
    paymentDate: "2026-04-04",
    periodStart: "2026-04-01",
    periodEnd: "2026-04-30",
  };

  it("passes with all valid fields", () => {
    expect(subscriptionClaimSchema.safeParse(valid).success).toBe(true);
  });

  it("passes with optional screenshotUrl", () => {
    expect(
      subscriptionClaimSchema.safeParse({ ...valid, screenshotUrl: "https://example.com/ss.png" })
        .success,
    ).toBe(true);
  });

  describe("amount", () => {
    it("fails when amount is 0", () => {
      expect(subscriptionClaimSchema.safeParse({ ...valid, amount: 0 }).success).toBe(false);
    });

    it("fails when amount is negative", () => {
      expect(subscriptionClaimSchema.safeParse({ ...valid, amount: -1 }).success).toBe(false);
    });
  });

  describe("utrNumber", () => {
    it("fails when UTR is less than 10 chars", () => {
      expect(subscriptionClaimSchema.safeParse({ ...valid, utrNumber: "ABCD12345" }).success).toBe(
        false,
      );
    });

    it("fails when UTR contains special characters", () => {
      expect(
        subscriptionClaimSchema.safeParse({ ...valid, utrNumber: "UTR-1234567890" }).success,
      ).toBe(false);
    });
  });

  describe("paymentDate", () => {
    it("fails when paymentDate is in the future", () => {
      expect(
        subscriptionClaimSchema.safeParse({ ...valid, paymentDate: "2026-04-10" }).success,
      ).toBe(false);
    });

    it("passes when paymentDate is today", () => {
      expect(
        subscriptionClaimSchema.safeParse({ ...valid, paymentDate: "2026-04-05" }).success,
      ).toBe(true);
    });
  });

  describe("periodStart", () => {
    it("fails when periodStart is missing", () => {
      const { periodStart: _, ...rest } = valid;
      expect(subscriptionClaimSchema.safeParse(rest).success).toBe(false);
    });

    it("fails with invalid date format", () => {
      expect(
        subscriptionClaimSchema.safeParse({ ...valid, periodStart: "01-04-2026" }).success,
      ).toBe(false);
    });
  });

  describe("periodEnd", () => {
    it("fails when periodEnd is missing", () => {
      const { periodEnd: _, ...rest } = valid;
      expect(subscriptionClaimSchema.safeParse(rest).success).toBe(false);
    });

    it("fails when periodEnd is before periodStart", () => {
      expect(
        subscriptionClaimSchema.safeParse({
          ...valid,
          periodStart: "2026-04-30",
          periodEnd: "2026-04-01",
        }).success,
      ).toBe(false);
    });

    it("fails when periodEnd equals periodStart", () => {
      expect(
        subscriptionClaimSchema.safeParse({
          ...valid,
          periodStart: "2026-04-01",
          periodEnd: "2026-04-01",
        }).success,
      ).toBe(false);
    });

    it("passes when periodEnd is after periodStart", () => {
      expect(
        subscriptionClaimSchema.safeParse({
          ...valid,
          periodStart: "2026-04-01",
          periodEnd: "2026-05-01",
        }).success,
      ).toBe(true);
    });
  });
});
