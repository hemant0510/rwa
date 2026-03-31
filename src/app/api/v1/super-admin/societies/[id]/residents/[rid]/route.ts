import { type NextRequest, NextResponse } from "next/server";

import { internalError, notFoundError, successResponse } from "@/lib/api-helpers";
import { requireSuperAdmin } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";

type RouteParams = { params: Promise<{ id: string; rid: string }> };

export async function GET(_req: NextRequest, { params }: RouteParams) {
  const auth = await requireSuperAdmin();
  if (auth.error) return auth.error as NextResponse;

  try {
    const { id: societyId, rid } = await params;

    const resident = await prisma.user.findUnique({
      where: { id: rid },
      include: {
        userUnits: { include: { unit: true } },
        membershipFees: {
          orderBy: { createdAt: "desc" },
          include: { feePayments: { orderBy: { createdAt: "desc" } } },
        },
      },
    });

    if (!resident || resident.societyId !== societyId) {
      return notFoundError("Resident not found");
    }

    return successResponse(resident);
  } catch (err) {
    console.error("[SA Resident Detail]", err);
    return internalError();
  }
}
