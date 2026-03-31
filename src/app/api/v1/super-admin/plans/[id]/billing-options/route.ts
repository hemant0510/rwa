import { NextRequest } from "next/server";

import { internalError, notFoundError, parseBody, successResponse } from "@/lib/api-helpers";
import { logAudit } from "@/lib/audit";
import { requireSuperAdmin } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import { createBillingOptionSchema } from "@/lib/validations/plan";

type Params = { params: Promise<{ id: string }> };

// POST /api/v1/super-admin/plans/[id]/billing-options
export async function POST(request: NextRequest, { params }: Params) {
  const auth = await requireSuperAdmin();
  if (auth.error) return auth.error;

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

    void logAudit({
      actionType: "SA_BILLING_OPTION_CREATED",
      userId: auth.data.superAdminId,
      entityType: "PlanBillingOption",
      entityId: option.id,
      newValue: { planId: id, billingCycle: data.billingCycle, price: data.price },
    });

    return successResponse({ ...option, price: Number(option.price) }, 201);
  } catch {
    return internalError("Failed to add billing option");
  }
}
