// Re-export from settings.ts for backward compatibility with the plan's naming convention.
// The actual schemas are defined in settings.ts.
export {
  updateProfileSchema,
  changePasswordSchema,
  updatePlatformConfigSchema,
  type UpdateProfileInput,
  type ChangePasswordInput,
  type UpdatePlatformConfigInput,
  type ConfigKey,
} from "./settings";
