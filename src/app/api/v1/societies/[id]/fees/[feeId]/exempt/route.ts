import { NextRequest, NextResponse } from "next/server";

import { parseBody, notFoundError, internalError } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";
import { grantExemptionSchema } from "@/lib/validations/fee";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; feeId: string }> },
) {
  try {
    const { id: societyId, feeId } = await params;
    const { data, error } = await parseBody(request, grantExemptionSchema);
    if (error) return error;
    if (!data) return internalError();

    const fee = await prisma.membershipFee.findUnique({ where: { id: feeId } });
    if (!fee || fee.societyId !== societyId) return notFoundError("Fee record not found");

    await prisma.$transaction(async (tx) => {
      await tx.membershipFee.update({
        where: { id: feeId },
        data: {
          status: "EXEMPTED",
          exemptionReason: data.reason,
          exemptedAt: new Date(),
        },
      });

      await tx.user.update({
        where: { id: fee.userId },
        data: { status: "ACTIVE_EXEMPTED" },
      });
    });

    return NextResponse.json({ message: "Exemption granted" });
  } catch {
    return internalError("Failed to grant exemption");
  }
}
