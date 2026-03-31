import { NextRequest } from "next/server";

import { internalError, parseBody, successResponse } from "@/lib/api-helpers";
import { requireSuperAdmin } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import { createDiscountSchema } from "@/lib/validations/discount";

// GET /api/v1/super-admin/discounts
export async function GET() {
  const auth = await requireSuperAdmin();
  if (auth.error) return auth.error;

  try {
    const discounts = await prisma.planDiscount.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        _count: { select: { subscriptions: true } },
      },
    });

    return successResponse(
      discounts.map((d) => ({
        ...d,
        discountValue: Number(d.discountValue),
        usedCount: d._count.subscriptions,
      })),
    );
  } catch {
    return internalError("Failed to fetch discounts");
  }
}

// POST /api/v1/super-admin/discounts
export async function POST(request: NextRequest) {
  const auth = await requireSuperAdmin();
  if (auth.error) return auth.error;

  try {
    const { data, error } = await parseBody(request, createDiscountSchema);
    if (error) return error;
    if (!data) return internalError();

    // Check coupon code uniqueness
    if (data.couponCode) {
      const existing = await prisma.planDiscount.findFirst({
        where: { couponCode: data.couponCode },
      });
      if (existing) {
        return internalError(`Coupon code "${data.couponCode}" is already in use`);
      }
    }

    const discount = await prisma.planDiscount.create({
      data: {
        name: data.name,
        description: data.description,
        discountType: data.discountType,
        discountValue: data.discountValue,
        appliesToAll: data.appliesToAll,
        applicablePlanIds: data.applicablePlanIds,
        triggerType: data.triggerType,
        couponCode: data.couponCode ?? null,
        startsAt: data.startsAt ? new Date(data.startsAt) : null,
        endsAt: data.endsAt ? new Date(data.endsAt) : null,
        maxUsageCount: data.maxUsageCount ?? null,
        allowedCycles: data.allowedCycles,
      },
    });

    return successResponse({ ...discount, discountValue: Number(discount.discountValue) }, 201);
  } catch {
    return internalError("Failed to create discount");
  }
}
