import { NextRequest } from "next/server";

import { internalError, notFoundError, parseBody, successResponse } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";
import { createBillingOptionSchema } from "@/lib/validations/plan";

type Params = { params: Promise<{ id: string }> };

// POST /api/v1/super-admin/plans/[id]/billing-options
export async function POST(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params;
    const { data, error } = await parseBody(request, createBillingOptionSchema);
    if (error) return error;
    if (!data) return internalError();

    const plan = await prisma.platformPlan.findUnique({ where: { id } });
    if (!plan) return notFoundError("Plan not found");

    // Check for duplicate cycle
    const existing = await prisma.planBillingOption.findUnique({
      where: { planId_billingCycle: { planId: id, billingCycle: data.billingCycle } },
    });
    if (existing) {
      return internalError(`A billing option for ${data.billingCycle} already exists on this plan`);
    }

    const option = await prisma.planBillingOption.create({
      data: { planId: id, billingCycle: data.billingCycle, price: data.price },
    });

    return successResponse({ ...option, price: Number(option.price) }, 201);
  } catch {
    return internalError("Failed to add billing option");
  }
}
