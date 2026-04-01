import { describe, it, expect } from "vitest";

import {
  createRequestSchema,
  createMessageSchema,
  changeStatusSchema,
  isValidTransition,
} from "@/lib/validations/support";

describe("createRequestSchema", () => {
  it("accepts valid input", () => {
    const result = createRequestSchema.safeParse({
      type: "BUG_REPORT",
      subject: "Login broken",
      description: "Cannot log in since morning today",
    });
    expect(result.success).toBe(true);
  });

  it("rejects short subject", () => {
    const result = createRequestSchema.safeParse({
      type: "BUG_REPORT",
      subject: "Hi",
      description: "Long enough description here",
    });
    expect(result.success).toBe(false);
  });

  it("rejects short description", () => {
    const result = createRequestSchema.safeParse({
      type: "BUG_REPORT",
      subject: "Valid subject",
      description: "Short",
    });
    expect(result.success).toBe(false);
  });

  it("rejects invalid type", () => {
    const result = createRequestSchema.safeParse({
      type: "INVALID_TYPE",
      subject: "Valid subject",
      description: "Long enough description here",
    });
    expect(result.success).toBe(false);
  });

  it("defaults priority to MEDIUM", () => {
    const result = createRequestSchema.safeParse({
      type: "BUG_REPORT",
      subject: "Valid subject",
      description: "Long enough description here",
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.priority).toBe("MEDIUM");
  });
});

describe("createMessageSchema", () => {
  it("accepts valid message", () => {
    const result = createMessageSchema.safeParse({ content: "Hello" });
    expect(result.success).toBe(true);
  });

  it("rejects empty content", () => {
    const result = createMessageSchema.safeParse({ content: "" });
    expect(result.success).toBe(false);
  });

  it("defaults isInternal to false", () => {
    const result = createMessageSchema.safeParse({ content: "Test" });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.isInternal).toBe(false);
  });
});

describe("changeStatusSchema", () => {
  it("accepts valid status", () => {
    const result = changeStatusSchema.safeParse({ status: "IN_PROGRESS" });
    expect(result.success).toBe(true);
  });

  it("rejects invalid status", () => {
    const result = changeStatusSchema.safeParse({ status: "INVALID" });
    expect(result.success).toBe(false);
  });

  it("accepts optional reason", () => {
    const result = changeStatusSchema.safeParse({ status: "CLOSED", reason: "Duplicate" });
    expect(result.success).toBe(true);
  });
});

describe("isValidTransition", () => {
  it("OPEN → IN_PROGRESS is valid", () => {
    expect(isValidTransition("OPEN", "IN_PROGRESS")).toBe(true);
  });

  it("OPEN → CLOSED is valid", () => {
    expect(isValidTransition("OPEN", "CLOSED")).toBe(true);
  });

  it("IN_PROGRESS → RESOLVED is valid", () => {
    expect(isValidTransition("IN_PROGRESS", "RESOLVED")).toBe(true);
  });

  it("RESOLVED → OPEN is valid (reopen)", () => {
    expect(isValidTransition("RESOLVED", "OPEN")).toBe(true);
  });

  it("CLOSED → OPEN is invalid", () => {
    expect(isValidTransition("CLOSED", "OPEN")).toBe(false);
  });

  it("OPEN → RESOLVED is invalid", () => {
    expect(isValidTransition("OPEN", "RESOLVED")).toBe(false);
  });

  it("unknown status returns false", () => {
    expect(isValidTransition("UNKNOWN", "OPEN")).toBe(false);
  });
});
