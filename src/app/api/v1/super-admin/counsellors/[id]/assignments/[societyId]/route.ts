import { NextRequest } from "next/server";

import { internalError, notFoundError, successResponse } from "@/lib/api-helpers";
import { logAudit } from "@/lib/audit";
import { requireSuperAdmin } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";

type RouteContext = { params: Promise<{ id: string; societyId: string }> };

export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  const auth = await requireSuperAdmin();
  if (auth.error) return auth.error;

  const { id: counsellorId, societyId } = await params;

  try {
    const assignment = await prisma.counsellorSocietyAssignment.findUnique({
      where: { counsellorId_societyId: { counsellorId, societyId } },
      select: { id: true, isActive: true, isPrimary: true },
    });
    if (!assignment) return notFoundError("Assignment not found");

    if (!assignment.isActive) {
      // Already revoked — idempotent success
      return successResponse({ id: assignment.id, revoked: true });
    }

    await prisma.counsellorSocietyAssignment.update({
      where: { id: assignment.id },
      data: {
        isActive: false,
        revokedAt: new Date(),
        revokedById: auth.data.superAdminId,
      },
    });

    // If we revoked the primary, promote the oldest active secondary (if any)
    if (assignment.isPrimary) {
      const nextPrimary = await prisma.counsellorSocietyAssignment.findFirst({
        where: { societyId, isActive: true, isPrimary: false },
        orderBy: { assignedAt: "asc" },
        select: { id: true },
      });
      if (nextPrimary) {
        await prisma.counsellorSocietyAssignment.update({
          where: { id: nextPrimary.id },
          data: { isPrimary: true },
        });
      }
    }

    void logAudit({
      actionType: "SA_COUNSELLOR_UPDATED",
      userId: auth.data.superAdminId,
      entityType: "CounsellorSocietyAssignment",
      entityId: assignment.id,
      oldValue: { societyId, counsellorId, isPrimary: assignment.isPrimary },
      newValue: { revoked: true },
    });

    return successResponse({ id: assignment.id, revoked: true });
  } catch {
    return internalError("Failed to revoke assignment");
  }
}
