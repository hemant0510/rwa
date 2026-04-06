import { NextRequest } from "next/server";

import { successResponse, unauthorizedError } from "@/lib/api-helpers";
import { getFullAccessAdmin } from "@/lib/get-current-user";
import { prisma } from "@/lib/prisma";

type RouteParams = { params: Promise<{ id: string }> };

/** GET /api/v1/societies/[id]/payment-claims — list claims with optional ?status= ?page= ?pageSize= */
export async function GET(request: NextRequest, { params }: RouteParams) {
  const { id: societyId } = await params;

  const admin = await getFullAccessAdmin();
  if (!admin) return unauthorizedError("Admin authentication required");
  if (admin.societyId !== societyId) return unauthorizedError("Access denied");

  const { searchParams } = new URL(request.url);
  const status = searchParams.get("status") ?? undefined;
  const page = Math.max(1, Number(searchParams.get("page") ?? "1"));
  const pageSize = Math.min(100, Math.max(1, Number(searchParams.get("pageSize") ?? "20")));
  const skip = (page - 1) * pageSize;

  const where = {
    societyId,
    ...(status ? { status } : {}),
  };

  const [rawClaims, total] = await Promise.all([
    prisma.paymentClaim.findMany({
      where,
      skip,
      take: pageSize,
      orderBy: { createdAt: "desc" },
      include: {
        user: {
          select: {
            name: true,
            userUnits: { take: 1, include: { unit: { select: { displayLabel: true } } } },
          },
        },
      },
    }),
    prisma.paymentClaim.count({ where }),
  ]);

  const claims = rawClaims.map((c) => ({
    ...c,
    user: c.user
      ? { name: c.user.name, unitNumber: c.user.userUnits[0]?.unit?.displayLabel ?? "—" }
      : undefined,
  }));

  return successResponse({ claims, total, page, pageSize });
}
