import type {
  ResidentTicketType,
  ResidentTicketPriority,
  ResidentTicketStatus,
} from "@prisma/client";

// ─── Ticket List Item ─────────────────────────────────────────────

export interface ResidentTicketListItem {
  id: string;
  ticketNumber: number;
  type: ResidentTicketType;
  priority: ResidentTicketPriority;
  status: ResidentTicketStatus;
  subject: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  createdByUser: { name: string };
  _count: { messages: number; attachments: number };
}

// ─── Assignee ─────────────────────────────────────────────────────

export interface AssigneeItem {
  id: string;
  userId: string;
  assignedAt: string;
  assignee: {
    id: string;
    name: string;
    governingBodyMembership: { designation: { name: string } } | null;
  };
}

// ─── Ticket Detail ────────────────────────────────────────────────

export interface ResidentTicketDetail {
  id: string;
  ticketNumber: number;
  societyId: string;
  type: ResidentTicketType;
  priority: ResidentTicketPriority;
  status: ResidentTicketStatus;
  subject: string;
  description: string;
  createdBy: string;
  petitionId: string | null;
  resolvedAt: string | null;
  closedAt: string | null;
  closedReason: string | null;
  createdAt: string;
  updatedAt: string;
  createdByUser: { name: string };
  petition: {
    id: string;
    title: string;
    type: string;
    status: string;
  } | null;
  messages: ResidentTicketMessageItem[];
  assignees: AssigneeItem[];
  escalations?: EscalationItem[];
}

// ─── Escalation ───────────────────────────────────────────────────

export type EscalationSource =
  | "ADMIN_ASSIGN"
  | "ADMIN_NOTIFY"
  | "RESIDENT_VOTE"
  | "SUPER_ADMIN_FORCE";

export interface EscalationItem {
  id: string;
  source: EscalationSource;
  status: string;
  createdAt: string;
}

// ─── Ticket Message ───────────────────────────────────────────────

export interface ResidentTicketMessageItem {
  id: string;
  ticketId: string;
  authorId: string;
  authorRole: string;
  content: string;
  isInternal: boolean;
  createdAt: string;
  attachments: AttachmentItem[];
  author: { name: string };
}

// ─── Attachment ───────────────────────────────────────────────────

export interface AttachmentItem {
  id: string;
  ticketId: string;
  messageId: string | null;
  fileName: string;
  mimeType: string;
  fileSize: number;
  signedUrl: string;
  uploadedBy: string;
  createdAt: string;
}

// ─── Admin Stats ──────────────────────────────────────────────────

export interface ResidentTicketStats {
  open: number;
  inProgress: number;
  awaitingAdmin: number;
  resolved7d: number;
  avgResolutionHours: number | null;
}

// ─── Paginated Response ───────────────────────────────────────────

export interface PaginatedResidentTickets {
  tickets: ResidentTicketListItem[];
  total: number;
  page: number;
  pageSize: number;
}
