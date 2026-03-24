import { z } from "zod";

const PAYMENT_MODES = ["CASH", "UPI", "BANK_TRANSFER", "CHEQUE", "OTHER"] as const;

export const recordSubscriptionPaymentSchema = z
  .object({
    amount: z.number().positive("Amount must be positive"),
    paymentMode: z.enum(PAYMENT_MODES),
    referenceNo: z.string().optional(),
    paymentDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format"),
    notes: z.string().max(500).optional(),
    sendEmail: z.boolean().optional().default(false),
    billingOptionId: z.string().uuid().optional(),
  })
  .refine(
    (data) => {
      if (
        data.paymentMode === "UPI" ||
        data.paymentMode === "BANK_TRANSFER" ||
        data.paymentMode === "CHEQUE"
      ) {
        return !!data.referenceNo && data.referenceNo.trim().length > 0;
      }
      return true;
    },
    {
      message: "Reference number is required for UPI, Bank Transfer, and Cheque",
      path: ["referenceNo"],
    },
  );

export const correctSubscriptionPaymentSchema = z.object({
  amount: z.number().positive().optional(),
  paymentMode: z.enum(PAYMENT_MODES).optional(),
  referenceNo: z.string().optional(),
  notes: z.string().max(500).optional(),
  reason: z.string().min(5, "Reason must be at least 5 characters"),
});

export const reverseSubscriptionPaymentSchema = z.object({
  reason: z.string().min(5).max(500),
});

export const generateInvoiceSchema = z
  .object({
    periodStart: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format"),
    periodEnd: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format"),
    dueDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format"),
    notes: z.string().max(500).optional(),
  })
  .refine((data) => new Date(data.periodStart) < new Date(data.periodEnd), {
    message: "Period start must be before period end",
    path: ["periodEnd"],
  })
  .refine((data) => new Date(data.periodEnd) <= new Date(data.dueDate), {
    message: "Due date must be on or after period end",
    path: ["dueDate"],
  });

export const updateInvoiceSchema = z.object({
  status: z.enum(["UNPAID", "PAID", "PARTIALLY_PAID", "OVERDUE", "WAIVED", "CANCELLED"]).optional(),
  notes: z.string().max(500).optional(),
});

export const sendReminderSchema = z.object({
  societyId: z.string().uuid(),
  templateKey: z.enum(["expiry-reminder", "overdue-reminder", "trial-ending"]),
});

export const sendBulkRemindersSchema = z.object({
  societyIds: z.array(z.string().uuid()).min(1).max(100),
  templateKey: z.enum(["expiry-reminder", "overdue-reminder", "trial-ending"]),
});

export type RecordSubscriptionPaymentInput = z.infer<typeof recordSubscriptionPaymentSchema>;
export type CorrectSubscriptionPaymentInput = z.infer<typeof correctSubscriptionPaymentSchema>;
export type ReverseSubscriptionPaymentInput = z.infer<typeof reverseSubscriptionPaymentSchema>;
export type GenerateInvoiceInput = z.infer<typeof generateInvoiceSchema>;
