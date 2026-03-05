import { z } from "zod";

export const SOCIETY_TYPES = [
  "APARTMENT_COMPLEX",
  "BUILDER_FLOORS",
  "GATED_COMMUNITY_VILLAS",
  "INDEPENDENT_SECTOR",
  "PLOTTED_COLONY",
] as const;

export const createSocietySchema = z
  .object({
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
    joiningFee: z.number().min(0).max(100000),
    annualFee: z.number().min(0).max(100000),
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

export type CreateSocietyInput = z.infer<typeof createSocietySchema>;

export const updateSocietySchema = z
  .object({
    name: z.string().min(3, "Name must be at least 3 characters").max(200),
    state: z.string().length(2, "State code must be 2 characters"),
    city: z.string().min(2).max(50),
    pincode: z.string().regex(/^\d{6}$/, "Pincode must be 6 digits"),
    type: z.enum(SOCIETY_TYPES),
    joiningFee: z.number().min(0).max(100000),
    annualFee: z.number().min(0).max(100000),
    status: z.enum(["ACTIVE", "TRIAL", "SUSPENDED", "OFFBOARDED"]).optional(),
    adminEmail: z.string().email("Valid email is required").optional().or(z.literal("")),
    adminPassword: z
      .string()
      .min(8, "Password must be at least 8 characters")
      .optional()
      .or(z.literal("")),
    adminPasswordConfirm: z.string().optional().or(z.literal("")),
  })
  .refine(
    (data) => {
      if (data.adminPassword && data.adminPassword !== data.adminPasswordConfirm) return false;
      return true;
    },
    { message: "Passwords do not match", path: ["adminPasswordConfirm"] },
  );

export type UpdateSocietyInput = z.infer<typeof updateSocietySchema>;
