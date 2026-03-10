import { z } from "zod";

export const createDiscountSchema = z
  .object({
    name: z.string().min(2).max(150),
    description: z.string().max(500).optional(),
    discountType: z.enum(["PERCENTAGE", "FLAT_AMOUNT"]),
    discountValue: z.number().positive(),
    appliesToAll: z.boolean().default(false),
    applicablePlanIds: z.array(z.string().uuid()).default([]),
    triggerType: z.enum(["COUPON_CODE", "AUTO_TIME_LIMITED", "PLAN_SPECIFIC", "MANUAL_OVERRIDE"]),
    couponCode: z.string().min(3).max(30).optional().nullable(),
    startsAt: z.string().datetime().optional().nullable(),
    endsAt: z.string().datetime().optional().nullable(),
    maxUsageCount: z.number().int().positive().optional().nullable(),
    allowedCycles: z.array(z.enum(["MONTHLY", "ANNUAL", "TWO_YEAR", "THREE_YEAR"])).default([]),
  })
  .superRefine((data, ctx) => {
    if (data.triggerType === "COUPON_CODE" && !data.couponCode) {
      ctx.addIssue({
        code: "custom",
        path: ["couponCode"],
        message: "Coupon code is required for COUPON_CODE trigger type",
      });
    }
    if (data.discountType === "PERCENTAGE" && data.discountValue > 100) {
      ctx.addIssue({
        code: "custom",
        path: ["discountValue"],
        message: "Percentage discount cannot exceed 100",
      });
    }
    if (!data.appliesToAll && data.applicablePlanIds.length === 0) {
      ctx.addIssue({
        code: "custom",
        path: ["applicablePlanIds"],
        message: 'Select specific plans or enable "Applies to all plans"',
      });
    }
  });

export const updateDiscountSchema = z.object({
  name: z.string().min(2).max(150).optional(),
  description: z.string().max(500).optional(),
  discountType: z.enum(["PERCENTAGE", "FLAT_AMOUNT"]).optional(),
  discountValue: z.number().positive().optional(),
  appliesToAll: z.boolean().optional(),
  applicablePlanIds: z.array(z.string().uuid()).optional(),
  triggerType: z
    .enum(["COUPON_CODE", "AUTO_TIME_LIMITED", "PLAN_SPECIFIC", "MANUAL_OVERRIDE"])
    .optional(),
  couponCode: z.string().min(3).max(30).optional().nullable(),
  startsAt: z.string().datetime().optional().nullable(),
  endsAt: z.string().datetime().optional().nullable(),
  maxUsageCount: z.number().int().positive().optional().nullable(),
  allowedCycles: z.array(z.enum(["MONTHLY", "ANNUAL", "TWO_YEAR", "THREE_YEAR"])).optional(),
});

export const validateCouponSchema = z.object({
  couponCode: z.string().min(1),
  planId: z.string().uuid(),
  billingCycle: z.enum(["MONTHLY", "ANNUAL", "TWO_YEAR", "THREE_YEAR"]),
});

export type CreateDiscountInput = z.infer<typeof createDiscountSchema>;
export type UpdateDiscountInput = z.infer<typeof updateDiscountSchema>;
