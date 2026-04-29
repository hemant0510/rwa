// Anonymous by design — serves the public pricing page.
// No auth, no tenant scoping required. Cached at the edge for 5 minutes.
// See: execution_plan/plans/pre-auth-experience.md §2.1

import type { NextResponse } from "next/server";

import { internalError, successResponse } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";

const CACHE_HEADERS = {
  "Cache-Control": "public, s-maxage=300, stale-while-revalidate=86400",
};

export async function GET(): Promise<NextResponse> {
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
      slug: p.slug,
      name: p.name,
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

    const response = successResponse({ plans: serialized });
    Object.entries(CACHE_HEADERS).forEach(([k, v]) => response.headers.set(k, v));
    return response;
  } catch {
    return internalError("Failed to fetch plans");
  }
}
