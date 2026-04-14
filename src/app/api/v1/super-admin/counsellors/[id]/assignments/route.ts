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
import { assignSocietiesSchema } from "@/lib/validations/counsellor";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: RouteContext) {
  const auth = await requireSuperAdmin();
  if (auth.error) return auth.error;

  const { id } = await params;

  try {
    const counsellor = await prisma.counsellor.findUnique({ where: { id }, select: { id: true } });
    if (!counsellor) return notFoundError("Counsellor not found");

    const assignments = await prisma.counsellorSocietyAssignment.findMany({
      where: { counsellorId: id, isActive: true },
      orderBy: { assignedAt: "desc" },
      select: {
        id: true,
        counsellorId: true,
        societyId: true,
        assignedById: true,
        assignedAt: true,
        isPrimary: true,
        isActive: true,
        revokedAt: true,
        revokedById: true,
        notes: true,
        society: {
          select: {
            id: true,
            name: true,
            societyCode: true,
            city: true,
            state: true,
            totalUnits: true,
          },
        },
      },
    });

    return successResponse({ assignments });
  } catch {
    return internalError("Failed to fetch assignments");
  }
}

export async function POST(request: NextRequest, { params }: RouteContext) {
  const auth = await requireSuperAdmin();
  if (auth.error) return auth.error;

  const { id: counsellorId } = await params;

  const { data, error } = await parseBody(request, assignSocietiesSchema);
  if (error) return error;
  /* v8 ignore start */
  if (!data) return internalError();
  /* v8 ignore stop */

  try {
    const counsellor = await prisma.counsellor.findUnique({
      where: { id: counsellorId },
      select: { id: true, email: true, mobile: true, nationalId: true, isActive: true },
    });
    if (!counsellor) return notFoundError("Counsellor not found");
    if (!counsellor.isActive) {
      return errorResponse({
        code: "COUNSELLOR_SUSPENDED",
        message: "Cannot assign societies to a suspended counsellor",
        status: 400,
      });
    }

    const societyIds = Array.from(new Set(data.societyIds));

    // Conflict-of-interest check: block if counsellor's email / mobile matches
    // any User in any of the target societies.
    const coiOr: Array<Record<string, unknown>> = [];
    if (counsellor.email) coiOr.push({ email: counsellor.email });
    if (counsellor.mobile) coiOr.push({ mobile: counsellor.mobile });

    if (coiOr.length > 0) {
      const conflict = await prisma.user.findFirst({
        where: {
          societyId: { in: societyIds },
          OR: coiOr,
        },
        select: { societyId: true, email: true, mobile: true },
      });
      if (conflict) {
        return errorResponse({
          code: "CONFLICT_OF_INTEREST",
          message:
            "Counsellor contact details match an existing user in one of the selected societies. Assignment blocked.",
          status: 409,
        });
      }
    }

    const existing = await prisma.counsellorSocietyAssignment.findMany({
      where: { counsellorId, societyId: { in: societyIds } },
      select: { id: true, societyId: true, isActive: true },
    });
    const existingMap = new Map(existing.map((a) => [a.societyId, a]));

    // Count any currently-active primary assignments per society (globally)
    const currentPrimary = await prisma.counsellorSocietyAssignment.findMany({
      where: { societyId: { in: societyIds }, isPrimary: true, isActive: true },
      select: { societyId: true },
    });
    const hasPrimary = new Set(currentPrimary.map((p) => p.societyId));

    const created: Array<{ societyId: string; id: string; isPrimary: boolean }> = [];
    const reactivated: string[] = [];

    await prisma.$transaction(async (tx) => {
      for (const societyId of societyIds) {
        const prior = existingMap.get(societyId);
        const isPrimary = !hasPrimary.has(societyId);

        if (prior) {
          if (!prior.isActive) {
            await tx.counsellorSocietyAssignment.update({
              where: { id: prior.id },
              data: {
                isActive: true,
                revokedAt: null,
                revokedById: null,
                assignedById: auth.data.superAdminId,
                assignedAt: new Date(),
                notes: data.notes ?? null,
                isPrimary,
              },
            });
            reactivated.push(societyId);
            /* v8 ignore start */
            if (isPrimary) hasPrimary.add(societyId);
            /* v8 ignore stop */
          }
          // else: already active — idempotent, skip
        } else {
          const row = await tx.counsellorSocietyAssignment.create({
            data: {
              counsellorId,
              societyId,
              assignedById: auth.data.superAdminId,
              isPrimary,
              isActive: true,
              notes: data.notes ?? null,
            },
            select: { id: true },
          });
          created.push({ societyId, id: row.id, isPrimary });
          if (isPrimary) hasPrimary.add(societyId);
        }
      }
    });

    void logAudit({
      actionType: "SA_COUNSELLOR_UPDATED",
      userId: auth.data.superAdminId,
      entityType: "CounsellorSocietyAssignment",
      entityId: counsellorId,
      newValue: {
        assigned: created.map((c) => c.societyId),
        reactivated,
        notes: data.notes ?? null,
      },
    });

    return successResponse(
      {
        counsellorId,
        assigned: created.length,
        reactivated: reactivated.length,
        alreadyActive: societyIds.length - created.length - reactivated.length,
        societyIds,
      },
      201,
    );
  } catch {
    return internalError("Failed to assign societies");
  }
}
