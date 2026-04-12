import { NextRequest, NextResponse } from "next/server";

import { getActiveSocietyId } from "@/lib/active-society-server";
import { internalError, unauthorizedError } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { normalizeRegNumber } from "@/lib/utils/vehicle-utils";

async function getResidentUser() {
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();
  if (!authUser) return null;

  const activeSocietyId = await getActiveSocietyId();
  const where: Record<string, unknown> = { authUserId: authUser.id, role: "RESIDENT" };
  if (activeSocietyId) where.societyId = activeSocietyId;

  return prisma.user.findFirst({
    where,
    select: { id: true, societyId: true },
  });
}

/** GET /api/v1/residents/me/vehicles/search?q=... — search vehicles by reg, make, or colour */
export async function GET(request: NextRequest) {
  try {
    const resident = await getResidentUser();
    if (!resident) return unauthorizedError();

    // Check society setting — disabled → 403
    const society = await prisma.society.findUnique({
      where: { id: resident.societyId! },
      select: { allowResidentVehicleSearch: true },
    });
    if (society && !society.allowResidentVehicleSearch) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "Vehicle search is not enabled for your society" } },
        { status: 403 },
      );
    }

    const { searchParams } = new URL(request.url);
    // societyId ALWAYS from session — never from query params
    const q = normalizeRegNumber(searchParams.get("q") ?? "");

    if (q.length < 3) {
      return NextResponse.json(
        {
          error: { code: "QUERY_TOO_SHORT", message: "Search query must be at least 3 characters" },
        },
        { status: 400 },
      );
    }

    const vehicles = await prisma.vehicle.findMany({
      where: {
        societyId: resident.societyId!,
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
        owner: { select: { name: true } }, // NO mobile/email — privacy
        dependentOwner: { select: { name: true } },
      },
      take: 20,
    });

    return NextResponse.json({ vehicles });
  } catch (err) {
    console.error("Vehicle search error:", err);
    return internalError("Failed to search vehicles");
  }
}
