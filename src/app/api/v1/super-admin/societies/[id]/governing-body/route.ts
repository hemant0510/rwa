import { type NextRequest, NextResponse } from "next/server";

import { internalError, successResponse } from "@/lib/api-helpers";
import { requireSuperAdmin } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireSuperAdmin();
  if (auth.error) return auth.error as NextResponse;

  try {
    const { id: societyId } = await params;

    const [members, designations] = await Promise.all([
      prisma.governingBodyMember.findMany({
        where: { societyId },
        include: {
          user: { select: { id: true, name: true, email: true, mobile: true } },
          designation: { select: { id: true, name: true } },
        },
        orderBy: { designation: { sortOrder: "asc" } },
      }),
      prisma.designation.findMany({
        where: { societyId },
        orderBy: { sortOrder: "asc" },
      }),
    ]);

    return successResponse({
      members: members.map((m) => ({
        id: m.id,
        userId: m.userId,
        name: m.user.name,
        email: m.user.email,
        mobile: m.user.mobile,
        designation: m.designation.name,
        designationId: m.designationId,
        assignedAt: m.assignedAt,
      })),
      designations: designations.map((d) => ({
        id: d.id,
        name: d.name,
        sortOrder: d.sortOrder,
      })),
    });
  } catch (err) {
    console.error("[SA Governing Body]", err);
    return internalError();
  }
}
