import { describe, it, expect } from "vitest";

import { familyMemberSchema, familyMemberUpdateSchema } from "@/lib/validations/family";

const valid = {
  name: "Priya Bhagat",
  relationship: "SPOUSE" as const,
  isEmergencyContact: false,
};

describe("familyMemberSchema — base validation", () => {
  it("accepts minimal valid input", () => {
    expect(() => familyMemberSchema.parse(valid)).not.toThrow();
  });

  it("rejects name shorter than 2 chars", () => {
    expect(() => familyMemberSchema.parse({ ...valid, name: "A" })).toThrow();
  });

  it("rejects name longer than 100 chars", () => {
    expect(() => familyMemberSchema.parse({ ...valid, name: "A".repeat(101) })).toThrow();
  });

  it("rejects invalid relationship enum", () => {
    expect(() => familyMemberSchema.parse({ ...valid, relationship: "INVALID" })).toThrow();
  });

  it("accepts all valid BloodGroup values", () => {
    const groups = [
      "A_POS",
      "A_NEG",
      "B_POS",
      "B_NEG",
      "AB_POS",
      "AB_NEG",
      "O_POS",
      "O_NEG",
      "UNKNOWN",
    ];
    for (const bg of groups) {
      expect(() => familyMemberSchema.parse({ ...valid, bloodGroup: bg })).not.toThrow();
    }
  });

  it("rejects invalid blood group", () => {
    expect(() => familyMemberSchema.parse({ ...valid, bloodGroup: "X_POS" })).toThrow();
  });

  it("accepts valid Indian mobile", () => {
    expect(() => familyMemberSchema.parse({ ...valid, mobile: "9876543210" })).not.toThrow();
  });

  it("rejects invalid mobile format (starts with 5)", () => {
    expect(() => familyMemberSchema.parse({ ...valid, mobile: "5876543210" })).toThrow();
  });

  it("accepts empty string for mobile (optional)", () => {
    expect(() => familyMemberSchema.parse({ ...valid, mobile: "" })).not.toThrow();
  });

  it("accepts valid email", () => {
    expect(() => familyMemberSchema.parse({ ...valid, email: "priya@example.com" })).not.toThrow();
  });

  it("rejects invalid email format", () => {
    expect(() => familyMemberSchema.parse({ ...valid, email: "not-an-email" })).toThrow();
  });

  it("accepts empty string for email (optional)", () => {
    expect(() => familyMemberSchema.parse({ ...valid, email: "" })).not.toThrow();
  });

  it("rejects occupation longer than 100 chars", () => {
    expect(() => familyMemberSchema.parse({ ...valid, occupation: "A".repeat(101) })).toThrow();
  });

  it("rejects medicalNotes longer than 500 chars", () => {
    expect(() => familyMemberSchema.parse({ ...valid, medicalNotes: "A".repeat(501) })).toThrow();
  });

  it("rejects emergencyPriority < 1", () => {
    expect(() =>
      familyMemberSchema.parse({ ...valid, isEmergencyContact: true, emergencyPriority: 0 }),
    ).toThrow();
  });

  it("rejects emergencyPriority > 2", () => {
    expect(() =>
      familyMemberSchema.parse({ ...valid, isEmergencyContact: true, emergencyPriority: 3 }),
    ).toThrow();
  });

  it("rejects non-integer emergencyPriority", () => {
    expect(() =>
      familyMemberSchema.parse({ ...valid, isEmergencyContact: true, emergencyPriority: 1.5 }),
    ).toThrow();
  });
});

describe("familyMemberSchema — conditional: OTHER relationship", () => {
  it("rejects OTHER relationship without otherRelationship text", () => {
    const result = familyMemberSchema.safeParse({ ...valid, relationship: "OTHER" });
    expect(result.success).toBe(false);
    if (!result.success) {
      const paths = result.error.issues.map((i) => i.path.join("."));
      expect(paths).toContain("otherRelationship");
    }
  });

  it("rejects OTHER relationship with blank otherRelationship", () => {
    const result = familyMemberSchema.safeParse({
      ...valid,
      relationship: "OTHER",
      otherRelationship: "   ",
    });
    expect(result.success).toBe(false);
  });

  it("accepts OTHER relationship when otherRelationship is provided", () => {
    expect(() =>
      familyMemberSchema.parse({
        ...valid,
        relationship: "OTHER",
        otherRelationship: "Family Friend",
      }),
    ).not.toThrow();
  });

  it("does not require otherRelationship for non-OTHER relationships", () => {
    expect(() => familyMemberSchema.parse({ ...valid, relationship: "SPOUSE" })).not.toThrow();
  });
});

describe("familyMemberSchema — conditional: emergency contact", () => {
  it("requires emergencyPriority when isEmergencyContact=true", () => {
    const result = familyMemberSchema.safeParse({ ...valid, isEmergencyContact: true });
    expect(result.success).toBe(false);
    if (!result.success) {
      const paths = result.error.issues.map((i) => i.path.join("."));
      expect(paths).toContain("emergencyPriority");
    }
  });

  it("accepts isEmergencyContact=true with priority=1", () => {
    expect(() =>
      familyMemberSchema.parse({ ...valid, isEmergencyContact: true, emergencyPriority: 1 }),
    ).not.toThrow();
  });

  it("accepts isEmergencyContact=true with priority=2", () => {
    expect(() =>
      familyMemberSchema.parse({ ...valid, isEmergencyContact: true, emergencyPriority: 2 }),
    ).not.toThrow();
  });

  it("does not require emergencyPriority when isEmergencyContact=false", () => {
    expect(() => familyMemberSchema.parse({ ...valid, isEmergencyContact: false })).not.toThrow();
  });

  it("defaults isEmergencyContact to false when omitted", () => {
    const result = familyMemberSchema.parse({ name: "Test Person", relationship: "SON" });
    expect(result.isEmergencyContact).toBe(false);
  });
});

describe("familyMemberUpdateSchema — partial update validation", () => {
  it("accepts partial update with just a name", () => {
    const result = familyMemberUpdateSchema.safeParse({ name: "New Name" });
    expect(result.success).toBe(true);
  });

  it("rejects OTHER relationship without otherRelationship", () => {
    const result = familyMemberUpdateSchema.safeParse({ relationship: "OTHER" });
    expect(result.success).toBe(false);
    if (!result.success) {
      const paths = result.error.issues.map((i) => i.path.join("."));
      expect(paths).toContain("otherRelationship");
    }
  });

  it("requires emergencyPriority when isEmergencyContact=true", () => {
    const result = familyMemberUpdateSchema.safeParse({ isEmergencyContact: true });
    expect(result.success).toBe(false);
    if (!result.success) {
      const paths = result.error.issues.map((i) => i.path.join("."));
      expect(paths).toContain("emergencyPriority");
    }
  });

  it("accepts valid update with isEmergencyContact=true and priority", () => {
    const result = familyMemberUpdateSchema.safeParse({
      isEmergencyContact: true,
      emergencyPriority: 1,
    });
    expect(result.success).toBe(true);
  });
});
