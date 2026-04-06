import { NextRequest } from "next/server";

import { z } from "zod";

import {
  errorResponse,
  notFoundError,
  parseBody,
  successResponse,
  unauthorizedError,
} from "@/lib/api-helpers";
import { logAudit } from "@/lib/audit";
import { getFullAccessAdmin } from "@/lib/get-current-user";
import { prisma } from "@/lib/prisma";
import { sendResidentPaymentRejected } from "@/lib/whatsapp";

const rejectSchema = z.object({
  rejectionReason: z.string().min(10, "Rejection reason must be at least 10 characters"),
});

type RouteParams = { params: Promise<{ id: string; claimId: string }> };

/** PATCH /api/v1/societies/[id]/payment-claims/[claimId]/reject — reject claim with reason */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const { id: societyId, claimId } = await params;

  const admin = await getFullAccessAdmin();
  if (!admin) return unauthorizedError("Admin authentication required");
  if (admin.societyId !== societyId) return unauthorizedError("Access denied");

  const { data, error } = await parseBody(request, rejectSchema);
  if (error) return error;

  const claim = await prisma.paymentClaim.findUnique({
    where: { id: claimId },
    include: { user: { select: { mobile: true } } },
  });

  if (!claim || claim.societyId !== societyId) return notFoundError("Claim not found");
  if (claim.status !== "PENDING") {
    return errorResponse({
      code: "CLAIM_ALREADY_PROCESSED",
      message: "This claim has already been verified or rejected",
      status: 409,
    });
  }

  const updated = await prisma.paymentClaim.update({
    where: { id: claimId },
    data: {
      status: "REJECTED",
      rejectionReason: data.rejectionReason,
      verifiedBy: admin.userId,
      verifiedAt: new Date(),
    },
  });

  void logAudit({
    actionType: "PAYMENT_CLAIM_REJECTED",
    userId: admin.userId,
    societyId,
    entityType: "PaymentClaim",
    entityId: claimId,
    newValue: { status: "REJECTED", rejectionReason: data.rejectionReason },
  });

  if (claim.user?.mobile) {
    void sendResidentPaymentRejected(
      claim.user.mobile,
      `₹${Number(updated.claimedAmount).toLocaleString("en-IN")}`,
      data.rejectionReason,
    );
  }

  return successResponse({ claim: updated });
}
