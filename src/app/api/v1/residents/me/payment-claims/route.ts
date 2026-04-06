import { NextRequest, NextResponse } from "next/server";

import {
  errorResponse,
  internalError,
  parseBody,
  successResponse,
  unauthorizedError,
} from "@/lib/api-helpers";
import { logAudit } from "@/lib/audit";
import { getCurrentUser } from "@/lib/get-current-user";
import { prisma } from "@/lib/prisma";
import { paymentClaimSchema } from "@/lib/validations/payment-claim";
import { sendAdminPaymentClaimReceived } from "@/lib/whatsapp";

/** GET /api/v1/residents/me/payment-claims — list own claims */
export async function GET() {
  try {
    const resident = await getCurrentUser("RESIDENT");
    if (!resident) return unauthorizedError("Resident authentication required");

    const claims = await prisma.paymentClaim.findMany({
      where: { userId: resident.userId, societyId: resident.societyId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        societyId: true,
        userId: true,
        membershipFeeId: true,
        claimedAmount: true,
        utrNumber: true,
        paymentDate: true,
        screenshotUrl: true,
        status: true,
        verifiedBy: true,
        verifiedAt: true,
        rejectionReason: true,
        adminNotes: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    return NextResponse.json({
      claims: claims.map((c) => ({ ...c, claimedAmount: Number(c.claimedAmount) })),
    });
  } catch {
    return internalError("Failed to fetch claims");
  }
}

/** POST /api/v1/residents/me/payment-claims — submit a UPI payment claim */
export async function POST(request: NextRequest) {
  try {
    const resident = await getCurrentUser("RESIDENT");
    if (!resident) return unauthorizedError("Resident authentication required");

    const { data, error } = await parseBody(request, paymentClaimSchema);
    if (error) return error;

    // Check society has UPI configured
    const society = await prisma.society.findUnique({
      where: { id: resident.societyId },
      select: { upiId: true },
    });

    if (!society?.upiId) {
      return errorResponse({
        code: "UPI_NOT_CONFIGURED",
        message: "Society has not set up UPI payments",
        status: 400,
      });
    }

    // Guard: no existing PENDING claim for this feeId from this resident
    const existingPending = await prisma.paymentClaim.findFirst({
      where: {
        membershipFeeId: data!.membershipFeeId,
        userId: resident.userId,
        status: "PENDING",
      },
    });

    if (existingPending) {
      return errorResponse({
        code: "CLAIM_ALREADY_PENDING",
        message: "You already have a pending claim for this fee",
        status: 400,
      });
    }

    // Guard: duplicate UTR within same society
    const duplicateUtr = await prisma.paymentClaim.findFirst({
      where: { utrNumber: data!.utrNumber.toUpperCase(), societyId: resident.societyId },
    });

    if (duplicateUtr) {
      return errorResponse({
        code: "UTR_DUPLICATE",
        message: "This UTR has already been used",
        status: 409,
      });
    }

    const claim = await prisma.paymentClaim.create({
      data: {
        societyId: resident.societyId,
        userId: resident.userId,
        membershipFeeId: data!.membershipFeeId,
        claimedAmount: data!.claimedAmount,
        utrNumber: data!.utrNumber.toUpperCase(),
        paymentDate: new Date(data!.paymentDate),
        screenshotUrl: data!.screenshotUrl ?? null,
        status: "PENDING",
      },
      select: {
        id: true,
        societyId: true,
        userId: true,
        membershipFeeId: true,
        claimedAmount: true,
        utrNumber: true,
        paymentDate: true,
        screenshotUrl: true,
        status: true,
        verifiedBy: true,
        verifiedAt: true,
        rejectionReason: true,
        adminNotes: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    void logAudit({
      actionType: "PAYMENT_CLAIM_SUBMITTED",
      userId: resident.userId,
      societyId: resident.societyId,
      entityType: "PaymentClaim",
      entityId: claim.id,
      newValue: { claimedAmount: Number(claim.claimedAmount), utrNumber: claim.utrNumber },
    });

    void (async () => {
      const adminUser = await prisma.user.findFirst({
        where: { societyId: resident.societyId, role: "RWA_ADMIN" },
        select: { mobile: true },
      });
      if (adminUser?.mobile) {
        const residentUser = await prisma.user.findUnique({
          where: { id: resident.userId },
          select: {
            name: true,
            userUnits: { take: 1, select: { unit: { select: { displayLabel: true } } } },
          },
        });
        await sendAdminPaymentClaimReceived(
          adminUser.mobile,
          residentUser?.name ?? "Resident",
          residentUser?.userUnits?.[0]?.unit?.displayLabel ?? "N/A",
          `₹${Number(claim.claimedAmount).toLocaleString("en-IN")}`,
          claim.utrNumber,
        );
      }
    })();

    return successResponse(
      { claim: { ...claim, claimedAmount: Number(claim.claimedAmount) } },
      201,
    );
  } catch {
    return internalError("Failed to submit claim");
  }
}
