import { internalError, successResponse } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";

// GET /api/v1/auth/plans — public endpoint (no auth required)
// Returns active, publicly visible plans with their billing options for the registration flow
export async function GET() {
  try {
    const plans = await prisma.platformPlan.findMany({
      where: { isActive: true, isPublic: true },
      orderBy: { displayOrder: "asc" },
      include: {
        billingOptions: {
          where: { isActive: true },
          orderBy: { billingCycle: "asc" },
        },
      },
    });

    const serialized = plans.map((p) => ({
      id: p.id,
      name: p.name,
      slug: p.slug,
      description: p.description,
      planType: p.planType,
      residentLimit: p.residentLimit,
      pricePerUnit: p.pricePerUnit ? Number(p.pricePerUnit) : null,
      featuresJson: p.featuresJson,
      badgeText: p.badgeText,
      displayOrder: p.displayOrder,
      billingOptions: p.billingOptions.map((o) => ({
        id: o.id,
        billingCycle: o.billingCycle,
        price: Number(o.price),
      })),
    }));

    return successResponse(serialized);
  } catch {
    return internalError("Failed to fetch plans");
  }
}
