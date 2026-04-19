import { NextRequest } from "next/server";

import { internalError, notFoundError, parseBody, successResponse } from "@/lib/api-helpers";
import { logAudit } from "@/lib/audit";
import { requireSuperAdmin } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import { createAdminClient } from "@/lib/supabase/admin";
import { updateCounsellorSchema } from "@/lib/validations/counsellor";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: RouteContext) {
  const auth = await requireSuperAdmin();
  if (auth.error) return auth.error;

  const { id } = await params;

  try {
    const counsellor = await prisma.counsellor.findUnique({
      where: { id },
      select: {
        id: true,
        authUserId: true,
        email: true,
        mobile: true,
        name: true,
        nationalId: true,
        photoUrl: true,
        bio: true,
        publicBlurb: true,
        isActive: true,
        mfaRequired: true,
        mfaEnrolledAt: true,
        passwordSetAt: true,
        lastLoginAt: true,
        createdAt: true,
        updatedAt: true,
        _count: { select: { assignments: { where: { isActive: true } } } },
      },
    });

    if (!counsellor) return notFoundError("Counsellor not found");

    return successResponse(counsellor);
  } catch {
    return internalError("Failed to fetch counsellor");
  }
}

export async function PATCH(request: NextRequest, { params }: RouteContext) {
  const auth = await requireSuperAdmin();
  if (auth.error) return auth.error;

  const { id } = await params;

  const { data, error } = await parseBody(request, updateCounsellorSchema);
  if (error) return error;
  /* v8 ignore next */
  if (!data) return internalError();

  try {
    const before = await prisma.counsellor.findUnique({
      where: { id },
      select: { id: true, isActive: true, name: true, email: true },
    });
    if (!before) return notFoundError("Counsellor not found");

    const updated = await prisma.counsellor.update({
      where: { id },
      data,
    });

    let action: "SA_COUNSELLOR_UPDATED" | "SA_COUNSELLOR_SUSPENDED" | "SA_COUNSELLOR_REACTIVATED" =
      "SA_COUNSELLOR_UPDATED";
    if (data.isActive === false && before.isActive) action = "SA_COUNSELLOR_SUSPENDED";
    else if (data.isActive === true && !before.isActive) action = "SA_COUNSELLOR_REACTIVATED";

    void logAudit({
      actionType: action,
      userId: auth.data.superAdminId,
      entityType: "Counsellor",
      entityId: id,
      oldValue: { name: before.name, email: before.email, isActive: before.isActive },
      newValue: { name: updated.name, email: updated.email, isActive: updated.isActive },
    });

    return successResponse({
      id: updated.id,
      name: updated.name,
      email: updated.email,
      isActive: updated.isActive,
    });
  } catch {
    return internalError("Failed to update counsellor");
  }
}

export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  const auth = await requireSuperAdmin();
  if (auth.error) return auth.error;

  const { id } = await params;

  try {
    const counsellor = await prisma.counsellor.findUnique({
      where: { id },
      select: { id: true, authUserId: true, name: true, email: true },
    });
    if (!counsellor) return notFoundError("Counsellor not found");

    await prisma.counsellor.delete({ where: { id } });

    const supabaseAdmin = createAdminClient();
    await supabaseAdmin.auth.admin.deleteUser(counsellor.authUserId).catch(() => undefined);

    void logAudit({
      actionType: "SA_COUNSELLOR_DELETED",
      userId: auth.data.superAdminId,
      entityType: "Counsellor",
      entityId: id,
      oldValue: { name: counsellor.name, email: counsellor.email },
    });

    return successResponse({ id, deleted: true });
  } catch {
    return internalError("Failed to delete counsellor");
  }
}
