import { type NextRequest, NextResponse } from "next/server";

import { forbiddenError, internalError } from "@/lib/api-helpers";
import { getCurrentUser } from "@/lib/get-current-user";
import { prisma } from "@/lib/prisma";
import { normalizeRegNumber } from "@/lib/utils/vehicle-utils";

const VALID_SORT = ["reg", "type", "unit"] as const;
type SortField = (typeof VALID_SORT)[number];

function buildOrderBy(sort: SortField) {
  if (sort === "reg") return { registrationNumber: "asc" as const };
  if (sort === "type") return { vehicleType: "asc" as const };
  return { unit: { displayLabel: "asc" as const } };
}

/** GET /api/v1/admin/vehicles/search?q=...&sort=reg|type|unit&page=1&limit=20 */
export async function GET(request: NextRequest) {
  try {
    const user = await getCurrentUser("RWA_ADMIN");
    if (!user) return forbiddenError("Admin access required");

    const { searchParams } = new URL(request.url);
    const q = normalizeRegNumber(searchParams.get("q") ?? "");

    if (q.length < 3) {
      return NextResponse.json(
        {
          error: { code: "QUERY_TOO_SHORT", message: "Search query must be at least 3 characters" },
        },
        { status: 400 },
      );
    }

    const sortParam = searchParams.get("sort") ?? "reg";
    const sort: SortField = (VALID_SORT as readonly string[]).includes(sortParam)
      ? (sortParam as SortField)
      : "reg";

    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") ?? "20", 10) || 20));
    const skip = (page - 1) * limit;

    const [vehicles, total] = await Promise.all([
      prisma.vehicle.findMany({
        where: {
          societyId: user.societyId,
          isActive: true,
          OR: [
            { registrationNumber: { contains: q, mode: "insensitive" } },
            { make: { contains: q, mode: "insensitive" } },
            { colour: { contains: q, mode: "insensitive" } },
          ],
        },
        select: {
          id: true,
          registrationNumber: true,
          vehicleType: true,
          make: true,
          model: true,
          colour: true,
          unit: { select: { displayLabel: true } },
          owner: { select: { name: true, mobile: true, email: true } },
          dependentOwner: { select: { name: true } },
        },
        orderBy: buildOrderBy(sort),
        skip,
        take: limit,
      }),
      prisma.vehicle.count({
        where: {
          societyId: user.societyId,
          isActive: true,
          OR: [
            { registrationNumber: { contains: q, mode: "insensitive" } },
            { make: { contains: q, mode: "insensitive" } },
            { colour: { contains: q, mode: "insensitive" } },
          ],
        },
      }),
    ]);

    return NextResponse.json({ vehicles, total, page, limit });
  } catch (err) {
    console.error("Admin vehicle search error:", err);
    return internalError("Failed to search vehicles");
  }
}
