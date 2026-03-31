import { internalError, notFoundError, parseBody, successResponse } from "@/lib/api-helpers";
import { logAudit } from "@/lib/audit";
import { requireSuperAdmin } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { updateProfileSchema } from "@/lib/validations/settings";

// GET /api/v1/super-admin/settings/profile
export async function GET() {
  const auth = await requireSuperAdmin();
  if (auth.error) return auth.error;

  try {
    const superAdmin = await prisma.superAdmin.findUnique({
      where: { id: auth.data.superAdminId },
      select: { id: true, name: true, email: true, createdAt: true },
    });
    if (!superAdmin) return notFoundError("Super admin not found");

    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    return successResponse({
      id: superAdmin.id,
      name: superAdmin.name,
      email: superAdmin.email,
      createdAt: superAdmin.createdAt,
      lastLogin: user?.last_sign_in_at ?? null,
    });
  } catch {
    return internalError("Failed to fetch profile");
  }
}

// PATCH /api/v1/super-admin/settings/profile
export async function PATCH(request: Request) {
  const auth = await requireSuperAdmin();
  if (auth.error) return auth.error;

  try {
    const { data, error } = await parseBody(request, updateProfileSchema);
    if (error) return error;
    if (!data) return internalError();

    const existing = await prisma.superAdmin.findUnique({
      where: { id: auth.data.superAdminId },
    });
    if (!existing) return notFoundError("Super admin not found");

    const updated = await prisma.superAdmin.update({
      where: { id: auth.data.superAdminId },
      data: { name: data.name },
      select: { id: true, name: true, email: true, createdAt: true, updatedAt: true },
    });

    void logAudit({
      actionType: "SA_SETTINGS_UPDATED",
      userId: auth.data.superAdminId,
      entityType: "SuperAdmin",
      entityId: auth.data.superAdminId,
      oldValue: { name: existing.name },
      newValue: { name: data.name },
    });

    return successResponse(updated);
  } catch {
    return internalError("Failed to update profile");
  }
}
