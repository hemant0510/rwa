import { describe, it, expect } from "vitest";

import {
  updateProfileSchema,
  changePasswordSchema,
  updatePlatformConfigSchema,
} from "@/lib/validations/sa-settings";

describe("sa-settings validation re-exports", () => {
  it("updateProfileSchema validates name", () => {
    expect(updateProfileSchema.safeParse({ name: "Admin" }).success).toBe(true);
    expect(updateProfileSchema.safeParse({ name: "A" }).success).toBe(false);
  });

  it("changePasswordSchema validates passwords", () => {
    const valid = changePasswordSchema.safeParse({
      currentPassword: "oldpass123",
      newPassword: "newpass123",
      confirmPassword: "newpass123",
    });
    expect(valid.success).toBe(true);
  });

  it("changePasswordSchema rejects mismatched passwords", () => {
    const invalid = changePasswordSchema.safeParse({
      currentPassword: "oldpass123",
      newPassword: "newpass123",
      confirmPassword: "different",
    });
    expect(invalid.success).toBe(false);
  });

  it("updatePlatformConfigSchema validates config", () => {
    expect(updatePlatformConfigSchema.safeParse({ trial_duration_days: 14 }).success).toBe(true);
  });

  it("updatePlatformConfigSchema rejects empty object", () => {
    expect(updatePlatformConfigSchema.safeParse({}).success).toBe(false);
  });

  it("updatePlatformConfigSchema accepts counsellor_role_enabled boolean", () => {
    expect(updatePlatformConfigSchema.safeParse({ counsellor_role_enabled: true }).success).toBe(
      true,
    );
    expect(updatePlatformConfigSchema.safeParse({ counsellor_role_enabled: false }).success).toBe(
      true,
    );
  });

  it("updatePlatformConfigSchema rejects non-boolean counsellor_role_enabled", () => {
    expect(updatePlatformConfigSchema.safeParse({ counsellor_role_enabled: "yes" }).success).toBe(
      false,
    );
  });
});
