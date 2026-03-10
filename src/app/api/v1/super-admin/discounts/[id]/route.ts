import { NextRequest } from "next/server";

import { internalError, notFoundError, parseBody, successResponse } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";
import { updateDiscountSchema } from "@/lib/validations/discount";

type Params = { params: Promise<{ id: string }> };

// PATCH /api/v1/super-admin/discounts/[id]
export async function PATCH(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const { data, error } = await parseBody(request, updateDiscountSchema);
    if (error) return error;
    if (!data) return internalError();

    const existing = await prisma.planDiscount.findUnique({ where: { id } });
    if (!existing) return notFoundError("Discount not found");

    const discount = await prisma.planDiscount.update({
      where: { id },
      data: {
        ...data,
        startsAt: data.startsAt ? new Date(data.startsAt) : data.startsAt,
        endsAt: data.endsAt ? new Date(data.endsAt) : data.endsAt,
        couponCode: data.couponCode ?? undefined,
        discountValue: data.discountValue,
      },
    });

    return successResponse({ ...discount, discountValue: Number(discount.discountValue) });
  } catch {
    return internalError("Failed to update discount");
  }
}

// DELETE /api/v1/super-admin/discounts/[id] — soft delete (deactivate)
export async function DELETE(_req: NextRequest, { params }: Params) {
  try {
    const { id } = await params;

    const existing = await prisma.planDiscount.findUnique({ where: { id } });
    if (!existing) return notFoundError("Discount not found");

    await prisma.planDiscount.update({ where: { id }, data: { isActive: false } });
    return successResponse({ success: true });
  } catch {
    return internalError("Failed to deactivate discount");
  }
}
