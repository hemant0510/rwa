import { NextResponse } from "next/server";

import { getActiveSocietyId } from "@/lib/active-society-server";
import { internalError, unauthorizedError } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();

    if (!authUser) return unauthorizedError();

    const activeSocietyId = await getActiveSocietyId();

    const where: Record<string, unknown> = { authUserId: authUser.id, role: "RESIDENT" };
    if (activeSocietyId) where.societyId = activeSocietyId;

    const user = await prisma.user.findFirst({ where, select: { id: true } });
    if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });

    const fees = await prisma.membershipFee.findMany({
      where: { userId: user.id },
      orderBy: { sessionYear: "desc" },
      include: {
        feePayments: {
          where: { isReversal: false, isReversed: false },
          orderBy: { paymentDate: "asc" },
          select: {
            id: true,
            amount: true,
            paymentMode: true,
            referenceNo: true,
            receiptNo: true,
            receiptUrl: true,
            paymentDate: true,
          },
        },
      },
    });

    return NextResponse.json({
      fees: fees.map((f) => ({
        id: f.id,
        sessionYear: f.sessionYear,
        amountDue: Number(f.amountDue),
        amountPaid: Number(f.amountPaid),
        status: f.status,
        isProrata: f.isProrata,
        joiningFeeIncluded: f.joiningFeeIncluded,
        gracePeriodEnd: f.gracePeriodEnd,
        payments: f.feePayments.map((p) => ({
          id: p.id,
          amount: Number(p.amount),
          paymentMode: p.paymentMode,
          referenceNo: p.referenceNo,
          receiptNo: p.receiptNo,
          receiptUrl: p.receiptUrl,
          paymentDate: p.paymentDate,
        })),
      })),
    });
  } catch (err) {
    console.error("Resident fees error:", err);
    return internalError("Failed to fetch fee history");
  }
}
