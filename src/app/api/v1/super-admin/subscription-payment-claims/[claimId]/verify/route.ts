import { NextResponse } from "next/server";

import { errorResponse, internalError, successResponse } from "@/lib/api-helpers";
import { requireSuperAdmin } from "@/lib/auth-guard";
import { generateInvoiceNo } from "@/lib/billing";
import { prisma } from "@/lib/prisma";

type RouteParams = { params: Promise<{ claimId: string }> };

/** PATCH /api/v1/super-admin/subscription-payment-claims/[claimId]/verify */
export async function PATCH(_request: Request, { params }: RouteParams) {
  const auth = await requireSuperAdmin();
  if (auth.error) return auth.error as NextResponse;

  const { claimId } = await params;

  try {
    const result = await prisma.$transaction(async (tx) => {
      // 1. Lock-read the claim inside transaction
      const claim = await tx.subscriptionPaymentClaim.findUnique({
        where: { id: claimId },
        include: {
          society: { select: { name: true, societyCode: true } },
          subscription: true,
        },
      });

      if (!claim) {
        return { notFound: true };
      }

      if (claim.status !== "PENDING") {
        return { alreadyProcessed: true };
      }

      // Period start/end are required for verification
      if (!claim.periodStart || !claim.periodEnd) {
        return { periodRequired: true };
      }

      // 2. Mark claim verified
      const updated = await tx.subscriptionPaymentClaim.update({
        where: { id: claimId },
        data: {
          status: "VERIFIED",
          verifiedBy: auth.data!.superAdminId,
          verifiedAt: new Date(),
        },
      });

      // 3. Create SubscriptionPayment record for bookkeeping
      const paymentCount = await tx.subscriptionPayment.count();
      const invoiceNo = generateInvoiceNo(new Date().getFullYear(), paymentCount + 1);

      await tx.subscriptionPayment.create({
        data: {
          societyId: claim.societyId,
          subscriptionId: claim.subscriptionId,
          amount: claim.amount,
          paymentMode: "UPI",
          referenceNo: claim.utrNumber,
          invoiceNo,
          paymentDate: claim.paymentDate,
          recordedBy: auth.data!.superAdminId,
        },
      });

      // 4. Extend subscription period
      await tx.societySubscription.update({
        where: { id: claim.subscriptionId },
        data: { currentPeriodEnd: claim.periodEnd },
      });

      // 5. Create history entry
      await tx.societySubscriptionHistory.create({
        data: {
          subscriptionId: claim.subscriptionId,
          societyId: claim.societyId,
          changeType: "PAYMENT_RECORDED",
          performedBy: auth.data!.superAdminId,
          notes: `UPI claim verified. UTR: ${claim.utrNumber}. Amount: ${claim.amount}`,
        },
      });

      return { claim: updated, alreadyProcessed: false, notFound: false, periodRequired: false };
    });

    if (result.notFound) {
      return errorResponse({ code: "NOT_FOUND", message: "Claim not found", status: 404 });
    }

    if (result.periodRequired) {
      return errorResponse({
        code: "PERIOD_REQUIRED",
        message: "Period start and end dates are required to verify a subscription payment",
        status: 400,
      });
    }

    if (result.alreadyProcessed) {
      return errorResponse({
        code: "CLAIM_ALREADY_PROCESSED",
        message: "This claim has already been verified or rejected",
        status: 409,
      });
    }

    return successResponse({ claim: result.claim });
  } catch (err) {
    console.error("[SA Sub Claim Verify]", err);
    return internalError();
  }
}
