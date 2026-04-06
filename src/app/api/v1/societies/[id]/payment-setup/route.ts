import { NextRequest } from "next/server";

import { notFoundError, successResponse, unauthorizedError } from "@/lib/api-helpers";
import { getCurrentUser } from "@/lib/get-current-user";
import { prisma } from "@/lib/prisma";

type RouteParams = { params: Promise<{ id: string }> };

/** GET /api/v1/societies/[id]/payment-setup — read UPI settings (admin or resident) */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  const { id: societyId } = await params;

  const user = await getCurrentUser();
  if (!user) return unauthorizedError("Authentication required");
  if (user.societyId !== societyId) return notFoundError("Society not found");

  const society = await prisma.society.findUnique({
    where: { id: societyId },
    select: { id: true, upiId: true, upiQrUrl: true, upiAccountName: true },
  });

  if (!society) return notFoundError("Society not found");

  return successResponse({
    upiId: society.upiId,
    upiQrUrl: society.upiQrUrl,
    upiAccountName: society.upiAccountName,
  });
}
