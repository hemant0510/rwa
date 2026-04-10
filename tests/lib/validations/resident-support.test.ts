import { describe, it, expect } from "vitest";

import {
  createResidentTicketSchema,
  createResidentTicketMessageSchema,
  changeResidentTicketStatusSchema,
  changeResidentTicketPrioritySchema,
  linkPetitionSchema,
  validateAttachment,
  isValidTransition,
  VALID_TRANSITIONS,
  RESIDENT_TICKET_TYPES,
  RESIDENT_TICKET_PRIORITIES,
  RESIDENT_TICKET_STATUSES,
  RESIDENT_TICKET_TYPE_LABELS,
  RESIDENT_TICKET_PRIORITY_LABELS,
  RESIDENT_TICKET_STATUS_LABELS,
  ALLOWED_ATTACHMENT_MIME_TYPES,
  MAX_ATTACHMENT_SIZE_BYTES,
} from "@/lib/validations/resident-support";

// ─── createResidentTicketSchema ───────────────────────────────────

describe("createResidentTicketSchema", () => {
  const validInput = {
    type: "MAINTENANCE_ISSUE" as const,
    subject: "Water leak in lobby",
    description:
      "There is a water leak near the entrance of the lobby that needs immediate attention.",
  };

  it("accepts valid input", () => {
    const result = createResidentTicketSchema.safeParse(validInput);
    expect(result.success).toBe(true);
  });

  it("accepts all valid types", () => {
    for (const type of RESIDENT_TICKET_TYPES) {
      const result = createResidentTicketSchema.safeParse({ ...validInput, type });
      expect(result.success).toBe(true);
    }
  });

  it("rejects invalid type", () => {
    const result = createResidentTicketSchema.safeParse({
      ...validInput,
      type: "INVALID_TYPE",
    });
    expect(result.success).toBe(false);
  });

  it("rejects subject shorter than 5 characters", () => {
    const result = createResidentTicketSchema.safeParse({
      ...validInput,
      subject: "Hi",
    });
    expect(result.success).toBe(false);
  });

  it("accepts subject at exactly 5 characters", () => {
    const result = createResidentTicketSchema.safeParse({
      ...validInput,
      subject: "Hello",
    });
    expect(result.success).toBe(true);
  });

  it("rejects subject longer than 200 characters", () => {
    const result = createResidentTicketSchema.safeParse({
      ...validInput,
      subject: "A".repeat(201),
    });
    expect(result.success).toBe(false);
  });

  it("accepts subject at exactly 200 characters", () => {
    const result = createResidentTicketSchema.safeParse({
      ...validInput,
      subject: "A".repeat(200),
    });
    expect(result.success).toBe(true);
  });

  it("rejects description shorter than 20 characters", () => {
    const result = createResidentTicketSchema.safeParse({
      ...validInput,
      description: "Short",
    });
    expect(result.success).toBe(false);
  });

  it("accepts description at exactly 20 characters", () => {
    const result = createResidentTicketSchema.safeParse({
      ...validInput,
      description: "A".repeat(20),
    });
    expect(result.success).toBe(true);
  });

  it("rejects description longer than 5000 characters", () => {
    const result = createResidentTicketSchema.safeParse({
      ...validInput,
      description: "A".repeat(5001),
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing type", () => {
    const { type: _, ...withoutType } = validInput;
    void _;
    const result = createResidentTicketSchema.safeParse(withoutType);
    expect(result.success).toBe(false);
  });

  it("rejects missing subject", () => {
    const { subject: _, ...withoutSubject } = validInput;
    void _;
    const result = createResidentTicketSchema.safeParse(withoutSubject);
    expect(result.success).toBe(false);
  });

  it("rejects missing description", () => {
    const { description: _, ...withoutDesc } = validInput;
    void _;
    const result = createResidentTicketSchema.safeParse(withoutDesc);
    expect(result.success).toBe(false);
  });

  it("does NOT accept priority field (residents cannot set priority)", () => {
    const result = createResidentTicketSchema.safeParse({
      ...validInput,
      priority: "HIGH",
    });
    // Zod strips unknown keys by default, so it succeeds but priority is not in output
    expect(result.success).toBe(true);
    if (result.success) {
      expect("priority" in result.data).toBe(false);
    }
  });
});

// ─── createResidentTicketMessageSchema ────────────────────────────

describe("createResidentTicketMessageSchema", () => {
  it("accepts valid message", () => {
    const result = createResidentTicketMessageSchema.safeParse({
      content: "Hello, any update?",
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty content", () => {
    const result = createResidentTicketMessageSchema.safeParse({ content: "" });
    expect(result.success).toBe(false);
  });

  it("rejects content over 5000 characters", () => {
    const result = createResidentTicketMessageSchema.safeParse({
      content: "A".repeat(5001),
    });
    expect(result.success).toBe(false);
  });

  it("accepts content at exactly 5000 characters", () => {
    const result = createResidentTicketMessageSchema.safeParse({
      content: "A".repeat(5000),
    });
    expect(result.success).toBe(true);
  });

  it("defaults isInternal to false", () => {
    const result = createResidentTicketMessageSchema.safeParse({
      content: "Test",
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.isInternal).toBe(false);
  });

  it("accepts isInternal as true", () => {
    const result = createResidentTicketMessageSchema.safeParse({
      content: "Internal note",
      isInternal: true,
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.isInternal).toBe(true);
  });
});

// ─── changeResidentTicketStatusSchema ─────────────────────────────

describe("changeResidentTicketStatusSchema", () => {
  it("accepts valid status", () => {
    const result = changeResidentTicketStatusSchema.safeParse({
      status: "IN_PROGRESS",
    });
    expect(result.success).toBe(true);
  });

  it("accepts all valid statuses", () => {
    for (const status of RESIDENT_TICKET_STATUSES) {
      const result = changeResidentTicketStatusSchema.safeParse({ status });
      expect(result.success).toBe(true);
    }
  });

  it("rejects invalid status", () => {
    const result = changeResidentTicketStatusSchema.safeParse({
      status: "INVALID",
    });
    expect(result.success).toBe(false);
  });

  it("accepts optional reason", () => {
    const result = changeResidentTicketStatusSchema.safeParse({
      status: "CLOSED",
      reason: "Duplicate ticket",
    });
    expect(result.success).toBe(true);
    if (result.success) expect(result.data.reason).toBe("Duplicate ticket");
  });

  it("accepts missing reason", () => {
    const result = changeResidentTicketStatusSchema.safeParse({
      status: "RESOLVED",
    });
    expect(result.success).toBe(true);
  });

  it("rejects reason over 1000 characters", () => {
    const result = changeResidentTicketStatusSchema.safeParse({
      status: "CLOSED",
      reason: "A".repeat(1001),
    });
    expect(result.success).toBe(false);
  });
});

// ─── changeResidentTicketPrioritySchema ───────────────────────────

describe("changeResidentTicketPrioritySchema", () => {
  it("accepts all valid priorities", () => {
    for (const priority of RESIDENT_TICKET_PRIORITIES) {
      const result = changeResidentTicketPrioritySchema.safeParse({ priority });
      expect(result.success).toBe(true);
    }
  });

  it("rejects invalid priority", () => {
    const result = changeResidentTicketPrioritySchema.safeParse({
      priority: "CRITICAL",
    });
    expect(result.success).toBe(false);
  });
});

// ─── linkPetitionSchema ───────────────────────────────────────────

describe("linkPetitionSchema", () => {
  it("accepts valid UUID", () => {
    const result = linkPetitionSchema.safeParse({
      petitionId: "550e8400-e29b-41d4-a716-446655440000",
    });
    expect(result.success).toBe(true);
  });

  it("accepts null (unlink)", () => {
    const result = linkPetitionSchema.safeParse({ petitionId: null });
    expect(result.success).toBe(true);
  });

  it("rejects invalid UUID format", () => {
    const result = linkPetitionSchema.safeParse({ petitionId: "not-a-uuid" });
    expect(result.success).toBe(false);
  });

  it("rejects missing petitionId", () => {
    const result = linkPetitionSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});

// ─── validateAttachment ──────────────────────────────────────────

describe("validateAttachment", () => {
  it("accepts JPEG file under 5MB", () => {
    expect(validateAttachment({ type: "image/jpeg", size: 1024 * 1024 })).toEqual({ valid: true });
  });

  it("accepts PNG file", () => {
    expect(validateAttachment({ type: "image/png", size: 1024 })).toEqual({ valid: true });
  });

  it("accepts WebP file", () => {
    expect(validateAttachment({ type: "image/webp", size: 1024 })).toEqual({ valid: true });
  });

  it("accepts PDF file", () => {
    expect(validateAttachment({ type: "application/pdf", size: 2 * 1024 * 1024 })).toEqual({
      valid: true,
    });
  });

  it("accepts file at exactly 5MB", () => {
    expect(validateAttachment({ type: "image/jpeg", size: MAX_ATTACHMENT_SIZE_BYTES })).toEqual({
      valid: true,
    });
  });

  it("rejects file over 5MB", () => {
    const result = validateAttachment({
      type: "image/jpeg",
      size: MAX_ATTACHMENT_SIZE_BYTES + 1,
    });
    expect(result.valid).toBe(false);
    expect(result.error).toBe("File size exceeds 5MB limit.");
  });

  it("rejects disallowed MIME type", () => {
    const result = validateAttachment({
      type: "application/zip",
      size: 1024,
    });
    expect(result.valid).toBe(false);
    expect(result.error).toBe("Invalid file type. Allowed: JPG, PNG, WebP, PDF.");
  });

  it("rejects text/plain", () => {
    const result = validateAttachment({ type: "text/plain", size: 100 });
    expect(result.valid).toBe(false);
  });

  it("rejects empty string MIME type", () => {
    const result = validateAttachment({ type: "", size: 100 });
    expect(result.valid).toBe(false);
  });
});

// ─── isValidTransition ───────────────────────────────────────────

describe("isValidTransition", () => {
  it("OPEN → IN_PROGRESS is valid", () => {
    expect(isValidTransition("OPEN", "IN_PROGRESS")).toBe(true);
  });

  it("OPEN → CLOSED is valid", () => {
    expect(isValidTransition("OPEN", "CLOSED")).toBe(true);
  });

  it("OPEN → RESOLVED is invalid (must go through IN_PROGRESS)", () => {
    expect(isValidTransition("OPEN", "RESOLVED")).toBe(false);
  });

  it("IN_PROGRESS → AWAITING_RESIDENT is valid", () => {
    expect(isValidTransition("IN_PROGRESS", "AWAITING_RESIDENT")).toBe(true);
  });

  it("IN_PROGRESS → RESOLVED is valid", () => {
    expect(isValidTransition("IN_PROGRESS", "RESOLVED")).toBe(true);
  });

  it("IN_PROGRESS → CLOSED is valid", () => {
    expect(isValidTransition("IN_PROGRESS", "CLOSED")).toBe(true);
  });

  it("AWAITING_RESIDENT → AWAITING_ADMIN is valid", () => {
    expect(isValidTransition("AWAITING_RESIDENT", "AWAITING_ADMIN")).toBe(true);
  });

  it("AWAITING_RESIDENT → RESOLVED is valid", () => {
    expect(isValidTransition("AWAITING_RESIDENT", "RESOLVED")).toBe(true);
  });

  it("AWAITING_ADMIN → AWAITING_RESIDENT is valid", () => {
    expect(isValidTransition("AWAITING_ADMIN", "AWAITING_RESIDENT")).toBe(true);
  });

  it("AWAITING_ADMIN → IN_PROGRESS is valid", () => {
    expect(isValidTransition("AWAITING_ADMIN", "IN_PROGRESS")).toBe(true);
  });

  it("AWAITING_ADMIN → RESOLVED is valid", () => {
    expect(isValidTransition("AWAITING_ADMIN", "RESOLVED")).toBe(true);
  });

  it("RESOLVED → OPEN is valid (reopen)", () => {
    expect(isValidTransition("RESOLVED", "OPEN")).toBe(true);
  });

  it("RESOLVED → CLOSED is valid", () => {
    expect(isValidTransition("RESOLVED", "CLOSED")).toBe(true);
  });

  it("CLOSED → anything is invalid (terminal state)", () => {
    expect(isValidTransition("CLOSED", "OPEN")).toBe(false);
    expect(isValidTransition("CLOSED", "IN_PROGRESS")).toBe(false);
    expect(isValidTransition("CLOSED", "RESOLVED")).toBe(false);
  });

  it("unknown status returns false", () => {
    expect(isValidTransition("UNKNOWN", "OPEN")).toBe(false);
  });

  it("same status transition returns false (no self-transition)", () => {
    expect(isValidTransition("OPEN", "OPEN")).toBe(false);
  });
});

// ─── VALID_TRANSITIONS map ───────────────────────────────────────

describe("VALID_TRANSITIONS", () => {
  it("has entries for all non-terminal statuses", () => {
    expect(Object.keys(VALID_TRANSITIONS)).toEqual(
      expect.arrayContaining([
        "OPEN",
        "IN_PROGRESS",
        "AWAITING_RESIDENT",
        "AWAITING_ADMIN",
        "RESOLVED",
      ]),
    );
  });

  it("does not have entry for CLOSED (terminal state)", () => {
    expect(VALID_TRANSITIONS["CLOSED"]).toBeUndefined();
  });
});

// ─── Const Arrays and Label Maps ─────────────────────────────────

describe("const arrays", () => {
  it("RESIDENT_TICKET_TYPES has 10 entries", () => {
    expect(RESIDENT_TICKET_TYPES).toHaveLength(10);
  });

  it("RESIDENT_TICKET_PRIORITIES has 4 entries", () => {
    expect(RESIDENT_TICKET_PRIORITIES).toHaveLength(4);
  });

  it("RESIDENT_TICKET_STATUSES has 6 entries", () => {
    expect(RESIDENT_TICKET_STATUSES).toHaveLength(6);
  });
});

describe("label maps", () => {
  it("every type has a label", () => {
    for (const type of RESIDENT_TICKET_TYPES) {
      expect(RESIDENT_TICKET_TYPE_LABELS[type]).toBeDefined();
      expect(typeof RESIDENT_TICKET_TYPE_LABELS[type]).toBe("string");
    }
  });

  it("every priority has a label", () => {
    for (const priority of RESIDENT_TICKET_PRIORITIES) {
      expect(RESIDENT_TICKET_PRIORITY_LABELS[priority]).toBeDefined();
    }
  });

  it("every status has a label", () => {
    for (const status of RESIDENT_TICKET_STATUSES) {
      expect(RESIDENT_TICKET_STATUS_LABELS[status]).toBeDefined();
    }
  });
});

// ─── ALLOWED_ATTACHMENT_MIME_TYPES and MAX_ATTACHMENT_SIZE_BYTES ──

describe("attachment constants", () => {
  it("ALLOWED_ATTACHMENT_MIME_TYPES has 4 entries", () => {
    expect(ALLOWED_ATTACHMENT_MIME_TYPES).toHaveLength(4);
  });

  it("MAX_ATTACHMENT_SIZE_BYTES is 5MB", () => {
    expect(MAX_ATTACHMENT_SIZE_BYTES).toBe(5 * 1024 * 1024);
  });
});
