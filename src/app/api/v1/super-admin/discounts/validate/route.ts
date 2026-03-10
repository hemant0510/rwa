import { NextRequest } from "next/server";

import { internalError, notFoundError, parseBody, successResponse } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";
import { validateCouponSchema } from "@/lib/validations/discount";

// POST /api/v1/super-admin/discounts/validate
// Validates a coupon code against a specific plan + billing cycle
export async function POST(request: NextRequest) {
  try {
    const { data, error } = await parseBody(request, validateCouponSchema);
    if (error) return error;
    if (!data) return internalError();

    const now = new Date();

    const discount = await prisma.planDiscount.findFirst({
      where: {
        couponCode: data.couponCode.toUpperCase(),
        isActive: true,
        triggerType: "COUPON_CODE",
        OR: [{ startsAt: null }, { startsAt: { lte: now } }],
        AND: [{ OR: [{ endsAt: null }, { endsAt: { gte: now } }] }],
      },
    });

    if (!discount) {
      return notFoundError("Invalid or expired coupon code");
    }

    // Check usage limit
    if (discount.maxUsageCount !== null && discount.usageCount >= discount.maxUsageCount) {
      return notFoundError("This coupon code has reached its usage limit");
    }

    // Check plan scope
    if (!discount.appliesToAll && !discount.applicablePlanIds.includes(data.planId)) {
      return notFoundError("This coupon code is not valid for the selected plan");
    }

    // Check billing cycle restriction
    if (discount.allowedCycles.length > 0 && !discount.allowedCycles.includes(data.billingCycle)) {
      return notFoundError(
        `This coupon code is only valid for: ${discount.allowedCycles.join(", ")} billing`,
      );
    }

    return successResponse({
      valid: true,
      discountId: discount.id,
      name: discount.name,
      discountType: discount.discountType,
      discountValue: Number(discount.discountValue),
    });
  } catch {
    return internalError("Failed to validate coupon");
  }
}
