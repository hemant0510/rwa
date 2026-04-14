import { z } from "zod";

// ─── Const Arrays ─────────────────────────────────────────────────

export const ESCALATION_SOURCES = [
  "ADMIN_ASSIGN",
  "ADMIN_NOTIFY",
  "RESIDENT_VOTE",
  "SUPER_ADMIN_FORCE",
] as const;

export const ESCALATION_STATUSES = [
  "PENDING",
  "ACKNOWLEDGED",
  "REVIEWING",
  "RESOLVED_BY_COUNSELLOR",
  "DEFERRED_TO_ADMIN",
  "WITHDRAWN",
] as const;

export const COUNSELLOR_MESSAGE_KINDS = ["ADVISORY_TO_ADMIN", "PRIVATE_NOTE"] as const;

// ─── Society escalation settings ──────────────────────────────────

export const MIN_ESCALATION_THRESHOLD = 5;
export const MAX_ESCALATION_THRESHOLD = 50;

export const updateEscalationThresholdSchema = z.object({
  threshold: z
    .number()
    .int("Threshold must be a whole number")
    .min(MIN_ESCALATION_THRESHOLD, `Minimum threshold is ${MIN_ESCALATION_THRESHOLD}`)
    .max(MAX_ESCALATION_THRESHOLD, `Maximum threshold is ${MAX_ESCALATION_THRESHOLD}`),
});

export type UpdateEscalationThresholdInput = z.infer<typeof updateEscalationThresholdSchema>;

// ─── Escalate (admin-initiated) ───────────────────────────────────

export const escalateTicketSchema = z.object({
  reason: z.string().min(10, "Reason must be at least 10 characters").max(2000),
});

export type EscalateTicketInput = z.infer<typeof escalateTicketSchema>;

// ─── Withdraw escalation ──────────────────────────────────────────

export const withdrawEscalationSchema = z.object({
  reason: z.string().max(2000).optional().nullable(),
});

export type WithdrawEscalationInput = z.infer<typeof withdrawEscalationSchema>;

// ─── Counsellor message ───────────────────────────────────────────

export const createCounsellorMessageSchema = z.object({
  content: z.string().min(1, "Message cannot be empty").max(5000),
  kind: z.enum(COUNSELLOR_MESSAGE_KINDS),
});

export type CreateCounsellorMessageInput = z.infer<typeof createCounsellorMessageSchema>;

// ─── Escalation lifecycle actions (counsellor-side) ───────────────

export const resolveEscalationSchema = z.object({
  summary: z.string().min(10, "Summary must be at least 10 characters").max(5000),
});

export type ResolveEscalationInput = z.infer<typeof resolveEscalationSchema>;

export const deferEscalationSchema = z.object({
  reason: z.string().min(10, "Reason must be at least 10 characters").max(2000),
});

export type DeferEscalationInput = z.infer<typeof deferEscalationSchema>;

// ─── Escalation status transitions ────────────────────────────────

export const VALID_ESCALATION_TRANSITIONS: Record<string, string[]> = {
  PENDING: ["ACKNOWLEDGED", "WITHDRAWN"],
  ACKNOWLEDGED: ["REVIEWING", "RESOLVED_BY_COUNSELLOR", "DEFERRED_TO_ADMIN", "WITHDRAWN"],
  REVIEWING: ["RESOLVED_BY_COUNSELLOR", "DEFERRED_TO_ADMIN", "WITHDRAWN"],
  RESOLVED_BY_COUNSELLOR: [],
  DEFERRED_TO_ADMIN: ["REVIEWING"],
  WITHDRAWN: [],
};

export function isValidEscalationTransition(from: string, to: string): boolean {
  return VALID_ESCALATION_TRANSITIONS[from]?.includes(to) ?? false;
}
