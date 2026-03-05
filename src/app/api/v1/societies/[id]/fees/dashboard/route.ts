import { NextRequest, NextResponse } from "next/server";

import { internalError } from "@/lib/api-helpers";
import { getSessionYear } from "@/lib/fee-calculator";
import { prisma } from "@/lib/prisma";

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id: societyId } = await params;
    const session = new URL(request.url).searchParams.get("session") || getSessionYear(new Date());

    const fees = await prisma.membershipFee.findMany({
      where: { societyId, sessionYear: session },
      include: {
        user: { select: { id: true, name: true, mobile: true, rwaid: true, ownershipType: true } },
        unit: { select: { displayLabel: true } },
        feePayments: { where: { isReversal: false, isReversed: false } },
      },
    });

    const statusCounts: Record<string, number> = {};
    let totalDue = 0;
    let totalCollected = 0;

    for (const fee of fees) {
      statusCounts[fee.status] = (statusCounts[fee.status] || 0) + 1;
      totalDue += Number(fee.amountDue);
      totalCollected += Number(fee.amountPaid);
    }

    const stats = Object.entries(statusCounts).map(([status, count]) => ({
      status,
      _count: count,
    }));

    return NextResponse.json({
      sessionYear: session,
      totalResidents: fees.length,
      stats,
      totalDue,
      totalCollected,
      totalOutstanding: totalDue - totalCollected,
      collectionRate: fees.length > 0 ? Math.round((totalCollected / totalDue) * 100) : 0,
      fees: fees.map((f) => ({
        id: f.id,
        userId: f.userId,
        user: {
          name: f.user.name,
          mobile: f.user.mobile,
          rwaid: f.user.rwaid,
        },
        ownershipType: f.user.ownershipType,
        unit: f.unit?.displayLabel || "—",
        amountDue: Number(f.amountDue),
        amountPaid: Number(f.amountPaid),
        balance: Number(f.amountDue) - Number(f.amountPaid),
        status: f.status,
        payments: f.feePayments,
      })),
    });
  } catch {
    return internalError("Failed to fetch fee dashboard");
  }
}
