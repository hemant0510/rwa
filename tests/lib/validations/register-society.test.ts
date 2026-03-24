import { describe, it, expect } from "vitest";

import { registerSocietySchema } from "@/lib/validations/register-society";

describe("registerSocietySchema", () => {
  const validInput = {
    name: "Eden Estate RWA",
    state: "HR",
    city: "Gurugram",
    pincode: "122001",
    type: "APARTMENT_COMPLEX" as const,
    societyCode: "EDEN",
    adminName: "Hemant Bhagat",
    adminEmail: "hemant@example.com",
    adminPassword: "password123",
    adminPasswordConfirm: "password123",
  };

  it("passes with valid input", () => {
    const result = registerSocietySchema.safeParse(validInput);
    expect(result.success).toBe(true);
  });

  it("fails with short name", () => {
    const result = registerSocietySchema.safeParse({ ...validInput, name: "AB" });
    expect(result.success).toBe(false);
  });

  it("fails with invalid state", () => {
    const result = registerSocietySchema.safeParse({ ...validInput, state: "X" });
    expect(result.success).toBe(false);
  });

  it("fails with short city", () => {
    const result = registerSocietySchema.safeParse({ ...validInput, city: "G" });
    expect(result.success).toBe(false);
  });

  it("fails with invalid pincode", () => {
    const result = registerSocietySchema.safeParse({ ...validInput, pincode: "1234" });
    expect(result.success).toBe(false);
  });

  it("fails with short society code", () => {
    const result = registerSocietySchema.safeParse({ ...validInput, societyCode: "AB" });
    expect(result.success).toBe(false);
  });

  it("fails when passwords don't match", () => {
    const result = registerSocietySchema.safeParse({
      ...validInput,
      adminPasswordConfirm: "different",
    });
    expect(result.success).toBe(false);
  });

  it("fails with invalid admin email", () => {
    const result = registerSocietySchema.safeParse({ ...validInput, adminEmail: "notanemail" });
    expect(result.success).toBe(false);
  });

  it("fails with short admin password", () => {
    const result = registerSocietySchema.safeParse({
      ...validInput,
      adminPassword: "short",
      adminPasswordConfirm: "short",
    });
    expect(result.success).toBe(false);
  });

  it("accepts optional admin mobile", () => {
    const result = registerSocietySchema.safeParse({ ...validInput, adminMobile: "9729728501" });
    expect(result.success).toBe(true);
  });

  it("fails with invalid admin mobile", () => {
    const result = registerSocietySchema.safeParse({ ...validInput, adminMobile: "1234" });
    expect(result.success).toBe(false);
  });

  it("accepts all valid society types", () => {
    const types = [
      "APARTMENT_COMPLEX",
      "BUILDER_FLOORS",
      "GATED_COMMUNITY_VILLAS",
      "INDEPENDENT_SECTOR",
      "PLOTTED_COLONY",
    ];
    for (const type of types) {
      const result = registerSocietySchema.safeParse({ ...validInput, type });
      expect(result.success).toBe(true);
    }
  });

  // ─── New optional fields ────────────────────────────────────────────────────

  it("accepts optional registrationNo", () => {
    const result = registerSocietySchema.safeParse({
      ...validInput,
      registrationNo: "DL/RWA/2019/0042",
    });
    expect(result.success).toBe(true);
  });

  it("fails when registrationNo exceeds 50 chars", () => {
    const result = registerSocietySchema.safeParse({
      ...validInput,
      registrationNo: "X".repeat(51),
    });
    expect(result.success).toBe(false);
  });

  it("accepts optional registrationDate in YYYY-MM-DD format", () => {
    const result = registerSocietySchema.safeParse({
      ...validInput,
      registrationDate: "2019-04-15",
    });
    expect(result.success).toBe(true);
  });

  it("fails with registrationDate in wrong format", () => {
    const result = registerSocietySchema.safeParse({
      ...validInput,
      registrationDate: "15-04-2019",
    });
    expect(result.success).toBe(false);
  });

  it("fails with registrationDate as plain text", () => {
    const result = registerSocietySchema.safeParse({
      ...validInput,
      registrationDate: "not-a-date",
    });
    expect(result.success).toBe(false);
  });

  it("accepts empty string for registrationDate (form default when left blank)", () => {
    const result = registerSocietySchema.safeParse({
      ...validInput,
      registrationDate: "",
    });
    expect(result.success).toBe(true);
  });

  it("accepts optional selectedPlanId as valid UUID", () => {
    const result = registerSocietySchema.safeParse({
      ...validInput,
      selectedPlanId: "550e8400-e29b-41d4-a716-446655440000",
    });
    expect(result.success).toBe(true);
  });

  it("fails with selectedPlanId that is not a UUID", () => {
    const result = registerSocietySchema.safeParse({
      ...validInput,
      selectedPlanId: "not-a-uuid",
    });
    expect(result.success).toBe(false);
  });

  it("passes without any optional fields", () => {
    const result = registerSocietySchema.safeParse(validInput);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.registrationNo).toBeUndefined();
      expect(result.data.registrationDate).toBeUndefined();
      expect(result.data.selectedPlanId).toBeUndefined();
    }
  });
});
