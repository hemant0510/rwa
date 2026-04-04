import { z } from "zod";

export const upiSetupSchema = z.object({
  upiId: z
    .string()
    .regex(/^[a-zA-Z0-9._-]+@[a-zA-Z]+$/, "Invalid UPI ID format (e.g. society@sbi)"),
  upiQrUrl: z.string().url().optional(),
  upiAccountName: z.string().max(200).optional(),
});

export const platformUpiSchema = z.object({
  platformUpiId: z.string().regex(/^[a-zA-Z0-9._-]+@[a-zA-Z]+$/),
  platformUpiQrUrl: z.string().url().optional(),
  platformUpiAccountName: z.string().max(200).optional(),
});
