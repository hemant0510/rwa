import { z } from "zod";

export const recordPaymentSchema = z
  .object({
    amount: z.number().positive("Amount must be positive"),
    paymentMode: z.enum(["CASH", "UPI", "BANK_TRANSFER", "OTHER"]),
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

export type RecordPaymentInput = z.infer<typeof recordPaymentSchema>;

export const grantExemptionSchema = z.object({
  reason: z.string().min(10, "Reason must be at least 10 characters").max(500),
});

export type GrantExemptionInput = z.infer<typeof grantExemptionSchema>;

export const correctPaymentSchema = z.object({
  amount: z.number().positive().optional(),
  paymentMode: z.enum(["CASH", "UPI", "BANK_TRANSFER", "OTHER"]).optional(),
  referenceNo: z.string().optional(),
  notes: z.string().max(500).optional(),
  reason: z.string().min(5, "Reason is required"),
});

export type CorrectPaymentInput = z.infer<typeof correctPaymentSchema>;

export const reversePaymentSchema = z.object({
  reason: z.string().min(5, "Reason must be at least 5 characters").max(500),
});

export type ReversePaymentInput = z.infer<typeof reversePaymentSchema>;
