import { describe, it, expect } from "vitest";

import {
  APP_NAME,
  DEFAULT_JOINING_FEE,
  DEFAULT_ANNUAL_FEE,
  DEFAULT_GRACE_PERIOD_DAYS,
  DEFAULT_FEE_SESSION_START_MONTH,
  MAX_FILE_SIZE,
  ALLOWED_FILE_TYPES,
  SOCIETY_CODE_MIN_LENGTH,
  SOCIETY_CODE_MAX_LENGTH,
  SOCIETY_CODE_PATTERN,
  VERIFICATION_TOKEN_EXPIRY_HOURS,
  VERIFICATION_RESEND_COOLDOWN_SECONDS,
  INDIAN_MOBILE_PATTERN,
  PINCODE_PATTERN,
  EXPENSE_CATEGORIES,
  FLOOR_LEVELS,
  INDIAN_STATES,
} from "@/lib/constants";

describe("constants", () => {
  it("has correct app name", () => {
    expect(APP_NAME).toBe("RWA Connect");
  });

  it("has correct fee defaults", () => {
    expect(DEFAULT_JOINING_FEE).toBe(1000);
    expect(DEFAULT_ANNUAL_FEE).toBe(1200);
    expect(DEFAULT_GRACE_PERIOD_DAYS).toBe(15);
    expect(DEFAULT_FEE_SESSION_START_MONTH).toBe(4);
  });

  it("has correct file limits", () => {
    expect(MAX_FILE_SIZE).toBe(5 * 1024 * 1024);
    expect(ALLOWED_FILE_TYPES).toContain("application/pdf");
    expect(ALLOWED_FILE_TYPES).toContain("image/jpeg");
    expect(ALLOWED_FILE_TYPES).toContain("image/png");
  });

  it("has correct society code constraints", () => {
    expect(SOCIETY_CODE_MIN_LENGTH).toBe(4);
    expect(SOCIETY_CODE_MAX_LENGTH).toBe(8);
    expect(SOCIETY_CODE_PATTERN.test("EDEN")).toBe(true);
    expect(SOCIETY_CODE_PATTERN.test("eden")).toBe(false);
    expect(SOCIETY_CODE_PATTERN.test("ED-EN")).toBe(false);
  });

  it("has correct verification constants", () => {
    expect(VERIFICATION_TOKEN_EXPIRY_HOURS).toBe(24);
    expect(VERIFICATION_RESEND_COOLDOWN_SECONDS).toBe(120);
  });

  it("validates Indian mobile pattern", () => {
    expect(INDIAN_MOBILE_PATTERN.test("9729728501")).toBe(true);
    expect(INDIAN_MOBILE_PATTERN.test("1234567890")).toBe(false);
    expect(INDIAN_MOBILE_PATTERN.test("972972850")).toBe(false);
  });

  it("validates pincode pattern", () => {
    expect(PINCODE_PATTERN.test("122001")).toBe(true);
    expect(PINCODE_PATTERN.test("12345")).toBe(false);
    expect(PINCODE_PATTERN.test("ABCDEF")).toBe(false);
  });

  it("has 9 expense categories", () => {
    expect(EXPENSE_CATEGORIES).toHaveLength(9);
    expect(EXPENSE_CATEGORIES).toContain("MAINTENANCE");
    expect(EXPENSE_CATEGORIES).toContain("OTHER");
  });

  it("has floor levels", () => {
    expect(FLOOR_LEVELS).toContain("GF");
    expect(FLOOR_LEVELS).toContain("Terrace");
  });

  it("has all Indian states", () => {
    expect(INDIAN_STATES["HR"]).toBe("Haryana");
    expect(INDIAN_STATES["DL"]).toBe("Delhi");
    expect(Object.keys(INDIAN_STATES).length).toBeGreaterThanOrEqual(28);
  });
});
