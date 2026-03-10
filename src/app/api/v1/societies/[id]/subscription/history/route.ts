import { NextRequest } from "next/server";

import { internalError, successResponse } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ id: string }> };

// GET /api/v1/societies/[id]/subscription/history
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;

    const history = await prisma.societySubscriptionHistory.findMany({
      where: { societyId: id },
      orderBy: { createdAt: "desc" },
      take: 50,
      include: {
        fromPlan: { select: { name: true } },
        toPlan: { select: { name: true } },
        fromBillingOption: { select: { billingCycle: true, price: true } },
        toBillingOption: { select: { billingCycle: true, price: true } },
      },
    });

    return successResponse(
      history.map((h) => ({
        ...h,
        prorataCredit: h.prorataCredit ? Number(h.prorataCredit) : null,
        prorataCharge: h.prorataCharge ? Number(h.prorataCharge) : null,
        netAmount: h.netAmount ? Number(h.netAmount) : null,
        fromBillingOption: h.fromBillingOption
          ? { ...h.fromBillingOption, price: Number(h.fromBillingOption.price) }
          : null,
        toBillingOption: h.toBillingOption
          ? { ...h.toBillingOption, price: Number(h.toBillingOption.price) }
          : null,
      })),
    );
  } catch {
    return internalError("Failed to fetch subscription history");
  }
}
