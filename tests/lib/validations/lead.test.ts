import { describe, expect, it } from "vitest";

import { leadSchema } from "@/lib/validations/lead";

const valid = {
  name: "Arjun Kapoor",
  email: "arjun@example.com",
  phone: "+91 98765 43210",
  societyName: "Greenwood Residency",
  unitCount: "120",
  message: "Interested in a demo",
  honeypot: "",
};

describe("leadSchema", () => {
  it("passes with all fields populated", () => {
    expect(leadSchema.safeParse(valid).success).toBe(true);
  });

  it("passes with only the required fields (name, email, phone)", () => {
    const result = leadSchema.safeParse({
      name: "Asha",
      email: "a@b.co",
      phone: "9876543210",
    });
    expect(result.success).toBe(true);
  });

  it("fails when name is shorter than 2 characters", () => {
    const result = leadSchema.safeParse({ ...valid, name: "A" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0].message).toBe("Name is required");
    }
  });

  it("fails when name exceeds 120 characters", () => {
    const result = leadSchema.safeParse({ ...valid, name: "a".repeat(121) });
    expect(result.success).toBe(false);
  });

  it("fails when email is not a valid email", () => {
    const result = leadSchema.safeParse({ ...valid, email: "not-an-email" });
    expect(result.success).toBe(false);
  });

  it("fails when email exceeds 120 characters", () => {
    const result = leadSchema.safeParse({
      ...valid,
      email: `${"a".repeat(120)}@b.co`,
    });
    expect(result.success).toBe(false);
  });

  it("fails when phone is missing", () => {
    const { phone: _phone, ...rest } = valid;
    const result = leadSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it("fails when phone is an empty string", () => {
    const result = leadSchema.safeParse({ ...valid, phone: "" });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.map((i) => i.message)).toContain("Phone is required");
    }
  });

  it("fails when phone has invalid characters", () => {
    const result = leadSchema.safeParse({ ...valid, phone: "abc-xyz" });
    expect(result.success).toBe(false);
  });

  it("fails when phone is shorter than 6 characters", () => {
    const result = leadSchema.safeParse({ ...valid, phone: "12345" });
    expect(result.success).toBe(false);
  });

  it("passes when societyName is omitted or empty", () => {
    expect(leadSchema.safeParse({ ...valid, societyName: "" }).success).toBe(true);
    const { societyName: _s, ...rest } = valid;
    expect(leadSchema.safeParse(rest).success).toBe(true);
  });

  it("fails when societyName exceeds 200 characters", () => {
    const result = leadSchema.safeParse({ ...valid, societyName: "a".repeat(201) });
    expect(result.success).toBe(false);
  });

  it("passes when unitCount is empty", () => {
    expect(leadSchema.safeParse({ ...valid, unitCount: "" }).success).toBe(true);
  });

  it("fails when unitCount contains non-digits", () => {
    const result = leadSchema.safeParse({ ...valid, unitCount: "12a" });
    expect(result.success).toBe(false);
  });

  it("passes when message is empty", () => {
    expect(leadSchema.safeParse({ ...valid, message: "" }).success).toBe(true);
  });

  it("fails when message exceeds 2000 characters", () => {
    const result = leadSchema.safeParse({ ...valid, message: "x".repeat(2001) });
    expect(result.success).toBe(false);
  });

  it("fails when honeypot is non-empty", () => {
    const result = leadSchema.safeParse({ ...valid, honeypot: "bot" });
    expect(result.success).toBe(false);
  });

  it("passes when honeypot is omitted", () => {
    const { honeypot: _h, ...rest } = valid;
    expect(leadSchema.safeParse(rest).success).toBe(true);
  });
});
