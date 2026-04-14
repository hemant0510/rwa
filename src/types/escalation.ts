import type { EscalationSource, EscalationStatus, CounsellorMessageKind } from "@prisma/client";

// ─── Enum Re-exports ──────────────────────────────────────────────

export type { EscalationSource, EscalationStatus, CounsellorMessageKind };

// ─── Escalation Records ───────────────────────────────────────────

export interface EscalationListItem {
  id: string;
  ticketId: string;
  counsellorId: string;
  source: EscalationSource;
  status: EscalationStatus;
  reason: string | null;
  createdById: string | null;
  acknowledgedAt: string | null;
  resolvedAt: string | null;
  slaDeadline: string | null;
  createdAt: string;
  updatedAt: string;
  ticket: {
    id: string;
    ticketNumber: number;
    subject: string;
    societyId: string;
    society: { name: string };
  };
}

export interface EscalationDetail extends EscalationListItem {
  withdrawnAt: string | null;
  withdrawnReason: string | null;
  voteCount: number;
}

// ─── Vote ─────────────────────────────────────────────────────────

export interface EscalationVoteStatus {
  ticketId: string;
  threshold: number;
  voteCount: number;
  hasVoted: boolean;
  escalationCreated: boolean;
}

// ─── Label Maps ───────────────────────────────────────────────────

export const ESCALATION_SOURCE_LABELS: Record<EscalationSource, string> = {
  ADMIN_ASSIGN: "Admin escalated",
  ADMIN_NOTIFY: "Admin notified",
  RESIDENT_VOTE: "Resident vote",
  SUPER_ADMIN_FORCE: "Super Admin",
};

export const ESCALATION_STATUS_LABELS: Record<EscalationStatus, string> = {
  PENDING: "Pending",
  ACKNOWLEDGED: "Acknowledged",
  REVIEWING: "Reviewing",
  RESOLVED_BY_COUNSELLOR: "Resolved",
  DEFERRED_TO_ADMIN: "Deferred to Admin",
  WITHDRAWN: "Withdrawn",
};

export const COUNSELLOR_MESSAGE_KIND_LABELS: Record<CounsellorMessageKind, string> = {
  ADVISORY_TO_ADMIN: "Advisory",
  PRIVATE_NOTE: "Private note",
};
