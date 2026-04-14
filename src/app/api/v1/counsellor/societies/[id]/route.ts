import { NextRequest } from "next/server";

import { internalError, notFoundError, successResponse } from "@/lib/api-helpers";
import { requireCounsellor } from "@/lib/auth-guard";
import { assertCounsellorSocietyAccess } from "@/lib/counsellor/access";
import { prisma } from "@/lib/prisma";

const OPEN_ESCALATION_STATUSES = ["PENDING", "ACKNOWLEDGED", "REVIEWING"] as const;

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: RouteContext) {
  const auth = await requireCounsellor();
  if (auth.error) return auth.error;

  const { id: societyId } = await params;
  const counsellorId = auth.data.counsellorId;

  const accessError = await assertCounsellorSocietyAccess(counsellorId, societyId);
  if (accessError) return accessError;

  try {
    const [society, assignment, residentCount, governingBodyCount, openEscalationCount] =
      await Promise.all([
        prisma.society.findUnique({
          where: { id: societyId },
          select: {
            id: true,
            name: true,
            societyCode: true,
            city: true,
            state: true,
            pincode: true,
            totalUnits: true,
            registrationNo: true,
            registrationDate: true,
            counsellorEscalationThreshold: true,
            onboardingDate: true,
          },
        }),
        prisma.counsellorSocietyAssignment.findFirst({
          where: { counsellorId, societyId, isActive: true },
          select: { assignedAt: true, isPrimary: true },
        }),
        prisma.user.count({ where: { societyId, role: "RESIDENT" } }),
        prisma.governingBodyMember.count({ where: { societyId } }),
        prisma.residentTicketEscalation.count({
          where: {
            counsellorId,
            status: { in: [...OPEN_ESCALATION_STATUSES] },
            ticket: { societyId },
          },
        }),
      ]);

    /* v8 ignore start */
    if (!society || !assignment) return notFoundError("Society not found");
    /* v8 ignore stop */

    return successResponse({
      id: society.id,
      name: society.name,
      societyCode: society.societyCode,
      city: society.city,
      state: society.state,
      pincode: society.pincode,
      totalUnits: society.totalUnits,
      registrationNo: society.registrationNo,
      registrationDate: society.registrationDate,
      counsellorEscalationThreshold: society.counsellorEscalationThreshold,
      onboardingDate: society.onboardingDate,
      assignedAt: assignment.assignedAt,
      isPrimary: assignment.isPrimary,
      counts: {
        residents: residentCount,
        governingBodyMembers: governingBodyCount,
        openEscalations: openEscalationCount,
      },
    });
  } catch {
    return internalError("Failed to fetch society");
  }
}
