import { internalError, parseBody, successResponse } from "@/lib/api-helpers";
import { logAudit } from "@/lib/audit";
import { requireSuperAdmin } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import { updatePlatformConfigSchema } from "@/lib/validations/settings";

export const CONFIG_DEFAULTS: Record<string, { value: string; type: string; label: string }> = {
  trial_duration_days: { value: "30", type: "number", label: "Trial Duration (days)" },
  trial_unit_limit: { value: "50", type: "number", label: "Trial Unit Limit" },
  session_timeout_hours: { value: "8", type: "number", label: "Session Timeout (hours)" },
  default_fee_grace_days: { value: "15", type: "number", label: "Fee Grace Period (days)" },
  support_email: { value: "", type: "string", label: "Support Email" },
  support_phone: { value: "", type: "string", label: "Support Phone" },
};

function mergeWithDefaults(stored: { key: string; value: string; type: string; label: string }[]) {
  const storedMap = new Map(stored.map((r) => [r.key, r]));
  return Object.entries(CONFIG_DEFAULTS).map(([key, def]) => {
    const row = storedMap.get(key);
    return { key, value: row?.value ?? def.value, type: def.type, label: def.label };
  });
}

// GET /api/v1/super-admin/settings/platform-config
export async function GET() {
  const auth = await requireSuperAdmin();
  if (auth.error) return auth.error;

  try {
    const stored = await prisma.platformConfig.findMany({
      select: { key: true, value: true, type: true, label: true },
    });
    return successResponse(mergeWithDefaults(stored));
  } catch {
    return internalError("Failed to fetch platform config");
  }
}

// PATCH /api/v1/super-admin/settings/platform-config
export async function PATCH(request: Request) {
  const auth = await requireSuperAdmin();
  if (auth.error) return auth.error;

  try {
    const { data, error } = await parseBody(request, updatePlatformConfigSchema);
    if (error) return error;
    if (!data) return internalError();

    const entries = Object.entries(data).filter(([, v]) => v !== undefined) as [
      string,
      string | number,
    ][];

    await Promise.all(
      entries.map(([key, val]) => {
        const def = CONFIG_DEFAULTS[key];
        const value = String(val);
        return prisma.platformConfig.upsert({
          where: { key },
          update: { value, updatedBy: auth.data.superAdminId },
          create: {
            key,
            value,
            type: def?.type ?? "string",
            label: def?.label ?? key,
            updatedBy: auth.data.superAdminId,
          },
        });
      }),
    );

    void logAudit({
      actionType: "SA_SETTINGS_UPDATED",
      userId: auth.data.superAdminId,
      entityType: "PlatformConfig",
      entityId: "platform",
      newValue: Object.fromEntries(entries.map(([k, v]) => [k, String(v)])),
    });

    const stored = await prisma.platformConfig.findMany({
      select: { key: true, value: true, type: true, label: true },
    });
    return successResponse(mergeWithDefaults(stored));
  } catch {
    return internalError("Failed to update platform config");
  }
}
