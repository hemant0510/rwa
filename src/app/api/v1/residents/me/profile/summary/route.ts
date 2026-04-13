import { NextResponse } from "next/server";

import { getActiveSocietyId } from "@/lib/active-society-server";
import { internalError, unauthorizedError } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { getExpiryStatus } from "@/lib/utils/vehicle-utils";

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
    select: {
      id: true,
      showInDirectory: true,
      showPhoneInDirectory: true,
    },
  });
}

/** GET /api/v1/residents/me/profile/summary — aggregate stats for the profile hub */
export async function GET() {
  try {
    const resident = await getResidentUser();
    if (!resident) return unauthorizedError();

    const [familyCount, vehicleCount, emergencyDependents, vehicles] = await Promise.all([
      prisma.dependent.count({
        where: { userId: resident.id, isActive: true },
      }),
      prisma.vehicle.count({
        where: { ownerId: resident.id, isActive: true },
      }),
      prisma.dependent.findMany({
        where: { userId: resident.id, isActive: true, isEmergencyContact: true },
        orderBy: [{ emergencyPriority: "asc" }, { memberSeq: "asc" }],
        select: {
          name: true,
          relationship: true,
          mobile: true,
          bloodGroup: true,
        },
      }),
      prisma.vehicle.findMany({
        where: { ownerId: resident.id, isActive: true },
        select: {
          id: true,
          registrationNumber: true,
          rcExpiry: true,
          insuranceExpiry: true,
          pucExpiry: true,
        },
      }),
    ]);

    const vehicleExpiryAlerts = vehicles
      .map((v) => ({
        id: v.id,
        registrationNumber: v.registrationNumber,
        rcStatus: getExpiryStatus(v.rcExpiry),
        insuranceStatus: getExpiryStatus(v.insuranceExpiry),
        pucStatus: getExpiryStatus(v.pucExpiry),
      }))
      .filter(
        (v) =>
          v.rcStatus === "EXPIRED" ||
          v.rcStatus === "EXPIRING_SOON" ||
          v.insuranceStatus === "EXPIRED" ||
          v.insuranceStatus === "EXPIRING_SOON" ||
          v.pucStatus === "EXPIRED" ||
          v.pucStatus === "EXPIRING_SOON",
      );

    return NextResponse.json({
      familyCount,
      vehicleCount,
      firstVehicleReg: vehicles[0]?.registrationNumber ?? null,
      emergencyContacts: emergencyDependents,
      vehicleExpiryAlerts,
      directoryOptIn: resident.showInDirectory,
      showPhoneInDirectory: resident.showPhoneInDirectory,
    });
  } catch (err) {
    console.error("Profile summary error:", err);
    return internalError("Failed to fetch profile summary");
  }
}
