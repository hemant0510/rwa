import { z } from "zod";

export const SERVICE_REQUEST_TYPES = [
  "BUG_REPORT",
  "FEATURE_REQUEST",
  "BILLING_INQUIRY",
  "TECHNICAL_SUPPORT",
  "ACCOUNT_ISSUE",
  "DATA_REQUEST",
  "COMPLIANCE",
  "OTHER",
] as const;

export const SERVICE_REQUEST_PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"] as const;

export const SERVICE_REQUEST_STATUSES = [
  "OPEN",
  "IN_PROGRESS",
  "AWAITING_ADMIN",
  "AWAITING_SA",
  "RESOLVED",
  "CLOSED",
] as const;

export const createRequestSchema = z.object({
  type: z.enum(SERVICE_REQUEST_TYPES),
  priority: z.enum(SERVICE_REQUEST_PRIORITIES).default("MEDIUM"),
  subject: z.string().min(5, "Subject must be at least 5 characters").max(200),
  description: z.string().min(20, "Description must be at least 20 characters").max(5000),
});

export type CreateRequestInput = z.infer<typeof createRequestSchema>;

export const createMessageSchema = z.object({
  content: z.string().min(1, "Message cannot be empty").max(5000),
  isInternal: z.boolean().default(false),
});

export type CreateMessageInput = z.infer<typeof createMessageSchema>;

export const changeStatusSchema = z.object({
  status: z.enum(SERVICE_REQUEST_STATUSES),
  reason: z.string().max(1000).optional(),
});

export type ChangeStatusInput = z.infer<typeof changeStatusSchema>;

// Valid status transitions
const VALID_TRANSITIONS: Record<string, string[]> = {
  OPEN: ["IN_PROGRESS", "CLOSED"],
  IN_PROGRESS: ["AWAITING_ADMIN", "RESOLVED", "CLOSED"],
  AWAITING_ADMIN: ["AWAITING_SA", "RESOLVED", "CLOSED"],
  AWAITING_SA: ["AWAITING_ADMIN", "IN_PROGRESS", "RESOLVED", "CLOSED"],
  RESOLVED: ["OPEN", "CLOSED"],
};

export function isValidTransition(from: string, to: string): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false;
}
