import { z } from "zod";

const EVENT_CATEGORY_ENUM = [
  "FESTIVAL",
  "SPORTS",
  "WORKSHOP",
  "CULTURAL",
  "MEETING",
  "OTHER",
] as const;

const FEE_MODEL_ENUM = ["FREE", "FIXED", "FLEXIBLE", "CONTRIBUTION"] as const;

const CHARGE_UNIT_ENUM = ["PER_PERSON", "PER_HOUSEHOLD"] as const;

const PAYMENT_MODE_ENUM = ["CASH", "UPI", "BANK_TRANSFER", "OTHER"] as const;

const DISPOSAL_TYPE_ENUM = ["REFUNDED", "TRANSFERRED_TO_FUND", "CARRIED_FORWARD"] as const;

const DEFICIT_DISPOSITION_ENUM = ["FROM_SOCIETY_FUND", "ADDITIONAL_COLLECTION"] as const;

// ── Create Event ──

export const createEventSchema = z
  .object({
    title: z.string().min(3, "Title must be at least 3 characters").max(200),
    description: z.string().max(5000).optional().nullable(),
    category: z.enum(EVENT_CATEGORY_ENUM),
    feeModel: z.enum(FEE_MODEL_ENUM),
    chargeUnit: z.enum(CHARGE_UNIT_ENUM).optional(),
    eventDate: z.string().min(1, "Event date is required"),
    location: z.string().max(200).optional().nullable(),
    registrationDeadline: z.string().optional().nullable(),
    feeAmount: z.number().positive("Fee amount must be positive").optional().nullable(),
    estimatedBudget: z.number().positive("Budget must be positive").optional().nullable(),
    minParticipants: z.number().int().min(1).optional().nullable(),
    maxParticipants: z.number().int().min(1).optional().nullable(),
    suggestedAmount: z.number().positive("Suggested amount must be positive").optional().nullable(),
  })
  .refine(
    (data) => {
      if (data.feeModel === "FIXED") return data.feeAmount != null && data.feeAmount > 0;
      return true;
    },
    { message: "Fee amount is required for FIXED events", path: ["feeAmount"] },
  )
  .refine(
    (data) => {
      if (
        data.feeModel === "FREE" ||
        data.feeModel === "FLEXIBLE" ||
        data.feeModel === "CONTRIBUTION"
      ) {
        return data.feeAmount == null;
      }
      return true;
    },
    { message: "Fee amount must not be set for this fee model", path: ["feeAmount"] },
  )
  .refine(
    (data) => {
      if (data.registrationDeadline && data.eventDate) {
        return new Date(data.registrationDeadline) < new Date(data.eventDate);
      }
      return true;
    },
    { message: "Registration deadline must be before event date", path: ["registrationDeadline"] },
  );

export type CreateEventInput = z.infer<typeof createEventSchema>;

// ── Update Event (DRAFT only) ──

export const updateEventSchema = z
  .object({
    title: z.string().min(3).max(200).optional(),
    description: z.string().max(5000).optional().nullable(),
    category: z.enum(EVENT_CATEGORY_ENUM).optional(),
    feeModel: z.enum(FEE_MODEL_ENUM).optional(),
    chargeUnit: z.enum(CHARGE_UNIT_ENUM).optional(),
    eventDate: z.string().optional(),
    location: z.string().max(200).optional().nullable(),
    registrationDeadline: z.string().optional().nullable(),
    feeAmount: z.number().positive().optional().nullable(),
    estimatedBudget: z.number().positive().optional().nullable(),
    minParticipants: z.number().int().min(1).optional().nullable(),
    maxParticipants: z.number().int().min(1).optional().nullable(),
    suggestedAmount: z.number().positive().optional().nullable(),
  })
  .refine((data) => Object.values(data).some((v) => v !== undefined), {
    message: "At least one field must be provided",
  });

export type UpdateEventInput = z.infer<typeof updateEventSchema>;

// ── Trigger Payment (FLEXIBLE events) ──

export const triggerPaymentSchema = z.object({
  feeAmount: z.number().positive("Fee amount must be positive"),
});

export type TriggerPaymentInput = z.infer<typeof triggerPaymentSchema>;

// ── Cancel Event ──

export const cancelEventSchema = z.object({
  reason: z.string().min(3, "Cancellation reason is required").max(1000),
});

export type CancelEventInput = z.infer<typeof cancelEventSchema>;

// ── Register for Event (Resident) ──

export const registerEventSchema = z.object({
  memberCount: z.number().int().min(1).max(10).optional().default(1),
});

export type RegisterEventInput = z.infer<typeof registerEventSchema>;

// ── Record Payment ──

export const recordEventPaymentSchema = z
  .object({
    amount: z.number().positive("Amount must be positive"),
    paymentMode: z.enum(PAYMENT_MODE_ENUM),
    referenceNo: z.string().optional(),
    paymentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format"),
    notes: z.string().max(500).optional(),
  })
  .refine(
    (data) => {
      if (data.paymentMode === "UPI" || data.paymentMode === "BANK_TRANSFER") {
        return !!data.referenceNo && data.referenceNo.length > 0;
      }
      return true;
    },
    {
      message: "Reference number is required for UPI and Bank Transfer",
      path: ["referenceNo"],
    },
  );

export type RecordEventPaymentInput = z.infer<typeof recordEventPaymentSchema>;

// ── Add Event Expense ──

const EXPENSE_CATEGORY_ENUM = [
  "MAINTENANCE",
  "SECURITY",
  "CLEANING",
  "STAFF_SALARY",
  "INFRASTRUCTURE",
  "UTILITIES",
  "EMERGENCY",
  "ADMINISTRATIVE",
  "OTHER",
] as const;

export const addEventExpenseSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format"),
  amount: z.number().positive("Amount must be positive"),
  category: z.enum(EXPENSE_CATEGORY_ENUM),
  description: z.string().min(3, "Description is required").max(500),
  receiptUrl: z.string().url().optional().nullable(),
});

export type AddEventExpenseInput = z.infer<typeof addEventExpenseSchema>;

// ── Settle Event ──

export const settleEventSchema = z.object({
  surplusDisposal: z.enum(DISPOSAL_TYPE_ENUM).optional().nullable(),
  deficitDisposition: z.enum(DEFICIT_DISPOSITION_ENUM).optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
});

export type SettleEventInput = z.infer<typeof settleEventSchema>;
