import { describe, it, expect } from "vitest";

import {
  updateEscalationThresholdSchema,
  escalateTicketSchema,
  withdrawEscalationSchema,
  createCounsellorMessageSchema,
  resolveEscalationSchema,
  deferEscalationSchema,
  isValidEscalationTransition,
  VALID_ESCALATION_TRANSITIONS,
  ESCALATION_SOURCES,
  ESCALATION_STATUSES,
  COUNSELLOR_MESSAGE_KINDS,
  MIN_ESCALATION_THRESHOLD,
  MAX_ESCALATION_THRESHOLD,
} from "@/lib/validations/escalation";

// ─── Const arrays ─────────────────────────────────────────────────

describe("const arrays", () => {
  it("ESCALATION_SOURCES contains all 4 sources", () => {
    expect(ESCALATION_SOURCES).toHaveLength(4);
    expect(ESCALATION_SOURCES).toContain("ADMIN_ASSIGN");
  });

  it("ESCALATION_STATUSES contains all 6 statuses", () => {
    expect(ESCALATION_STATUSES).toHaveLength(6);
  });

  it("COUNSELLOR_MESSAGE_KINDS contains both kinds", () => {
    expect(COUNSELLOR_MESSAGE_KINDS).toEqual(["ADVISORY_TO_ADMIN", "PRIVATE_NOTE"]);
  });

  it("MIN and MAX thresholds bracket default 10", () => {
    expect(MIN_ESCALATION_THRESHOLD).toBeLessThanOrEqual(10);
    expect(MAX_ESCALATION_THRESHOLD).toBeGreaterThanOrEqual(10);
  });
});

// ─── updateEscalationThresholdSchema ──────────────────────────────

describe("updateEscalationThresholdSchema", () => {
  it("accepts value at min", () => {
    expect(
      updateEscalationThresholdSchema.safeParse({ threshold: MIN_ESCALATION_THRESHOLD }).success,
    ).toBe(true);
  });

  it("accepts value at max", () => {
    expect(
      updateEscalationThresholdSchema.safeParse({ threshold: MAX_ESCALATION_THRESHOLD }).success,
    ).toBe(true);
  });

  it("rejects below min", () => {
    expect(
      updateEscalationThresholdSchema.safeParse({ threshold: MIN_ESCALATION_THRESHOLD - 1 })
        .success,
    ).toBe(false);
  });

  it("rejects above max", () => {
    expect(
      updateEscalationThresholdSchema.safeParse({ threshold: MAX_ESCALATION_THRESHOLD + 1 })
        .success,
    ).toBe(false);
  });

  it("rejects non-integer", () => {
    expect(updateEscalationThresholdSchema.safeParse({ threshold: 10.5 }).success).toBe(false);
  });
});

// ─── escalateTicketSchema ─────────────────────────────────────────

describe("escalateTicketSchema", () => {
  it("accepts valid reason", () => {
    expect(escalateTicketSchema.safeParse({ reason: "Residents deadlocked" }).success).toBe(true);
  });

  it("rejects reason shorter than 10 chars", () => {
    expect(escalateTicketSchema.safeParse({ reason: "short" }).success).toBe(false);
  });

  it("rejects reason longer than 2000 chars", () => {
    expect(escalateTicketSchema.safeParse({ reason: "x".repeat(2001) }).success).toBe(false);
  });
});

// ─── withdrawEscalationSchema ─────────────────────────────────────

describe("withdrawEscalationSchema", () => {
  it("accepts valid reason", () => {
    expect(withdrawEscalationSchema.safeParse({ reason: "Resolved internally" }).success).toBe(
      true,
    );
  });

  it("accepts no reason", () => {
    expect(withdrawEscalationSchema.safeParse({}).success).toBe(true);
  });

  it("accepts null reason", () => {
    expect(withdrawEscalationSchema.safeParse({ reason: null }).success).toBe(true);
  });

  it("rejects reason longer than 2000 chars", () => {
    expect(withdrawEscalationSchema.safeParse({ reason: "x".repeat(2001) }).success).toBe(false);
  });
});

// ─── createCounsellorMessageSchema ────────────────────────────────

