import { describe, it, expect } from "vitest";

import {
  registerResidentSchema,
  unitFieldsSchema,
  getBuilderFloorsSchema,
} from "@/lib/validations/resident";

describe("registerResidentSchema", () => {
  const validInput = {
    fullName: "Hemant Bhagat",
    mobile: "9729728501",
    ownershipType: "OWNER" as const,
    email: "hemant@example.com",
    password: "password123",
    passwordConfirm: "password123",
    consentWhatsApp: true as const,
  };

  it("passes with valid input", () => {
    const result = registerResidentSchema.safeParse(validInput);
    expect(result.success).toBe(true);
  });

  it("fails with short name", () => {
    const result = registerResidentSchema.safeParse({ ...validInput, fullName: "H" });
    expect(result.success).toBe(false);
  });

  it("fails with name over 100 chars", () => {
    const result = registerResidentSchema.safeParse({ ...validInput, fullName: "A".repeat(101) });
    expect(result.success).toBe(false);
  });

  it("fails with invalid mobile number", () => {
    const result = registerResidentSchema.safeParse({ ...validInput, mobile: "1234567890" });
    expect(result.success).toBe(false);
  });

  it("fails with mobile starting with 5", () => {
    const result = registerResidentSchema.safeParse({ ...validInput, mobile: "5729728501" });
    expect(result.success).toBe(false);
  });

  it("fails with short mobile", () => {
    const result = registerResidentSchema.safeParse({ ...validInput, mobile: "97297285" });
    expect(result.success).toBe(false);
  });

  it("fails with invalid ownership type", () => {
    const result = registerResidentSchema.safeParse({ ...validInput, ownershipType: "RENTER" });
    expect(result.success).toBe(false);
  });

  it("fails with invalid email", () => {
    const result = registerResidentSchema.safeParse({ ...validInput, email: "notanemail" });
    expect(result.success).toBe(false);
  });

  it("fails with short password", () => {
    const result = registerResidentSchema.safeParse({
      ...validInput,
      password: "short",
      passwordConfirm: "short",
    });
    expect(result.success).toBe(false);
  });

  it("fails when passwords do not match", () => {
    const result = registerResidentSchema.safeParse({
      ...validInput,
      passwordConfirm: "different123",
    });
    expect(result.success).toBe(false);
  });

  it("fails when consentWhatsApp is false", () => {
    const result = registerResidentSchema.safeParse({ ...validInput, consentWhatsApp: false });
    expect(result.success).toBe(false);
  });

  it("accepts TENANT ownership type", () => {
    const result = registerResidentSchema.safeParse({ ...validInput, ownershipType: "TENANT" });
    expect(result.success).toBe(true);
  });

  it("accepts OTHER ownership type with valid detail", () => {
    const result = registerResidentSchema.safeParse({
      ...validInput,
      ownershipType: "OTHER",
      otherOwnershipDetail: "Co-owner",
    });
    expect(result.success).toBe(true);
  });

  it("fails OTHER ownership type without detail", () => {
    const result = registerResidentSchema.safeParse({
      ...validInput,
      ownershipType: "OTHER",
    });
    expect(result.success).toBe(false);
  });

  it("passes when reuseAuth is true (no password required)", () => {
    const result = registerResidentSchema.safeParse({
      ...validInput,
      reuseAuth: true,
      password: undefined,
      passwordConfirm: undefined,
    });
    expect(result.success).toBe(true);
  });
});

describe("unitFieldsSchema", () => {
  it("validates APARTMENT_COMPLEX fields", () => {
    const schema = unitFieldsSchema.APARTMENT_COMPLEX;
    const result = schema.safeParse({ towerBlock: "A", floorNo: "3", flatNo: "301" });
    expect(result.success).toBe(true);
  });

  it("fails APARTMENT_COMPLEX without required fields", () => {
    const schema = unitFieldsSchema.APARTMENT_COMPLEX;
    const result = schema.safeParse({ towerBlock: "A" });
    expect(result.success).toBe(false);
  });

  it("validates BUILDER_FLOORS_FLOOR fields", () => {
    const schema = unitFieldsSchema.BUILDER_FLOORS_FLOOR;
    const result = schema.safeParse({ houseNo: "42", floorLevel: "1F" });
    expect(result.success).toBe(true);
  });

  it("validates GATED_COMMUNITY_VILLAS fields", () => {
    const schema = unitFieldsSchema.GATED_COMMUNITY_VILLAS;
    const result = schema.safeParse({ villaNo: "V-12" });
    expect(result.success).toBe(true);
  });

  it("validates GATED_COMMUNITY_VILLAS with optional streetPhase", () => {
    const schema = unitFieldsSchema.GATED_COMMUNITY_VILLAS;
    const result = schema.safeParse({ villaNo: "V-12", streetPhase: "Phase 2" });
    expect(result.success).toBe(true);
  });

  it("validates INDEPENDENT_SECTOR fields", () => {
    const schema = unitFieldsSchema.INDEPENDENT_SECTOR;
    const result = schema.safeParse({
      houseNo: "42",
      streetGali: "Street 5",
      sectorBlock: "Sector 28",
    });
    expect(result.success).toBe(true);
  });

  it("validates PLOTTED_COLONY fields", () => {
    const schema = unitFieldsSchema.PLOTTED_COLONY;
    const result = schema.safeParse({ plotNo: "P-42" });
    expect(result.success).toBe(true);
  });

  it("validates PLOTTED_COLONY with optional fields", () => {
    const schema = unitFieldsSchema.PLOTTED_COLONY;
    const result = schema.safeParse({ plotNo: "P-42", laneNo: "L-3", phase: "Phase 1" });
    expect(result.success).toBe(true);
  });
});

describe("getBuilderFloorsSchema", () => {
  it("returns FLOOR schema for FLOOR unit type", () => {
    const schema = getBuilderFloorsSchema("FLOOR");
    const result = schema.safeParse({ houseNo: "42", floorLevel: "1F" });
    expect(result.success).toBe(true);
  });

  it("returns HOUSE schema for HOUSE unit type", () => {
    const schema = getBuilderFloorsSchema("HOUSE");
    const result = schema.safeParse({ houseNo: "42" });
    expect(result.success).toBe(true);
  });
});
