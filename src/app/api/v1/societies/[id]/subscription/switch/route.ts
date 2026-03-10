import { NextRequest } from "next/server";

import { internalError, notFoundError, parseBody, successResponse } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";
import { calculateProRata } from "@/lib/utils/pro-rata";
import { switchPlanSchema } from "@/lib/validations/subscription";

type Params = { params: Promise<{ id: string }> };

// PATCH /api/v1/societies/[id]/subscription/switch
// Immediate plan switch with pro-rata calculation
export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const { data, error } = await parseBody(request, switchPlanSchema);
    if (error) return error;
    if (!data) return internalError();

    const currentSub = await prisma.societySubscription.findFirst({
      where: { societyId: id, status: { in: ["TRIAL", "ACTIVE"] } },
      include: { billingOption: true },
      orderBy: { createdAt: "desc" },
    });

    if (!currentSub) return notFoundError("No active subscription to switch from");

    const newBillingOption = await prisma.planBillingOption.findUnique({
      where: { id: data.billingOptionId },
      include: { plan: true },
    });
    if (!newBillingOption) return notFoundError("Billing option not found");
    if (newBillingOption.planId !== data.planId) {
      return notFoundError("Billing option does not belong to the specified plan");
    }

    const now = new Date();

    // Calculate pro-rata if there's an active period
    let proRata = null;
    if (currentSub.currentPeriodStart && currentSub.currentPeriodEnd && currentSub.billingOption) {
      const oldPrice = Number(currentSub.billingOption.price);
      const newPrice = Number(newBillingOption.price);
      proRata = calculateProRata(
        oldPrice,
        newPrice,
        currentSub.currentPeriodStart,
        currentSub.currentPeriodEnd,
        now,
      );
    }

    // Determine upgrade vs downgrade
    const oldPlanOrder = currentSub.billingOption?.price ?? 0;
    const newPlanOrder = Number(newBillingOption.price);
    const changeType = newPlanOrder >= Number(oldPlanOrder) ? "PLAN_UPGRADED" : "PLAN_DOWNGRADED";

    // Calculate new period end
    const newPeriodEnd = new Date(now);
    switch (newBillingOption.billingCycle) {
      case "MONTHLY":
        newPeriodEnd.setMonth(newPeriodEnd.getMonth() + 1);
        break;
      case "ANNUAL":
        newPeriodEnd.setFullYear(newPeriodEnd.getFullYear() + 1);
        break;
      case "TWO_YEAR":
        newPeriodEnd.setFullYear(newPeriodEnd.getFullYear() + 2);
        break;
      case "THREE_YEAR":
        newPeriodEnd.setFullYear(newPeriodEnd.getFullYear() + 3);
        break;
    }

    // Expire current subscription
    await prisma.societySubscription.update({
      where: { id: currentSub.id },
      data: { status: "EXPIRED" },
    });

    // Create new subscription
    const newSub = await prisma.societySubscription.create({
      data: {
        societyId: id,
        planId: data.planId,
        billingOptionId: data.billingOptionId,
        status: "ACTIVE",
        currentPeriodStart: now,
        currentPeriodEnd: newPeriodEnd,
        discountId: currentSub.discountId, // carry over discount
        finalPrice: Number(newBillingOption.price),
        notes: data.notes,
      },
    });

    // Update cached plan on Society
    await prisma.society.update({
      where: { id },
      data: { subscriptionExpiresAt: newPeriodEnd },
    });

    // Log history
    await prisma.societySubscriptionHistory.create({
      data: {
        subscriptionId: newSub.id,
        societyId: id,
        changeType: changeType as never,
        fromPlanId: currentSub.planId,
        toPlanId: data.planId,
        fromBillingOptionId: currentSub.billingOptionId,
        toBillingOptionId: data.billingOptionId,
        prorataCredit: proRata?.credit ?? null,
        prorataCharge: proRata?.charge ?? null,
        netAmount: proRata?.netAmount ?? null,
        performedBy: "SA",
        notes: data.notes,
      },
    });

    return successResponse({
      subscription: {
        ...newSub,
        finalPrice: newSub.finalPrice ? Number(newSub.finalPrice) : null,
      },
      proRata,
    });
  } catch {
    return internalError("Failed to switch plan");
  }
}