describe("createCounsellorMessageSchema", () => {
  it("accepts ADVISORY_TO_ADMIN", () => {
    expect(
      createCounsellorMessageSchema.safeParse({
        content: "Advisory note",
        kind: "ADVISORY_TO_ADMIN",
      }).success,
    ).toBe(true);
  });

  it("accepts PRIVATE_NOTE", () => {
    expect(
      createCounsellorMessageSchema.safeParse({ content: "Private note", kind: "PRIVATE_NOTE" })
        .success,
    ).toBe(true);
  });

  it("rejects invalid kind", () => {
    expect(
      createCounsellorMessageSchema.safeParse({ content: "Test", kind: "INVALID" }).success,
    ).toBe(false);
  });

  it("rejects empty content", () => {
    expect(
      createCounsellorMessageSchema.safeParse({ content: "", kind: "ADVISORY_TO_ADMIN" }).success,
    ).toBe(false);
  });

  it("rejects content longer than 5000 chars", () => {
    expect(
      createCounsellorMessageSchema.safeParse({
        content: "x".repeat(5001),
        kind: "ADVISORY_TO_ADMIN",
      }).success,
    ).toBe(false);
  });
});

// ─── resolve / defer schemas ──────────────────────────────────────

describe("resolveEscalationSchema", () => {
  it("accepts valid summary", () => {
    expect(
      resolveEscalationSchema.safeParse({ summary: "Advisory delivered to admin" }).success,
    ).toBe(true);
  });

  it("rejects summary shorter than 10 chars", () => {
    expect(resolveEscalationSchema.safeParse({ summary: "short" }).success).toBe(false);
  });

  it("rejects summary longer than 5000 chars", () => {
    expect(resolveEscalationSchema.safeParse({ summary: "x".repeat(5001) }).success).toBe(false);
  });
});

describe("deferEscalationSchema", () => {
  it("accepts valid reason", () => {
    expect(deferEscalationSchema.safeParse({ reason: "Out of scope for counsellor" }).success).toBe(
      true,
    );
  });

  it("rejects reason shorter than 10 chars", () => {
    expect(deferEscalationSchema.safeParse({ reason: "short" }).success).toBe(false);
  });
});

// ─── isValidEscalationTransition ──────────────────────────────────

describe("isValidEscalationTransition", () => {
  it("allows PENDING → ACKNOWLEDGED", () => {
    expect(isValidEscalationTransition("PENDING", "ACKNOWLEDGED")).toBe(true);
  });

  it("allows PENDING → WITHDRAWN", () => {
    expect(isValidEscalationTransition("PENDING", "WITHDRAWN")).toBe(true);
  });

  it("blocks PENDING → RESOLVED_BY_COUNSELLOR", () => {
    expect(isValidEscalationTransition("PENDING", "RESOLVED_BY_COUNSELLOR")).toBe(false);
  });

  it("allows ACKNOWLEDGED → REVIEWING", () => {
    expect(isValidEscalationTransition("ACKNOWLEDGED", "REVIEWING")).toBe(true);
  });

  it("allows REVIEWING → RESOLVED_BY_COUNSELLOR", () => {
    expect(isValidEscalationTransition("REVIEWING", "RESOLVED_BY_COUNSELLOR")).toBe(true);
  });

  it("blocks anything from RESOLVED_BY_COUNSELLOR (terminal)", () => {
    expect(isValidEscalationTransition("RESOLVED_BY_COUNSELLOR", "REVIEWING")).toBe(false);
  });

  it("allows DEFERRED_TO_ADMIN → REVIEWING", () => {
    expect(isValidEscalationTransition("DEFERRED_TO_ADMIN", "REVIEWING")).toBe(true);
  });

  it("blocks anything from WITHDRAWN (terminal)", () => {
    expect(isValidEscalationTransition("WITHDRAWN", "REVIEWING")).toBe(false);
  });

  it("returns false for unknown state", () => {
    expect(isValidEscalationTransition("NOT_A_STATUS", "ACKNOWLEDGED")).toBe(false);
  });

  it("VALID_ESCALATION_TRANSITIONS exposes a terminal state with empty array", () => {
    expect(VALID_ESCALATION_TRANSITIONS.RESOLVED_BY_COUNSELLOR).toEqual([]);
    expect(VALID_ESCALATION_TRANSITIONS.WITHDRAWN).toEqual([]);
  });
});
