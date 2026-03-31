import { NextRequest } from "next/server";

import { internalError, notFoundError, parseBody, successResponse } from "@/lib/api-helpers";
import { requireSuperAdmin } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import { updatePlanSchema } from "@/lib/validations/plan";

type Params = { params: Promise<{ id: string }> };

// GET /api/v1/super-admin/plans/[id]
export async function GET(_req: NextRequest, { params }: Params) {
  const auth = await requireSuperAdmin();
  if (auth.error) return auth.error;

  try {
    const { id } = await params;
    const plan = await prisma.platformPlan.findUnique({
      where: { id },
      include: {
        billingOptions: { orderBy: { billingCycle: "asc" } },
        _count: {
          select: {
            subscriptions: { where: { status: { in: ["TRIAL", "ACTIVE"] } } },
          },
        },
      },
    });

    if (!plan) return notFoundError("Plan not found");

    return successResponse({
      ...plan,
      pricePerUnit: plan.pricePerUnit ? Number(plan.pricePerUnit) : null,
      billingOptions: plan.billingOptions.map((o) => ({ ...o, price: Number(o.price) })),
      activeSubscribers: plan._count.subscriptions,
    });
  } catch {
    return internalError("Failed to fetch plan");
  }
}

// PATCH /api/v1/super-admin/plans/[id]
export async function PATCH(request: NextRequest, { params }: Params) {
  const auth = await requireSuperAdmin();
  if (auth.error) return auth.error;

  try {
    const { id } = await params;
    const { data, error } = await parseBody(request, updatePlanSchema);
    if (error) return error;
    if (!data) return internalError();

    const existing = await prisma.platformPlan.findUnique({ where: { id } });
    if (!existing) return notFoundError("Plan not found");

    const plan = await prisma.platformPlan.update({
      where: { id },
      data: {
        ...data,
        featuresJson: data.featuresJson ?? undefined,
      },
      include: {
        billingOptions: { orderBy: { billingCycle: "asc" } },
      },
    });

    return successResponse({
      ...plan,
      pricePerUnit: plan.pricePerUnit ? Number(plan.pricePerUnit) : null,
      billingOptions: plan.billingOptions.map((o) => ({ ...o, price: Number(o.price) })),
    });
  } catch {
    return internalError("Failed to update plan");
  }
}

// DELETE /api/v1/super-admin/plans/[id]
// Soft delete — sets isActive = false. Blocks if there are active subscribers.
export async function DELETE(_req: NextRequest, { params }: Params) {
  const auth = await requireSuperAdmin();
  if (auth.error) return auth.error;

  try {
    const { id } = await params;

    const plan = await prisma.platformPlan.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            subscriptions: { where: { status: { in: ["TRIAL", "ACTIVE"] } } },
          },
        },
      },
    });

    if (!plan) return notFoundError("Plan not found");

    if (plan._count.subscriptions > 0) {
      return internalError(
        `Cannot archive plan with ${plan._count.subscriptions} active subscriber(s). Migrate them first.`,
      );
    }

    await prisma.platformPlan.update({
      where: { id },
      data: { isActive: false, isPublic: false },
    });

    return successResponse({ success: true });
  } catch {
    return internalError("Failed to archive plan");
  }
}
