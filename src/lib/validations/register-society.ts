import { z } from "zod";

import { SOCIETY_TYPES } from "./society";

export const registerSocietySchema = z
  .object({
    // ── Society details ──────────────────────────────────────────────────────
    name: z.string().min(3, "Name must be at least 3 characters").max(200),
    state: z.string().length(2, "State code must be 2 characters"),
    city: z.string().min(2).max(50),
    pincode: z.string().regex(/^\d{6}$/, "Pincode must be 6 digits"),
    type: z.enum(SOCIETY_TYPES),
    societyCode: z
      .string()
      .min(4, "Code must be 4-8 characters")
      .max(8, "Code must be 4-8 characters")
      .regex(/^[A-Z0-9]+$/, "Only uppercase letters and numbers"),
    // Official govt. registration number (optional — not all RWAs are formally registered)
    registrationNo: z
      .string()
      .max(50, "Registration number must be 50 characters or less")
      .optional(),
    // Date of official government registration (optional)
    // Allow empty string (form default) or a valid YYYY-MM-DD date string
    registrationDate: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be in YYYY-MM-DD format")
      .or(z.literal(""))
      .optional(),
    // Plan pre-selected during signup (optional — society starts on trial regardless)
    selectedPlanId: z.string().uuid("Invalid plan ID").optional(),

    // ── Admin account ────────────────────────────────────────────────────────
    adminName: z.string().min(2, "Name must be at least 2 characters").max(100),
    adminEmail: z.string().email("Valid email is required"),
    adminMobile: z
      .string()
      .regex(/^[6-9]\d{9}$/, "Invalid Indian mobile number")
      .optional(),
    adminPassword: z.string().min(8, "Password must be at least 8 characters"),
    adminPasswordConfirm: z.string().min(8, "Password must be at least 8 characters"),
  })
  .refine((data) => data.adminPassword === data.adminPasswordConfirm, {
    message: "Passwords do not match",
    path: ["adminPasswordConfirm"],
  });

export type RegisterSocietyInput = z.infer<typeof registerSocietySchema>;
