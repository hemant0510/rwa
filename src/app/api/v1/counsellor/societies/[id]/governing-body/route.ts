import { NextRequest } from "next/server";

import { internalError, successResponse } from "@/lib/api-helpers";
import { requireCounsellor } from "@/lib/auth-guard";
import { assertCounsellorSocietyAccess } from "@/lib/counsellor/access";
import { prisma } from "@/lib/prisma";

type RouteContext = { params: Promise<{ id: string }> };

export async function GET(_request: NextRequest, { params }: RouteContext) {
  const auth = await requireCounsellor();
  if (auth.error) return auth.error;

  const { id: societyId } = await params;
  const accessError = await assertCounsellorSocietyAccess(
    auth.data.counsellorId,
    societyId,
    auth.data.isSuperAdmin,
  );
  if (accessError) return accessError;

  try {
    const rows = await prisma.governingBodyMember.findMany({
      where: { societyId },
      orderBy: [{ designation: { sortOrder: "asc" } }, { user: { name: "asc" } }],
      select: {
        id: true,
        assignedAt: true,
        designation: { select: { name: true } },
        user: {
          select: {
            name: true,
            email: true,
            mobile: true,
            photoUrl: true,
          },
        },
      },
    });

    const members = rows.map((r) => ({
      id: r.id,
      name: r.user.name,
      email: r.user.email,
      mobile: r.user.mobile,
      designation: r.designation.name,
      photoUrl: r.user.photoUrl,
      assignedAt: r.assignedAt,
    }));

    return successResponse({ members });
  } catch {
    return internalError("Failed to fetch governing body");
  }
}
