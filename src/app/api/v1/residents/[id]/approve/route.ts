import { NextRequest, NextResponse } from "next/server";

import { Prisma } from "@prisma/client";

import { notFoundError, internalError } from "@/lib/api-helpers";
import { generateRWAID, calculateProRata, getSessionYear } from "@/lib/fee-calculator";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  try {
    const { id } = await params;

    const user = await prisma.user.findUnique({
      where: { id },
      include: { society: true },
    });

    if (!user) return notFoundError("Resident not found");
    if (user.status !== "PENDING_APPROVAL") {
      return NextResponse.json(
        {
          error: { code: "INVALID_STATUS", message: "Resident is not in pending approval status" },
        },
        { status: 400 },
      );
    }

    const society = user.society;
    if (!society) return internalError("Resident has no society");

    const now = new Date();
    const year = now.getFullYear();

    // Count approved residents for RWAID sequence
    const residentCount = await prisma.user.count({
      where: {
        societyId: society.id,
        role: "RESIDENT",
        rwaid: { not: null },
      },
    });

    const rwaid = generateRWAID(society.societyId, year, residentCount + 1);

    // Calculate pro-rata
    const approvalMonth = now.getMonth() + 1;
    const proRata = calculateProRata({
      annualFee: Number(society.annualFee),
      joiningFee: Number(society.joiningFee),
      sessionStartMonth: society.feeSessionStartMonth,
      approvalMonth,
    });

    const sessionYear = getSessionYear(now, society.feeSessionStartMonth);

    // Transaction: approve + create unit + create fee record
    const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
      // Update user
      const updatedUser = await tx.user.update({
        where: { id },
        data: {
          rwaid,
          status: "ACTIVE_PENDING",
          approvedAt: now,
        },
      });

      // Create fee record (joining + pro-rata)
      const sessionStart = new Date(
        parseInt(sessionYear.split("-")[0]),
        society.feeSessionStartMonth - 1,
        1,
      );
      const sessionEnd = new Date(
        parseInt(sessionYear.split("-")[0]) + 1,
        society.feeSessionStartMonth - 1,
        0,
      );

      await tx.membershipFee.create({
        data: {
          userId: id,
          societyId: society.id,
          sessionYear,
          sessionStart,
          sessionEnd,
          amountDue: proRata.totalFirstPayment,
          status: "PENDING",
          isProrata: true,
          prorataMonths: proRata.remainingMonths,
          joiningFeeIncluded: true,
          gracePeriodEnd: new Date(
            sessionStart.getTime() + society.gracePeriodDays * 24 * 60 * 60 * 1000,
          ),
        },
      });

      return updatedUser;
    });

    // TODO: Send WhatsApp approval notification (Phase 5)

    return NextResponse.json({
      id: result.id,
      rwaid,
      proRata,
      message: "Resident approved successfully",
    });
  } catch (err) {
    console.error("Approval error:", err);
    return internalError("Failed to approve resident");
  }
}
