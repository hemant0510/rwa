import { z } from "zod";

export const SuspendSocietySchema = z.object({
  reason: z.string().min(10, "Reason must be at least 10 characters").max(500),
  gracePeriodDays: z.number().int().min(0).max(30).default(7),
  notifyAdmin: z.boolean().default(true),
});

export const ReactivateSocietySchema = z.object({
  note: z.string().max(500).optional(),
  notifyAdmin: z.boolean().default(true),
});

export const OffboardSocietySchema = z.object({
  reason: z.string().min(10, "Reason must be at least 10 characters").max(500),
  confirmationCode: z.string().min(1, "Confirmation code is required"),
});

export type SuspendSocietyInput = z.infer<typeof SuspendSocietySchema>;
export type ReactivateSocietyInput = z.infer<typeof ReactivateSocietySchema>;
export type OffboardSocietyInput = z.infer<typeof OffboardSocietySchema>;
