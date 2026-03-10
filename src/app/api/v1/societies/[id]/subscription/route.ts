import { NextRequest } from "next/server";

import { internalError, notFoundError, parseBody, successResponse } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";
import { assignPlanSchema } from "@/lib/validations/subscription";

type Params = { params: Promise<{ id: string }> };

function serializeSub(sub: Record<string, unknown>) {
  return {
    ...sub,
    finalPrice: sub.finalPrice != null ? Number(sub.finalPrice) : null,
    customDiscountPct: sub.customDiscountPct != null ? Number(sub.customDiscountPct) : null,
  };
}

// GET /api/v1/societies/[id]/subscription
export async function GET(_req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;

    const sub = await prisma.societySubscription.findFirst({
      where: { societyId: id, status: { in: ["TRIAL", "ACTIVE"] } },
      include: {
        plan: { include: { billingOptions: true } },
        billingOption: true,
        discount: true,
      },
      orderBy: { createdAt: "desc" },
    });

    if (!sub) return notFoundError("No active subscription found");

    return successResponse(serializeSub(sub as unknown as Record<string, unknown>));
  } catch {
    return internalError("Failed to fetch subscription");
  }
}

// POST /api/v1/societies/[id]/subscription
// Assign a plan to a society (used during SA onboarding and when converting from trial)
export async function POST(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const { data, error } = await parseBody(request, assignPlanSchema);
    if (error) return error;
    if (!data) return internalError();

    const society = await prisma.society.findUnique({ where: { id } });
    if (!society) return notFoundError("Society not found");

    const billingOption = await prisma.planBillingOption.findUnique({
      where: { id: data.billingOptionId },
      include: { plan: true },
    });
    if (!billingOption) return notFoundError("Billing option not found");
    if (billingOption.planId !== data.planId) {
      return notFoundError("Billing option does not belong to the specified plan");
    }

    // Calculate period dates based on billing cycle
    const now = new Date();
    const periodStart = now;
    const periodEnd = new Date(now);

    switch (billingOption.billingCycle) {
      case "MONTHLY":
        periodEnd.setMonth(periodEnd.getMonth() + 1);
        break;
      case "ANNUAL":
        periodEnd.setFullYear(periodEnd.getFullYear() + 1);
        break;
      case "TWO_YEAR":
        periodEnd.setFullYear(periodEnd.getFullYear() + 2);
        break;
      case "THREE_YEAR":
        periodEnd.setFullYear(periodEnd.getFullYear() + 3);
        break;
    }

    // Fetch discount if provided
    let finalPrice = Number(billingOption.price);
    if (data.discountId) {
      const discount = await prisma.planDiscount.findUnique({ where: { id: data.discountId } });
      if (discount) {
        if (discount.discountType === "PERCENTAGE") {
          finalPrice = finalPrice * (1 - Number(discount.discountValue) / 100);
        } else {
          finalPrice = Math.max(0, finalPrice - Number(discount.discountValue));
        }
        // Increment usage count
        await prisma.planDiscount.update({
          where: { id: data.discountId },
          data: { usageCount: { increment: 1 } },
        });
      }
    }

    // Expire any existing active subscription
    await prisma.societySubscription.updateMany({
      where: { societyId: id, status: { in: ["TRIAL", "ACTIVE"] } },
      data: { status: "EXPIRED" },
    });

    const sub = await prisma.societySubscription.create({
      data: {
        societyId: id,
        planId: data.planId,
        billingOptionId: data.billingOptionId,
        status: "ACTIVE",
        currentPeriodStart: periodStart,
        currentPeriodEnd: periodEnd,
        discountId: data.discountId ?? null,
        finalPrice: Math.round(finalPrice * 100) / 100,
        notes: data.notes,
      },
    });

    // Update cached plan on Society
    await prisma.society.update({
      where: { id },
      data: {
        plan: billingOption.plan.slug.toUpperCase().replace(/-/g, "_") as never,
        status: "ACTIVE",
        subscriptionExpiresAt: periodEnd,
      },
    });

    // Log history
    await prisma.societySubscriptionHistory.create({
      data: {
        subscriptionId: sub.id,
        societyId: id,
        changeType: "PLAN_SELECTED",
        toPlanId: data.planId,
        toBillingOptionId: data.billingOptionId,
        performedBy: "SA",
        notes: data.notes,
      },
    });

    return successResponse(serializeSub(sub as unknown as Record<string, unknown>), 201);
  } catch {
    return internalError("Failed to assign plan");
  }
}
