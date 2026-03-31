import { NextRequest } from "next/server";

import { z } from "zod";

import { internalError, notFoundError, parseBody, successResponse } from "@/lib/api-helpers";
import { requireSuperAdmin } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";

type Params = { params: Promise<{ id: string; bid: string }> };

const updateBillingOptionSchema = z.object({
  price: z.number().positive("Price must be greater than 0"),
  isActive: z.boolean().optional(),
});

// PATCH /api/v1/super-admin/plans/[id]/billing-options/[bid]
export async function PATCH(request: NextRequest, { params }: Params) {
  const auth = await requireSuperAdmin();
  if (auth.error) return auth.error;

  try {
    const { id, bid } = await params;
    const { data, error } = await parseBody(request, updateBillingOptionSchema);
    if (error) return error;
    if (!data) return internalError();

    const option = await prisma.planBillingOption.findUnique({
      where: { id: bid },
    });
    if (!option || option.planId !== id) return notFoundError("Billing option not found");

    const updated = await prisma.planBillingOption.update({
      where: { id: bid },
      data: {
        price: data.price,
        ...(data.isActive !== undefined && { isActive: data.isActive }),
      },
    });

    return successResponse({ ...updated, price: Number(updated.price) });
  } catch {
    return internalError("Failed to update billing option");
  }
}
