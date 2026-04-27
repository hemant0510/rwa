import { describe, it, expect } from "vitest";

import { upiSetupSchema, platformUpiSchema } from "@/lib/validations/payment-setup";

// ─── upiSetupSchema ───────────────────────────────────────────────────────────

describe("upiSetupSchema", () => {
  const valid = {
    upiId: "edenestate@sbi",
  };

  it("passes with a valid UPI ID", () => {
    expect(upiSetupSchema.safeParse(valid).success).toBe(true);
  });

  it("passes with optional upiQrUrl and upiAccountName", () => {
    expect(
      upiSetupSchema.safeParse({
        ...valid,
        upiQrUrl: "https://example.com/qr.png",
        upiAccountName: "Greenwood Residency RWA",
      }).success,
    ).toBe(true);
  });

  it("passes when optional fields are omitted", () => {
    expect(upiSetupSchema.safeParse({ upiId: "test@hdfc" }).success).toBe(true);
  });

  describe("upiId format validation", () => {
    it("passes with letters@bank format", () => {
      expect(upiSetupSchema.safeParse({ upiId: "society@sbi" }).success).toBe(true);
    });

    it("passes with numbers in VPA", () => {
      expect(upiSetupSchema.safeParse({ upiId: "9876543210@paytm" }).success).toBe(true);
    });

    it("passes with dots in VPA", () => {
      expect(upiSetupSchema.safeParse({ upiId: "eden.estate@oksbi" }).success).toBe(true);
    });

    it("passes with hyphens in VPA", () => {
      expect(upiSetupSchema.safeParse({ upiId: "eden-estate@ybl" }).success).toBe(true);
    });

    it("passes with underscores in VPA", () => {
      expect(upiSetupSchema.safeParse({ upiId: "eden_estate@ibl" }).success).toBe(true);
    });

    it("fails when missing @ symbol", () => {
      expect(upiSetupSchema.safeParse({ upiId: "edenestate" }).success).toBe(false);
    });

    it("fails when bank part contains numbers", () => {
      expect(upiSetupSchema.safeParse({ upiId: "eden@sbi123" }).success).toBe(false);
    });

    it("fails with multiple @ symbols", () => {
      expect(upiSetupSchema.safeParse({ upiId: "eden@sbi@bank" }).success).toBe(false);
    });

    it("fails with empty string", () => {
      expect(upiSetupSchema.safeParse({ upiId: "" }).success).toBe(false);
    });

    it("fails with spaces in UPI ID", () => {
      expect(upiSetupSchema.safeParse({ upiId: "eden estate@sbi" }).success).toBe(false);
    });
  });

  describe("upiQrUrl", () => {
    it("fails when provided as invalid URL", () => {
      expect(upiSetupSchema.safeParse({ ...valid, upiQrUrl: "not-a-url" }).success).toBe(false);
    });

    it("passes with a valid HTTPS URL", () => {
      expect(
        upiSetupSchema.safeParse({ ...valid, upiQrUrl: "https://cdn.example.com/qr.png" }).success,
      ).toBe(true);
    });
  });

  describe("upiAccountName", () => {
    it("fails when exceeds 200 chars", () => {
      expect(upiSetupSchema.safeParse({ ...valid, upiAccountName: "A".repeat(201) }).success).toBe(
        false,
      );
    });

    it("passes with exactly 200 chars", () => {
      expect(upiSetupSchema.safeParse({ ...valid, upiAccountName: "A".repeat(200) }).success).toBe(
        true,
      );
    });
  });
});

// ─── platformUpiSchema ────────────────────────────────────────────────────────

describe("platformUpiSchema", () => {
  const valid = {
    platformUpiId: "platform@axisbank",
  };

  it("passes with a valid platform UPI ID", () => {
    expect(platformUpiSchema.safeParse(valid).success).toBe(true);
  });

  it("passes with all optional fields", () => {
    expect(
      platformUpiSchema.safeParse({
        ...valid,
        platformUpiQrUrl: "https://example.com/platform-qr.png",
        platformUpiAccountName: "RWA Connect Platform",
      }).success,
    ).toBe(true);
  });

  describe("platformUpiId format", () => {
    it("fails when missing @ symbol", () => {
      expect(platformUpiSchema.safeParse({ platformUpiId: "platformsbi" }).success).toBe(false);
    });

    it("fails when bank part contains numbers", () => {
      expect(platformUpiSchema.safeParse({ platformUpiId: "platform@sbi123" }).success).toBe(false);
    });

    it("passes with dots, hyphens, underscores", () => {
      expect(
        platformUpiSchema.safeParse({ platformUpiId: "rwa.connect-2024_v1@ybl" }).success,
      ).toBe(true);
    });

    it("fails with empty string", () => {
      expect(platformUpiSchema.safeParse({ platformUpiId: "" }).success).toBe(false);
    });
  });

  describe("platformUpiQrUrl", () => {
    it("fails when provided as invalid URL", () => {
      expect(platformUpiSchema.safeParse({ ...valid, platformUpiQrUrl: "not-a-url" }).success).toBe(
        false,
      );
    });

    it("passes with valid HTTPS URL", () => {
      expect(
        platformUpiSchema.safeParse({
          ...valid,
          platformUpiQrUrl: "https://cdn.supabase.co/qr.png",
        }).success,
      ).toBe(true);
    });
  });

  describe("platformUpiAccountName", () => {
    it("fails when exceeds 200 chars", () => {
      expect(
        platformUpiSchema.safeParse({ ...valid, platformUpiAccountName: "A".repeat(201) }).success,
      ).toBe(false);
    });

    it("passes with exactly 200 chars", () => {
      expect(
        platformUpiSchema.safeParse({ ...valid, platformUpiAccountName: "A".repeat(200) }).success,
      ).toBe(true);
    });

    it("passes when omitted", () => {
      expect(platformUpiSchema.safeParse({ platformUpiId: "platform@sbi" }).success).toBe(true);
    });
  });
});
