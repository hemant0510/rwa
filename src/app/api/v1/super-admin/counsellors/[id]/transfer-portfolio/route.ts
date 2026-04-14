import { NextRequest } from "next/server";

import {
  errorResponse,
  internalError,
  notFoundError,
  parseBody,
  successResponse,
} from "@/lib/api-helpers";
import { logAudit } from "@/lib/audit";
import { requireSuperAdmin } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import { transferPortfolioSchema } from "@/lib/validations/counsellor";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(request: NextRequest, { params }: RouteContext) {
  const auth = await requireSuperAdmin();
  if (auth.error) return auth.error;

  const { id: sourceId } = await params;

  const { data, error } = await parseBody(request, transferPortfolioSchema);
  if (error) return error;
  /* v8 ignore start */
  if (!data) return internalError();
  /* v8 ignore stop */

  if (data.targetCounsellorId === sourceId) {
    return errorResponse({
      code: "INVALID_TRANSFER",
      message: "Source and target counsellor must differ",
      status: 400,
    });
  }

  try {
    const [source, target] = await Promise.all([
      prisma.counsellor.findUnique({
        where: { id: sourceId },
        select: { id: true, name: true, email: true },
      }),
      prisma.counsellor.findUnique({
        where: { id: data.targetCounsellorId },
        select: {
          id: true,
          name: true,
          email: true,
          mobile: true,
          isActive: true,
        },
      }),
    ]);

    if (!source) return notFoundError("Source counsellor not found");
    if (!target) return notFoundError("Target counsellor not found");
    if (!target.isActive) {
      return errorResponse({
        code: "TARGET_SUSPENDED",
        message: "Cannot transfer to a suspended counsellor",
        status: 400,
      });
    }

    const whereSource: Record<string, unknown> = { counsellorId: sourceId, isActive: true };
    if (data.societyIds && data.societyIds.length > 0) {
      whereSource.societyId = { in: data.societyIds };
    }

    const sourceAssignments = await prisma.counsellorSocietyAssignment.findMany({
      where: whereSource,
      select: { id: true, societyId: true, isPrimary: true, notes: true },
    });

    if (sourceAssignments.length === 0) {
      return successResponse({ transferred: 0, skipped: 0 });
    }

    const societyIds = sourceAssignments.map((a) => a.societyId);

    // COI check against target counsellor
    const coiOr: Array<Record<string, unknown>> = [];
    if (target.email) coiOr.push({ email: target.email });
    if (target.mobile) coiOr.push({ mobile: target.mobile });

    if (coiOr.length > 0) {
      const conflict = await prisma.user.findFirst({
        where: { societyId: { in: societyIds }, OR: coiOr },
        select: { societyId: true },
      });
      if (conflict) {
        return errorResponse({
          code: "CONFLICT_OF_INTEREST",
          message:
            "Target counsellor's contact details match a user in one of the source societies. Transfer blocked.",
          status: 409,
        });
      }
    }

    const existingTargetAssignments = await prisma.counsellorSocietyAssignment.findMany({
      where: { counsellorId: target.id, societyId: { in: societyIds } },
      select: { id: true, societyId: true, isActive: true },
    });
    const existingTargetMap = new Map(existingTargetAssignments.map((a) => [a.societyId, a]));

    let transferred = 0;
    let skipped = 0;

    await prisma.$transaction(async (tx) => {
      for (const a of sourceAssignments) {
        // Revoke the source
        await tx.counsellorSocietyAssignment.update({
          where: { id: a.id },
          data: {
            isActive: false,
            revokedAt: new Date(),
            revokedById: auth.data.superAdminId,
          },
        });

        // Create or reactivate target
        const priorTarget = existingTargetMap.get(a.societyId);
        if (priorTarget) {
          if (!priorTarget.isActive) {
            await tx.counsellorSocietyAssignment.update({
              where: { id: priorTarget.id },
              data: {
                isActive: true,
                revokedAt: null,
                revokedById: null,
                assignedById: auth.data.superAdminId,
                assignedAt: new Date(),
                isPrimary: a.isPrimary,
                notes: a.notes,
              },
            });
            transferred++;
          } else {
            skipped++;
          }
        } else {
          await tx.counsellorSocietyAssignment.create({
            data: {
              counsellorId: target.id,
              societyId: a.societyId,
              assignedById: auth.data.superAdminId,
              isPrimary: a.isPrimary,
              isActive: true,
              notes: a.notes,
            },
          });
          transferred++;
        }
      }
    });

    void logAudit({
      actionType: "SA_COUNSELLOR_UPDATED",
      userId: auth.data.superAdminId,
      entityType: "CounsellorSocietyAssignment",
      entityId: sourceId,
      oldValue: { counsellorId: sourceId, societyIds },
      newValue: { counsellorId: target.id, transferred, skipped },
    });

    return successResponse({
      sourceCounsellorId: sourceId,
      targetCounsellorId: target.id,
      transferred,
      skipped,
    });
  } catch {
    return internalError("Failed to transfer portfolio");
  }
}
