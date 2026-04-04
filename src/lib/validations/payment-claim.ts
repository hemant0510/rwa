import { z } from "zod";

const today = () => new Date().toISOString().split("T")[0];

export const paymentClaimSchema = z.object({
  membershipFeeId: z.string().uuid(),
  claimedAmount: z.number().positive().max(999999),
  utrNumber: z
    .string()
    .min(10, "UTR must be at least 10 characters")
    .max(50, "UTR too long")
    .regex(/^[A-Z0-9]+$/i, "UTR must contain only letters and numbers"),
  paymentDate: z
    .string()
    .date()
    .refine((d) => d <= today(), "Payment date cannot be in the future"),
  screenshotUrl: z.string().url().optional(),
});

export const rejectClaimSchema = z.object({
  rejectionReason: z.string().min(10, "Reason must be at least 10 characters").max(500),
});

// Body is optional for verify (adminNotes is internal-only); schema exists for extensibility
export const verifyClaimSchema = z.object({
  adminNotes: z.string().max(1000).optional(),
});

export const subscriptionClaimSchema = z
  .object({
    amount: z.number().positive(),
    utrNumber: z
      .string()
      .min(10)
      .max(50)
      .regex(/^[A-Z0-9]+$/i),
    paymentDate: z
      .string()
      .date()
      .refine((d) => d <= today(), "Date cannot be in the future"),
    screenshotUrl: z.string().url().optional(),
    // Required — SA needs these to extend the subscription period on verify
    periodStart: z.string().date(),
    periodEnd: z.string().date(),
  })
  .refine((data) => data.periodEnd > data.periodStart, {
    message: "Period end must be after period start",
    path: ["periodEnd"],
  });
