import { z } from "zod";

export const createExpenseSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Invalid date format"),
  amount: z.number().positive("Amount must be positive"),
  category: z.enum([
    "MAINTENANCE",
    "SECURITY",
    "CLEANING",
    "STAFF_SALARY",
    "INFRASTRUCTURE",
    "UTILITIES",
    "EMERGENCY",
    "ADMINISTRATIVE",
    "OTHER",
  ]),
  description: z.string().min(3, "Description is required").max(500),
});

export type CreateExpenseInput = z.infer<typeof createExpenseSchema>;

export const reverseExpenseSchema = z.object({
  reason: z.string().min(5, "Reason must be at least 5 characters").max(500),
});

export type ReverseExpenseInput = z.infer<typeof reverseExpenseSchema>;
