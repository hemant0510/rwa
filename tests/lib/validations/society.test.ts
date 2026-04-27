import { describe, it, expect } from "vitest";

import { SOCIETY_TYPES, createSocietySchema, updateSocietySchema } from "@/lib/validations/society";

describe("SOCIETY_TYPES", () => {
  it("contains all 5 types", () => {
    expect(SOCIETY_TYPES).toHaveLength(5);
    expect(SOCIETY_TYPES).toContain("APARTMENT_COMPLEX");
    expect(SOCIETY_TYPES).toContain("BUILDER_FLOORS");
    expect(SOCIETY_TYPES).toContain("GATED_COMMUNITY_VILLAS");
    expect(SOCIETY_TYPES).toContain("INDEPENDENT_SECTOR");
    expect(SOCIETY_TYPES).toContain("PLOTTED_COLONY");
  });
});

describe("createSocietySchema", () => {
  const validInput = {
    name: "Greenwood Residency RWA",
    state: "HR",
    city: "Gurugram",
    pincode: "122001",
    type: "APARTMENT_COMPLEX" as const,
    societyCode: "GRNW",
    joiningFee: 1000,
    annualFee: 1200,
    adminName: "Arjun Kapoor",
    adminEmail: "arjun@example.com",
    adminPassword: "password123",
    adminPasswordConfirm: "password123",
  };

  it("passes with valid input", () => {
    const result = createSocietySchema.safeParse(validInput);
    expect(result.success).toBe(true);
  });

  it("fails with short name", () => {
    const result = createSocietySchema.safeParse({ ...validInput, name: "AB" });
    expect(result.success).toBe(false);
  });

  it("fails with invalid state code", () => {
    const result = createSocietySchema.safeParse({ ...validInput, state: "HARYANA" });
    expect(result.success).toBe(false);
  });

  it("fails with invalid pincode", () => {
    const result = createSocietySchema.safeParse({ ...validInput, pincode: "12345" });
    expect(result.success).toBe(false);
  });

  it("fails with non-numeric pincode", () => {
    const result = createSocietySchema.safeParse({ ...validInput, pincode: "ABCDEF" });
    expect(result.success).toBe(false);
  });

  it("fails with short society code", () => {
    const result = createSocietySchema.safeParse({ ...validInput, societyCode: "AB" });
    expect(result.success).toBe(false);
  });

  it("fails with long society code", () => {
    const result = createSocietySchema.safeParse({ ...validInput, societyCode: "ABCDEFGHI" });
    expect(result.success).toBe(false);
  });

  it("fails with negative joining fee", () => {
    const result = createSocietySchema.safeParse({ ...validInput, joiningFee: -100 });
    expect(result.success).toBe(false);
  });

  it("fails with fee over 100000", () => {
    const result = createSocietySchema.safeParse({ ...validInput, annualFee: 200000 });
    expect(result.success).toBe(false);
  });

  it("fails when passwords don't match", () => {
    const result = createSocietySchema.safeParse({
      ...validInput,
      adminPasswordConfirm: "different123",
    });
    expect(result.success).toBe(false);
  });

  it("accepts optional admin mobile", () => {
    const result = createSocietySchema.safeParse({ ...validInput, adminMobile: "9729728501" });
    expect(result.success).toBe(true);
  });

  it("fails with invalid admin mobile", () => {
    const result = createSocietySchema.safeParse({ ...validInput, adminMobile: "1234567890" });
    expect(result.success).toBe(false);
  });
});

describe("updateSocietySchema", () => {
  const validUpdate = {
    name: "Greenwood Residency RWA Updated",
    state: "HR",
    city: "Gurugram",
    pincode: "122001",
    type: "APARTMENT_COMPLEX" as const,
    joiningFee: 1000,
    annualFee: 1500,
  };

  it("passes with valid input", () => {
    const result = updateSocietySchema.safeParse(validUpdate);
    expect(result.success).toBe(true);
  });

  it("accepts optional status", () => {
    const result = updateSocietySchema.safeParse({ ...validUpdate, status: "ACTIVE" });
    expect(result.success).toBe(true);
  });

  it("accepts optional emailVerificationRequired", () => {
    const result = updateSocietySchema.safeParse({
      ...validUpdate,
      emailVerificationRequired: false,
    });
    expect(result.success).toBe(true);
  });

  it("passes when admin password fields are provided and match", () => {
    const result = updateSocietySchema.safeParse({
      ...validUpdate,
      adminPassword: "newpassword123",
      adminPasswordConfirm: "newpassword123",
    });
    expect(result.success).toBe(true);
  });

  it("fails when admin password provided but doesn't match confirm", () => {
    const result = updateSocietySchema.safeParse({
      ...validUpdate,
      adminPassword: "newpassword123",
      adminPasswordConfirm: "different123",
    });
    expect(result.success).toBe(false);
  });
});
