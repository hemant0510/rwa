import { NextResponse } from "next/server";

import { internalError, successResponse } from "@/lib/api-helpers";
import { requireSuperAdmin } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";

/** GET /api/v1/super-admin/subscription-payment-claims/pending-count */
export async function GET() {
  const auth = await requireSuperAdmin();
  if (auth.error) return auth.error as NextResponse;

  try {
    const count = await prisma.subscriptionPaymentClaim.count({
      where: { status: "PENDING" },
    });

    return successResponse({ count });
  } catch (err) {
    console.error("[SA Sub Claims Pending Count]", err);
    return internalError();
  }
}
