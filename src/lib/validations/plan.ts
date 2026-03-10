import { z } from "zod";

export const planFeaturesSchema = z.object({
  resident_management: z.boolean(),
  fee_collection: z.boolean(),
  expense_tracking: z.boolean(),
  basic_reports: z.boolean(),
  advanced_reports: z.boolean(),
  whatsapp: z.boolean(),
  elections: z.boolean(),
  ai_insights: z.boolean(),
  api_access: z.boolean(),
  multi_admin: z.boolean(),
});

export const billingOptionSchema = z.object({
  billingCycle: z.enum(["MONTHLY", "ANNUAL", "TWO_YEAR", "THREE_YEAR"]),
  price: z.number().positive(),
  isActive: z.boolean().optional().default(true),
});

export const createPlanSchema = z.object({
  name: z.string().min(2).max(100),
  slug: z
    .string()
    .min(2)
    .max(50)
    .regex(/^[a-z0-9-]+$/, "Slug must be lowercase letters, numbers, and hyphens only"),
  description: z.string().max(500).optional(),
  planType: z.enum(["FLAT_FEE", "PER_UNIT"]),
  residentLimit: z.number().int().positive().nullable().optional(),
  pricePerUnit: z.number().positive().nullable().optional(),
  featuresJson: planFeaturesSchema,
  isPublic: z.boolean().optional().default(true),
  displayOrder: z.number().int().optional().default(0),
  badgeText: z.string().max(50).nullable().optional(),
  trialAccessLevel: z.boolean().optional().default(false),
  billingOptions: z.array(billingOptionSchema).min(1, "At least one billing option required"),
});

export const updatePlanSchema = createPlanSchema
  .omit({ slug: true, billingOptions: true })
  .partial();

export const createBillingOptionSchema = billingOptionSchema;

export const updateBillingOptionSchema = z.object({
  price: z.number().positive(),
  isActive: z.boolean().optional(),
});

export const reorderPlansSchema = z.object({
  order: z.array(
    z.object({
      id: z.string().uuid(),
      displayOrder: z.number().int(),
    }),
  ),
});

export type CreatePlanInput = z.infer<typeof createPlanSchema>;
export type UpdatePlanInput = z.infer<typeof updatePlanSchema>;
export type PlanFeatures = z.infer<typeof planFeaturesSchema>;
