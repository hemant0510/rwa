import { describe, it, expect } from "vitest";

import {
  createCounsellorSchema,
  updateCounsellorSchema,
  updateCounsellorSelfSchema,
  assignSocietiesSchema,
  transferPortfolioSchema,
} from "@/lib/validations/counsellor";

// ─── createCounsellorSchema ───────────────────────────────────────

describe("createCounsellorSchema", () => {
  const valid = {
    name: "Asha Patel",
    email: "asha@eden.com",
    mobile: "+91 9876543210",
    nationalId: "AAAAA1111A",
    bio: "Ombudsperson, 10 years experience.",
    publicBlurb: "Neutral advisor for RWA Connect societies.",
  };

  it("accepts valid input", () => {
    expect(createCounsellorSchema.safeParse(valid).success).toBe(true);
  });

  it("accepts input without optional fields", () => {
    expect(
      createCounsellorSchema.safeParse({ name: "Asha Patel", email: "asha@eden.com" }).success,
    ).toBe(true);
  });

  it("rejects name shorter than 2 chars", () => {
    expect(createCounsellorSchema.safeParse({ ...valid, name: "A" }).success).toBe(false);
  });

  it("rejects name longer than 100 chars", () => {
    expect(createCounsellorSchema.safeParse({ ...valid, name: "A".repeat(101) }).success).toBe(
      false,
    );
  });

  it("rejects invalid email", () => {
    expect(createCounsellorSchema.safeParse({ ...valid, email: "not-an-email" }).success).toBe(
      false,
    );
  });

  it("rejects invalid mobile", () => {
    expect(createCounsellorSchema.safeParse({ ...valid, mobile: "abc" }).success).toBe(false);
  });

  it("accepts null mobile", () => {
    expect(createCounsellorSchema.safeParse({ ...valid, mobile: null }).success).toBe(true);
  });

  it("rejects nationalId shorter than 3 chars", () => {
    expect(createCounsellorSchema.safeParse({ ...valid, nationalId: "A" }).success).toBe(false);
  });

  it("rejects bio longer than 5000 chars", () => {
    expect(createCounsellorSchema.safeParse({ ...valid, bio: "x".repeat(5001) }).success).toBe(
      false,
    );
  });

  it("rejects publicBlurb longer than 500 chars", () => {
    expect(
      createCounsellorSchema.safeParse({ ...valid, publicBlurb: "x".repeat(501) }).success,
    ).toBe(false);
  });
});

// ─── updateCounsellorSchema ───────────────────────────────────────

describe("updateCounsellorSchema", () => {
  it("accepts partial input", () => {
    expect(updateCounsellorSchema.safeParse({ name: "New Name" }).success).toBe(true);
  });

  it("accepts isActive toggle", () => {
    expect(updateCounsellorSchema.safeParse({ isActive: false }).success).toBe(true);
  });

  it("accepts empty object", () => {
    expect(updateCounsellorSchema.safeParse({}).success).toBe(true);
  });

  it("rejects invalid mobile", () => {
    expect(updateCounsellorSchema.safeParse({ mobile: "abc" }).success).toBe(false);
  });

  it("accepts null for optional nullable fields", () => {
    expect(
      updateCounsellorSchema.safeParse({ mobile: null, nationalId: null, bio: null }).success,
    ).toBe(true);
  });
});

// ─── updateCounsellorSelfSchema ───────────────────────────────────

describe("updateCounsellorSelfSchema", () => {
  it("accepts valid self-update", () => {
    expect(
      updateCounsellorSelfSchema.safeParse({
        name: "Updated",
        bio: "Updated bio",
        photoUrl: "https://example.com/photo.jpg",
      }).success,
    ).toBe(true);
  });

  it("rejects invalid photo URL", () => {
    expect(updateCounsellorSelfSchema.safeParse({ photoUrl: "not a url" }).success).toBe(false);
  });

  it("accepts null photoUrl", () => {
    expect(updateCounsellorSelfSchema.safeParse({ photoUrl: null }).success).toBe(true);
  });
});

// ─── assignSocietiesSchema ────────────────────────────────────────

describe("assignSocietiesSchema", () => {
  it("accepts a single society UUID", () => {
    expect(
      assignSocietiesSchema.safeParse({
        societyIds: ["550e8400-e29b-41d4-a716-446655440000"],
      }).success,
    ).toBe(true);
  });

  it("rejects empty societyIds array", () => {
    expect(assignSocietiesSchema.safeParse({ societyIds: [] }).success).toBe(false);
  });

  it("rejects non-UUID societyIds", () => {
    expect(assignSocietiesSchema.safeParse({ societyIds: ["not-a-uuid"] }).success).toBe(false);
  });

  it("rejects more than 1000 societyIds", () => {
    const ids = Array.from({ length: 1001 }, () => "550e8400-e29b-41d4-a716-446655440000");
    expect(assignSocietiesSchema.safeParse({ societyIds: ids }).success).toBe(false);
  });

  it("accepts notes", () => {
    expect(
      assignSocietiesSchema.safeParse({
        societyIds: ["550e8400-e29b-41d4-a716-446655440000"],
        notes: "East-Delhi zone",
      }).success,
    ).toBe(true);
  });

  it("rejects notes longer than 500 chars", () => {
    expect(
      assignSocietiesSchema.safeParse({
        societyIds: ["550e8400-e29b-41d4-a716-446655440000"],
        notes: "x".repeat(501),
      }).success,
    ).toBe(false);
  });
});

// ─── transferPortfolioSchema ──────────────────────────────────────

describe("transferPortfolioSchema", () => {
  it("accepts valid target counsellor", () => {
    expect(
      transferPortfolioSchema.safeParse({
        targetCounsellorId: "550e8400-e29b-41d4-a716-446655440000",
      }).success,
    ).toBe(true);
  });

  it("accepts optional societyIds subset", () => {
    expect(
      transferPortfolioSchema.safeParse({
        targetCounsellorId: "550e8400-e29b-41d4-a716-446655440000",
        societyIds: ["550e8400-e29b-41d4-a716-446655440001"],
      }).success,
    ).toBe(true);
  });

  it("rejects invalid target counsellor UUID", () => {
    expect(transferPortfolioSchema.safeParse({ targetCounsellorId: "bad" }).success).toBe(false);
  });

  it("rejects invalid societyId in list", () => {
    expect(
      transferPortfolioSchema.safeParse({
        targetCounsellorId: "550e8400-e29b-41d4-a716-446655440000",
        societyIds: ["bad"],
      }).success,
    ).toBe(false);
  });
});
