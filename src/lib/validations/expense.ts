import { z } from "zod";

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

export const createExpenseSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format"),
  amount: z.number().positive("Amount must be positive"),
  category: z.enum(EXPENSE_CATEGORY_ENUM),
  description: z.string().min(3, "Description is required").max(500),
  receiptUrl: z.string().url().optional().nullable(),
});

export type CreateExpenseInput = z.infer<typeof createExpenseSchema>;

export const updateExpenseSchema = z
  .object({
    amount: z.number().positive("Amount must be positive").optional(),
    category: z.enum(EXPENSE_CATEGORY_ENUM).optional(),
    description: z.string().min(3, "Description is required").max(500).optional(),
  })
  .refine(
    (data) =>
      data.amount !== undefined || data.category !== undefined || data.description !== undefined,
    { message: "At least one field must be provided" },
  );

export type UpdateExpenseInput = z.infer<typeof updateExpenseSchema>;

export const reverseExpenseSchema = z.object({
  reason: z.string().min(5, "Reason must be at least 5 characters").max(500),
});

export type ReverseExpenseInput = z.infer<typeof reverseExpenseSchema>;
