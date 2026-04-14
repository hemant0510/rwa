import { NextRequest } from "next/server";

import { internalError, notFoundError, successResponse } from "@/lib/api-helpers";
import { requireCounsellor } from "@/lib/auth-guard";
import { assertCounsellorSocietyAccess } from "@/lib/counsellor/access";
import { prisma } from "@/lib/prisma";

type RouteContext = { params: Promise<{ id: string; rid: string }> };

export async function GET(_request: NextRequest, { params }: RouteContext) {
  const auth = await requireCounsellor();
  if (auth.error) return auth.error;

  const { id: societyId, rid } = await params;
  const accessError = await assertCounsellorSocietyAccess(auth.data.counsellorId, societyId);
  if (accessError) return accessError;

  try {
    const resident = await prisma.user.findFirst({
      where: { id: rid, societyId, role: "RESIDENT" },
      select: {
        id: true,
        name: true,
        email: true,
        mobile: true,
        photoUrl: true,
        role: true,
        status: true,
        ownershipType: true,
        registeredAt: true,
        approvedAt: true,
        society: { select: { id: true, name: true } },
        userUnits: {
          where: { unlinkedAt: null },
          orderBy: { isPrimary: "desc" },
          select: {
            isPrimary: true,
            relationship: true,
            unit: {
              select: {
                id: true,
                displayLabel: true,
                towerBlock: true,
                floorNo: true,
              },
            },
          },
        },
      },
    });

    if (!resident) return notFoundError("Resident not found");

    return successResponse({
      id: resident.id,
      name: resident.name,
      email: resident.email,
      mobile: resident.mobile,
      photoUrl: resident.photoUrl,
      role: resident.role,
      status: resident.status,
      ownershipType: resident.ownershipType,
      registeredAt: resident.registeredAt,
      approvedAt: resident.approvedAt,
      society: resident.society,
      units: resident.userUnits.map((u) => ({
        id: u.unit.id,
        displayLabel: u.unit.displayLabel,
        towerBlock: u.unit.towerBlock,
        floorNo: u.unit.floorNo,
        relationship: u.relationship,
        isPrimary: u.isPrimary,
      })),
    });
  } catch {
    return internalError("Failed to fetch resident");
  }
}
