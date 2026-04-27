import { z } from "zod";

export const leadSchema = z.object({
  name: z.string().trim().min(2, "Name is required").max(120),
  email: z.string().trim().email("Valid email required").max(120),
  phone: z
    .string()
    .trim()
    .min(1, "Phone is required")
    .regex(/^[+0-9 ()-]{6,20}$/, "Valid phone required"),
  societyName: z.string().trim().max(200).optional().or(z.literal("")),
  unitCount: z
    .string()
    .trim()
    .regex(/^[0-9]{0,5}$/, "Numbers only")
    .optional()
    .or(z.literal("")),
  message: z.string().trim().max(2000).optional().or(z.literal("")),
  // Honeypot — if this is filled, the submitter is a bot.
  honeypot: z.string().max(0).optional(),
});

export type LeadInput = z.infer<typeof leadSchema>;
