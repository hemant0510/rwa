// Server-side fetcher for public plans.
// Falls back to direct Prisma in Server Components to avoid an internal HTTP hop.

import { prisma } from "@/lib/prisma";
import type { PublicPlan } from "@/types/public-plan";

export async function getPublicPlans(): Promise<PublicPlan[]> {
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

    return plans.map((p) => ({
      id: p.id,
      slug: p.slug,
      name: p.name,
      description: p.description,
      planType: p.planType,
      residentLimit: p.residentLimit,
      pricePerUnit: p.pricePerUnit ? Number(p.pricePerUnit) : null,
      featuresJson: (p.featuresJson ?? {}) as Record<string, boolean>,
      badgeText: p.badgeText,
      displayOrder: p.displayOrder,
      billingOptions: p.billingOptions.map((o) => ({
        id: o.id,
        billingCycle: o.billingCycle,
        price: Number(o.price),
      })),
    }));
  } catch {
    return [];
  }
}
