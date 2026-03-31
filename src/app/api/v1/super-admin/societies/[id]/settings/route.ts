import { type NextRequest, NextResponse } from "next/server";

import { internalError, notFoundError, successResponse } from "@/lib/api-helpers";
import { requireSuperAdmin } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireSuperAdmin();
  if (auth.error) return auth.error as NextResponse;

  try {
    const { id: societyId } = await params;

    const [society, feeSessions, subscription] = await Promise.all([
      prisma.society.findUnique({
        where: { id: societyId },
        select: {
          id: true,
          name: true,
          societyCode: true,
          type: true,
          state: true,
          city: true,
          pincode: true,
          emailVerificationRequired: true,
          joiningFee: true,
          annualFee: true,
          gracePeriodDays: true,
          feeSessionStartMonth: true,
        },
      }),
      prisma.feeSession.findMany({
        where: { societyId },
        orderBy: { sessionYear: "desc" },
      }),
      prisma.societySubscription.findFirst({
        where: { societyId },
        orderBy: { createdAt: "desc" },
        include: { plan: true },
      }),
    ]);

    if (!society) return notFoundError("Society not found");

    return successResponse({
      society: {
        ...society,
        joiningFee: Number(society.joiningFee),
        annualFee: Number(society.annualFee),
      },
      feeSessions: feeSessions.map((s) => ({
        id: s.id,
        sessionYear: s.sessionYear,
        annualFee: Number(s.annualFee),
        joiningFee: Number(s.joiningFee),
        sessionStart: s.sessionStart,
        sessionEnd: s.sessionEnd,
        gracePeriodEnd: s.gracePeriodEnd,
        status: s.status,
      })),
      subscription: subscription
        ? {
            id: subscription.id,
            status: subscription.status,
            currentPeriodEnd: subscription.currentPeriodEnd,
            plan: subscription.plan,
          }
        : null,
    });
  } catch (err) {
    console.error("[SA Settings]", err);
    return internalError();
  }
}
