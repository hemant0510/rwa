import { z } from "zod";

export const updateProfileSchema = z.object({
  name: z
    .string()
    .min(2, "Name must be at least 2 characters")
    .max(100, "Name must be at most 100 characters"),
});

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Current password is required"),
    newPassword: z.string().min(8, "New password must be at least 8 characters"),
    confirmPassword: z.string().min(1, "Confirm password is required"),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export type ConfigKey =
  | "trial_duration_days"
  | "trial_unit_limit"
  | "session_timeout_hours"
  | "default_fee_grace_days"
  | "support_email"
  | "support_phone"
  | "counsellor_role_enabled";

export const updatePlatformConfigSchema = z
  .object({
    trial_duration_days: z.number().int().positive().optional(),
    trial_unit_limit: z.number().int().positive().optional(),
    session_timeout_hours: z.number().int().positive().optional(),
    default_fee_grace_days: z.number().int().min(0).optional(),
    support_email: z.string().email().or(z.literal("")).optional(),
    support_phone: z.string().max(20).optional(),
    counsellor_role_enabled: z.boolean().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one config key must be provided",
  });

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
export type UpdatePlatformConfigInput = z.infer<typeof updatePlatformConfigSchema>;
