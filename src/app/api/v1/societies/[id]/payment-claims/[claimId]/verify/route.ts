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
import { generateReceiptNo } from "@/lib/fee-calculator";
import { getFullAccessAdmin } from "@/lib/get-current-user";
import { prisma } from "@/lib/prisma";
import { sendResidentPaymentConfirmed } from "@/lib/whatsapp";

const verifySchema = z.object({
  adminNotes: z.string().optional(),
});

type RouteParams = { params: Promise<{ id: string; claimId: string }> };

/** PATCH /api/v1/societies/[id]/payment-claims/[claimId]/verify — verify claim, create FeePayment */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const { id: societyId, claimId } = await params;

  const admin = await getFullAccessAdmin();
  if (!admin) return unauthorizedError("Admin authentication required");
  if (admin.societyId !== societyId) return unauthorizedError("Access denied");

  const { data, error } = await parseBody(request, verifySchema);
  if (error) return error;
  const adminNotes = data.adminNotes;

  const result = await prisma.$transaction(async (tx) => {
    const claim = await tx.paymentClaim.findUnique({
      where: { id: claimId },
      include: { society: true, membershipFee: true, user: { select: { mobile: true } } },
    });

    if (!claim || claim.societyId !== societyId) return { notFound: true };
    if (claim.status !== "PENDING") return { alreadyProcessed: true };

    const updated = await tx.paymentClaim.update({
      where: { id: claimId },
      data: {
        status: "VERIFIED",
        verifiedBy: admin.userId,
        verifiedAt: new Date(),
        adminNotes: adminNotes ?? null,
      },
    });

    const paymentCount = await tx.feePayment.count({ where: { societyId } });
    const receiptNo = generateReceiptNo(
      claim.society.societyCode,
      new Date().getFullYear(),
      paymentCount + 1,
    );

    const feePayment = await tx.feePayment.create({
      data: {
        feeId: claim.membershipFeeId,
        userId: claim.userId,
        societyId,
        amount: claim.claimedAmount,
        paymentMode: "UPI_CLAIM",
        referenceNo: claim.utrNumber,
        receiptNo,
        paymentDate: claim.paymentDate,
        paymentClaimId: claim.id,
        recordedBy: admin.userId,
        correctionWindowEnds: new Date(Date.now() + 48 * 60 * 60 * 1000),
      },
    });

    const newAmountPaid = Number(claim.membershipFee.amountPaid) + Number(claim.claimedAmount);
    const newFeeStatus =
      newAmountPaid >= Number(claim.membershipFee.amountDue) ? "PAID" : "PARTIAL";

    await tx.membershipFee.update({
      where: { id: claim.membershipFeeId },
      data: { amountPaid: newAmountPaid, status: newFeeStatus },
    });

    const userStatus = newFeeStatus === "PAID" ? "ACTIVE_PAID" : "ACTIVE_PARTIAL";
    await tx.user.update({
      where: { id: claim.userId },
      data: { status: userStatus },
    });

    return {
      claim: updated,
      feePayment,
      receiptNo,
      userMobile: claim.user?.mobile ?? null,
      claimedAmount: Number(claim.claimedAmount),
      alreadyProcessed: false,
      notFound: false,
    };
  });

  if (result.notFound) return notFoundError("Claim not found");
  if (result.alreadyProcessed) {
    return errorResponse({
      code: "CLAIM_ALREADY_PROCESSED",
      message: "This claim has already been verified or rejected",
      status: 409,
    });
  }

  void logAudit({
    actionType: "PAYMENT_CLAIM_VERIFIED",
    userId: admin.userId,
    societyId,
    entityType: "PaymentClaim",
    entityId: claimId,
    newValue: { status: "VERIFIED", receiptNo: result.receiptNo },
  });

  if (result.userMobile) {
    void sendResidentPaymentConfirmed(
      result.userMobile,
      `₹${result.claimedAmount.toLocaleString("en-IN")}`,
      result.receiptNo!,
    );
  }

  return successResponse({ claim: result.claim, receiptNo: result.receiptNo });
}
