import { NextRequest } from "next/server";

import { notFoundError, parseBody, successResponse, unauthorizedError } from "@/lib/api-helpers";
import { getFullAccessAdmin } from "@/lib/get-current-user";
import { prisma } from "@/lib/prisma";
import { upiSetupSchema } from "@/lib/validations/payment-setup";

type RouteParams = { params: Promise<{ id: string }> };

/** PATCH /api/v1/societies/[id]/payment-setup/upi — update UPI ID, QR URL, account name */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const { id: societyId } = await params;

  const admin = await getFullAccessAdmin();
  if (!admin) return unauthorizedError("Admin authentication required");
  if (admin.societyId !== societyId) return notFoundError("Society not found");

  const { data, error } = await parseBody(request, upiSetupSchema);
  if (error) return error;

  const society = await prisma.society.update({
    where: { id: societyId },
    data: {
      upiId: data.upiId,
      upiQrUrl: data.upiQrUrl ?? null,
      upiAccountName: data.upiAccountName ?? null,
    },
    select: { upiId: true, upiQrUrl: true, upiAccountName: true },
  });

  return successResponse({
    upiId: society.upiId,
    upiQrUrl: society.upiQrUrl,
    upiAccountName: society.upiAccountName,
  });
}
