import { z } from "zod";

// ─── Const Arrays ─────────────────────────────────────────────────

export const RESIDENT_TICKET_TYPES = [
  "MAINTENANCE_ISSUE",
  "SECURITY_CONCERN",
  "NOISE_COMPLAINT",
  "PARKING_ISSUE",
  "CLEANLINESS",
  "BILLING_QUERY",
  "AMENITY_REQUEST",
  "NEIGHBOR_DISPUTE",
  "SUGGESTION",
  "OTHER",
] as const;

export const RESIDENT_TICKET_PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"] as const;

export const RESIDENT_TICKET_STATUSES = [
  "OPEN",
  "IN_PROGRESS",
  "AWAITING_RESIDENT",
  "AWAITING_ADMIN",
  "RESOLVED",
  "CLOSED",
] as const;

// ─── Label Maps ───────────────────────────────────────────────────

export const RESIDENT_TICKET_TYPE_LABELS: Record<(typeof RESIDENT_TICKET_TYPES)[number], string> = {
  MAINTENANCE_ISSUE: "Maintenance",
  SECURITY_CONCERN: "Security",
  NOISE_COMPLAINT: "Noise",
  PARKING_ISSUE: "Parking",
  CLEANLINESS: "Cleanliness",
  BILLING_QUERY: "Billing",
  AMENITY_REQUEST: "Amenity",
  NEIGHBOR_DISPUTE: "Neighbor Dispute",
  SUGGESTION: "Suggestion",
  OTHER: "Other",
};

export const RESIDENT_TICKET_PRIORITY_LABELS: Record<
  (typeof RESIDENT_TICKET_PRIORITIES)[number],
  string
> = {
  LOW: "Low",
  MEDIUM: "Medium",
  HIGH: "High",
  URGENT: "Urgent",
};

export const RESIDENT_TICKET_STATUS_LABELS: Record<
  (typeof RESIDENT_TICKET_STATUSES)[number],
  string
> = {
  OPEN: "Open",
  IN_PROGRESS: "In Progress",
  AWAITING_RESIDENT: "Awaiting Resident",
  AWAITING_ADMIN: "Awaiting Admin",
  RESOLVED: "Resolved",
  CLOSED: "Closed",
};

// ─── Zod Schemas ──────────────────────────────────────────────────

export const createResidentTicketSchema = z.object({
  type: z.enum(RESIDENT_TICKET_TYPES),
  subject: z.string().min(5, "Subject must be at least 5 characters").max(200),
  description: z.string().min(20, "Description must be at least 20 characters").max(5000),
  priority: z.enum(RESIDENT_TICKET_PRIORITIES).optional().default("MEDIUM"),
});

export type CreateResidentTicketInput = z.infer<typeof createResidentTicketSchema>;

export const createResidentTicketMessageSchema = z.object({
  content: z.string().min(1, "Message cannot be empty").max(5000),
  isInternal: z.boolean().default(false),
});

export type CreateResidentTicketMessageInput = z.infer<typeof createResidentTicketMessageSchema>;

export const changeResidentTicketStatusSchema = z.object({
  status: z.enum(RESIDENT_TICKET_STATUSES),
  reason: z.string().max(1000).optional(),
});

export type ChangeResidentTicketStatusInput = z.infer<typeof changeResidentTicketStatusSchema>;

export const changeResidentTicketPrioritySchema = z.object({
  priority: z.enum(RESIDENT_TICKET_PRIORITIES),
});

export type ChangeResidentTicketPriorityInput = z.infer<typeof changeResidentTicketPrioritySchema>;

export const linkPetitionSchema = z.object({
  petitionId: z.string().uuid().nullable(),
});

export type LinkPetitionInput = z.infer<typeof linkPetitionSchema>;

export const assignTicketSchema = z.object({
  userId: z.string().uuid("Invalid user ID"),
});

export type AssignTicketInput = z.infer<typeof assignTicketSchema>;

export const ALLOWED_ATTACHMENT_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
] as const;

export const MAX_ATTACHMENT_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

export function validateAttachment(file: { type: string; size: number }): {
  valid: boolean;
  error?: string;
} {
  if (
    !ALLOWED_ATTACHMENT_MIME_TYPES.includes(
      file.type as (typeof ALLOWED_ATTACHMENT_MIME_TYPES)[number],
    )
  ) {
    return {
      valid: false,
      error: "Invalid file type. Allowed: JPG, PNG, WebP, PDF.",
    };
  }
  if (file.size > MAX_ATTACHMENT_SIZE_BYTES) {
    return { valid: false, error: "File size exceeds 5MB limit." };
  }
  return { valid: true };
}

// ─── Status Transitions ───────────────────────────────────────────

export const VALID_TRANSITIONS: Record<string, string[]> = {
  OPEN: ["IN_PROGRESS", "CLOSED"],
  IN_PROGRESS: ["AWAITING_RESIDENT", "RESOLVED", "CLOSED"],
  AWAITING_RESIDENT: ["AWAITING_ADMIN", "RESOLVED", "CLOSED"],
  AWAITING_ADMIN: ["AWAITING_RESIDENT", "IN_PROGRESS", "RESOLVED", "CLOSED"],
  RESOLVED: ["OPEN", "CLOSED"],
};

export function isValidTransition(from: string, to: string): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}
