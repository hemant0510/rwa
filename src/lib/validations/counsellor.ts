import { z } from "zod";

// ─── Counsellor creation / update ─────────────────────────────────

export const createCounsellorSchema = z.object({
  name: z.string().min(2, "Name must be at least 2 characters").max(100),
  email: z.string().email("Invalid email").max(100),
  mobile: z
    .string()
    .regex(/^[0-9+\-\s]{7,15}$/, "Invalid mobile number")
    .max(15)
    .optional()
    .nullable(),
  nationalId: z.string().min(3).max(30).optional().nullable(),
  bio: z.string().max(5000).optional().nullable(),
  publicBlurb: z.string().max(500).optional().nullable(),
});

export type CreateCounsellorInput = z.infer<typeof createCounsellorSchema>;

export const updateCounsellorSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  mobile: z
    .string()
    .regex(/^[0-9+\-\s]{7,15}$/, "Invalid mobile number")
    .max(15)
    .optional()
    .nullable(),
  nationalId: z.string().min(3).max(30).optional().nullable(),
  bio: z.string().max(5000).optional().nullable(),
  publicBlurb: z.string().max(500).optional().nullable(),
  isActive: z.boolean().optional(),
});

export type UpdateCounsellorInput = z.infer<typeof updateCounsellorSchema>;

// ─── Self-profile update (counsellor-facing) ──────────────────────

export const updateCounsellorSelfSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  mobile: z
    .string()
    .regex(/^[0-9+\-\s]{7,15}$/, "Invalid mobile number")
    .max(15)
    .optional()
    .nullable(),
  bio: z.string().max(5000).optional().nullable(),
  publicBlurb: z.string().max(500).optional().nullable(),
  photoUrl: z.string().url().max(500).optional().nullable(),
});

export type UpdateCounsellorSelfInput = z.infer<typeof updateCounsellorSelfSchema>;

// ─── Assignment ───────────────────────────────────────────────────

export const assignSocietiesSchema = z.object({
  societyIds: z
    .array(z.string().uuid("Invalid society ID"))
    .min(1, "At least one society required")
    .max(1000, "Cannot assign more than 1000 societies in one request"),
  notes: z.string().max(500).optional().nullable(),
});

export type AssignSocietiesInput = z.infer<typeof assignSocietiesSchema>;

export const transferPortfolioSchema = z.object({
  targetCounsellorId: z.string().uuid("Invalid counsellor ID"),
  societyIds: z.array(z.string().uuid("Invalid society ID")).optional(),
});

export type TransferPortfolioInput = z.infer<typeof transferPortfolioSchema>;
