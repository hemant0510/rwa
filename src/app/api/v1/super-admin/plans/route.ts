import { NextRequest } from "next/server";

import { internalError, notFoundError, parseBody, successResponse } from "@/lib/api-helpers";
import { requireSuperAdmin } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import { createPlanSchema } from "@/lib/validations/plan";

// GET /api/v1/super-admin/plans
// Returns all plans with billing options and subscriber counts
export async function GET() {
  const auth = await requireSuperAdmin();
  if (auth.error) return auth.error;

  try {
    const plans = await prisma.platformPlan.findMany({
      orderBy: { displayOrder: "asc" },
      include: {
        billingOptions: {
          where: { isActive: true },
          orderBy: { billingCycle: "asc" },
        },
        _count: {
          select: {
            subscriptions: {
              where: { status: { in: ["TRIAL", "ACTIVE"] } },
            },
          },
        },
      },
    });

    const serialized = plans.map((p) => ({
      ...p,
      pricePerUnit: p.pricePerUnit ? Number(p.pricePerUnit) : null,
      billingOptions: p.billingOptions.map((o) => ({
        ...o,
        price: Number(o.price),
      })),
      activeSubscribers: p._count.subscriptions,
    }));

    return successResponse(serialized);
  } catch {
    return internalError("Failed to fetch plans");
  }
}

// POST /api/v1/super-admin/plans
// Create a new plan with billing options
export async function POST(request: NextRequest) {
  const auth = await requireSuperAdmin();
  if (auth.error) return auth.error;

  try {
    const { data, error } = await parseBody(request, createPlanSchema);
    if (error) return error;
    if (!data) return internalError();

    // Check slug uniqueness
    const existing = await prisma.platformPlan.findUnique({
      where: { slug: data.slug },
    });
    if (existing) {
      return notFoundError("A plan with this slug already exists");
    }

    const { billingOptions, ...planData } = data;

    const plan = await prisma.platformPlan.create({
      data: {
        ...planData,
        featuresJson: planData.featuresJson,
        billingOptions: {
          create: billingOptions.map((o) => ({
            billingCycle: o.billingCycle,
            price: o.price,
            isActive: o.isActive ?? true,
          })),
        },
      },
      include: {
        billingOptions: true,
      },
    });

    const serialized = {
      ...plan,
      pricePerUnit: plan.pricePerUnit ? Number(plan.pricePerUnit) : null,
      billingOptions: plan.billingOptions.map((o) => ({
        ...o,
        price: Number(o.price),
      })),
    };

    return successResponse(serialized, 201);
  } catch {
    return internalError("Failed to create plan");
  }
}
