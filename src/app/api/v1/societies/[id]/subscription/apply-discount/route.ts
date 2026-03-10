import { NextRequest } from "next/server";

import { internalError, notFoundError, parseBody, successResponse } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";
import { applyDiscountSchema } from "@/lib/validations/subscription";

type Params = { params: Promise<{ id: string }> };

// POST /api/v1/societies/[id]/subscription/apply-discount
// Super Admin manually applies a discount to a society's active subscription
export async function POST(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const { data, error } = await parseBody(request, applyDiscountSchema);
    if (error) return error;
    if (!data) return internalError();

    const sub = await prisma.societySubscription.findFirst({
      where: { societyId: id, status: { in: ["TRIAL", "ACTIVE"] } },
      include: { billingOption: true },
      orderBy: { createdAt: "desc" },
    });

    if (!sub) return notFoundError("No active subscription found");

    let finalPrice = sub.billingOption ? Number(sub.billingOption.price) : null;

    if (finalPrice !== null) {
      if (data.discountId) {
        const discount = await prisma.planDiscount.findUnique({ where: { id: data.discountId } });
        if (discount) {
          if (discount.discountType === "PERCENTAGE") {
            finalPrice = finalPrice * (1 - Number(discount.discountValue) / 100);
          } else {
            finalPrice = Math.max(0, finalPrice - Number(discount.discountValue));
          }
        }
      } else if (data.customDiscountPct) {
        finalPrice = finalPrice * (1 - data.customDiscountPct / 100);
      } else {
        finalPrice = sub.billingOption ? Number(sub.billingOption.price) : null;
      }
    }

    const updated = await prisma.societySubscription.update({
      where: { id: sub.id },
      data: {
        discountId: data.discountId ?? null,
        customDiscountPct: data.customDiscountPct ?? null,
        finalPrice: finalPrice !== null ? Math.round(finalPrice * 100) / 100 : null,
        notes: data.notes ?? sub.notes,
      },
    });

    // Log history
    await prisma.societySubscriptionHistory.create({
      data: {
        subscriptionId: sub.id,
        societyId: id,
        changeType: "DISCOUNT_APPLIED",
        performedBy: "SA",
        notes: data.notes ?? `Discount applied manually`,
      },
    });

    return successResponse({
      ...updated,
      finalPrice: updated.finalPrice ? Number(updated.finalPrice) : null,
      customDiscountPct: updated.customDiscountPct ? Number(updated.customDiscountPct) : null,
    });
  } catch {
    return internalError("Failed to apply discount");
  }
}
