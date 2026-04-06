import { NextRequest, NextResponse } from "next/server";

import { internalError, successResponse } from "@/lib/api-helpers";
import { requireSuperAdmin } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";

/** GET /api/v1/super-admin/subscription-payment-claims — list all claims (paginated, filterable) */
export async function GET(request: NextRequest) {
  const auth = await requireSuperAdmin();
  if (auth.error) return auth.error as NextResponse;

  try {
    const url = new URL(request.url);
    const status = url.searchParams.get("status");
    const page = Math.max(1, Number(url.searchParams.get("page") ?? 1));
    const pageSize = Math.min(100, Math.max(1, Number(url.searchParams.get("pageSize") ?? 20)));

    const where: Record<string, unknown> = {};
    if (status) where.status = status;

    const [claims, total] = await Promise.all([
      prisma.subscriptionPaymentClaim.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        include: {
          society: { select: { name: true, societyCode: true } },
          subscription: { select: { planId: true } },
        },
      }),
      prisma.subscriptionPaymentClaim.count({ where }),
    ]);

    return successResponse({ claims, total, page, pageSize });
  } catch (err) {
    console.error("[SA Sub Claims GET]", err);
    return internalError();
  }
}
