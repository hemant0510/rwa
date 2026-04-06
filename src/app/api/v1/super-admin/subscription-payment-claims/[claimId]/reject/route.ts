import { NextResponse } from "next/server";

import { errorResponse, internalError, successResponse, validationError } from "@/lib/api-helpers";
import { logAudit } from "@/lib/audit";
import { requireSuperAdmin } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import { rejectClaimSchema } from "@/lib/validations/payment-claim";
import { sendAdminSubPaymentRejected } from "@/lib/whatsapp";

type RouteParams = { params: Promise<{ claimId: string }> };

/** PATCH /api/v1/super-admin/subscription-payment-claims/[claimId]/reject */
export async function PATCH(request: Request, { params }: RouteParams) {
  const auth = await requireSuperAdmin();
  if (auth.error) return auth.error as NextResponse;

  const { claimId } = await params;

  try {
    const body = await request.json();
    const result = rejectClaimSchema.safeParse(body);

    if (!result.success) {
      return validationError(result.error);
    }

    const claim = await prisma.subscriptionPaymentClaim.findUnique({
      where: { id: claimId },
    });

    if (!claim) {
      return errorResponse({ code: "NOT_FOUND", message: "Claim not found", status: 404 });
    }

    if (claim.status !== "PENDING") {
      return errorResponse({
        code: "CLAIM_ALREADY_PROCESSED",
        message: "This claim has already been verified or rejected",
        status: 409,
      });
    }

    const updated = await prisma.subscriptionPaymentClaim.update({
      where: { id: claimId },
      data: {
        status: "REJECTED",
        rejectionReason: result.data.rejectionReason,
        verifiedBy: auth.data!.superAdminId,
        verifiedAt: new Date(),
      },
    });

    void logAudit({
      actionType: "SUBSCRIPTION_CLAIM_REJECTED",
      userId: auth.data!.superAdminId,
      societyId: updated.societyId,
      entityType: "SubscriptionPaymentClaim",
      entityId: claimId,
      newValue: { status: "REJECTED", rejectionReason: result.data.rejectionReason },
    });

    void (async () => {
      const adminUser = await prisma.user.findFirst({
        where: { societyId: updated.societyId, role: "RWA_ADMIN" },
        select: { mobile: true },
      });
      if (adminUser?.mobile) {
        await sendAdminSubPaymentRejected(
          adminUser.mobile,
          `₹${Number(updated.amount).toLocaleString("en-IN")}`,
          result.data.rejectionReason,
        );
      }
    })();

    return successResponse({ claim: updated });
  } catch (err) {
    console.error("[SA Sub Claim Reject]", err);
    return internalError();
  }
}
