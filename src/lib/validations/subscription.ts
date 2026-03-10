import { z } from "zod";

export const assignPlanSchema = z.object({
  planId: z.string().uuid(),
  billingOptionId: z.string().uuid(),
  discountId: z.string().uuid().optional().nullable(),
  notes: z.string().max(500).optional(),
});

export const switchPlanSchema = z.object({
  planId: z.string().uuid(),
  billingOptionId: z.string().uuid(),
  notes: z.string().max(500).optional(),
});

export const applyDiscountSchema = z.object({
  discountId: z.string().uuid().optional().nullable(),
  customDiscountPct: z.number().min(0).max(100).optional().nullable(),
  notes: z.string().max(500).optional(),
});

export type AssignPlanInput = z.infer<typeof assignPlanSchema>;
export type SwitchPlanInput = z.infer<typeof switchPlanSchema>;
export type ApplyDiscountInput = z.infer<typeof applyDiscountSchema>;
