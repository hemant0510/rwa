import { type NextRequest, NextResponse } from "next/server";

import { internalError, successResponse } from "@/lib/api-helpers";
import { requireSuperAdmin } from "@/lib/auth-guard";
import { getSessionYear } from "@/lib/fee-calculator";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireSuperAdmin();
  if (auth.error) return auth.error as NextResponse;

  try {
    const { id: societyId } = await params;
    const session = new URL(req.url).searchParams.get("session") || getSessionYear(new Date());

    const [totals, statusBreakdown] = await Promise.all([
      prisma.membershipFee.aggregate({
        where: { societyId, sessionYear: session },
        _sum: { amountDue: true, amountPaid: true },
        _count: true,
      }),
      prisma.membershipFee.groupBy({
        by: ["status"],
        where: { societyId, sessionYear: session },
        _count: true,
        _sum: { amountDue: true, amountPaid: true },
      }),
    ]);

    const totalDue = Number(totals._sum.amountDue || 0);
    const totalCollected = Number(totals._sum.amountPaid || 0);
    const totalResidents = totals._count;

    return successResponse({
      sessionYear: session,
      totalResidents,
      totalDue,
      totalCollected,
      totalOutstanding: totalDue - totalCollected,
      collectionRate: totalDue > 0 ? Math.round((totalCollected / totalDue) * 100) : 0,
      statusBreakdown: statusBreakdown.map((s) => ({
        status: s.status,
        count: s._count,
        amountDue: Number(s._sum.amountDue || 0),
        amountPaid: Number(s._sum.amountPaid || 0),
      })),
    });
  } catch (err) {
    console.error("[SA Fees Summary]", err);
    return internalError();
  }
}
