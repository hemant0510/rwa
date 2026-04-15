import { describe, it, expect } from "vitest";

import { COUNSELLOR_SLA_HOURS, computeSlaDeadline, describeSla } from "@/lib/counsellor/sla";

describe("counsellor/sla", () => {
  describe("COUNSELLOR_SLA_HOURS", () => {
    it("is 72 hours", () => {
      expect(COUNSELLOR_SLA_HOURS).toBe(72);
    });
  });

  describe("computeSlaDeadline", () => {
    it("returns a date 72 hours after createdAt", () => {
      const createdAt = new Date("2026-01-01T00:00:00.000Z");
      const deadline = computeSlaDeadline(createdAt);
      expect(deadline.toISOString()).toBe("2026-01-04T00:00:00.000Z");
    });

    it("returns a new Date (does not mutate input)", () => {
      const createdAt = new Date("2026-01-01T00:00:00.000Z");
      const deadline = computeSlaDeadline(createdAt);
      expect(deadline).not.toBe(createdAt);
      expect(createdAt.toISOString()).toBe("2026-01-01T00:00:00.000Z");
    });
  });

  describe("describeSla", () => {
    it("returns null fields when deadline is null", () => {
      const result = describeSla(null);
      expect(result).toEqual({
        deadline: null,
        hoursRemaining: null,
        isBreached: false,
      });
    });

    it("reports hours remaining when not breached", () => {
      const now = new Date("2026-01-01T00:00:00.000Z");
      const deadline = new Date("2026-01-01T24:00:00.000Z"); // +24h
      const result = describeSla(deadline, now);
      expect(result.deadline).toEqual(deadline);
      expect(result.hoursRemaining).toBe(24);
      expect(result.isBreached).toBe(false);
    });

    it("reports negative hours and isBreached=true when past deadline", () => {
      const now = new Date("2026-01-02T00:00:00.000Z");
      const deadline = new Date("2026-01-01T00:00:00.000Z"); // 24h ago
      const result = describeSla(deadline, now);
      expect(result.hoursRemaining).toBe(-24);
      expect(result.isBreached).toBe(true);
    });

    it("uses current time when now arg is omitted", () => {
      const deadline = new Date(Date.now() + 60 * 60 * 1000); // +1h
      const result = describeSla(deadline);
      expect(result.isBreached).toBe(false);
      expect(result.hoursRemaining).toBeGreaterThanOrEqual(0);
      expect(result.hoursRemaining).toBeLessThanOrEqual(1);
    });
  });
});
