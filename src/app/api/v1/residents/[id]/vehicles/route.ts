import { NextResponse } from "next/server";

import { forbiddenError, internalError, notFoundError } from "@/lib/api-helpers";
import { getFullAccessAdmin } from "@/lib/get-current-user";
import { prisma } from "@/lib/prisma";
import { createAdminClient } from "@/lib/supabase/admin";
import { getExpiryStatus } from "@/lib/utils/vehicle-utils";

const VEHICLE_DOCS_BUCKET = "vehicle-docs";
const SIGNED_URL_TTL = 60 * 60; // 1 hour

async function generateSignedUrl(path: string | null): Promise<string | null> {
  if (!path) return null;
  const supabaseAdmin = createAdminClient();
  const { data, error } = await supabaseAdmin.storage
    .from(VEHICLE_DOCS_BUCKET)
    .createSignedUrl(path, SIGNED_URL_TTL);
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}

/** GET /api/v1/residents/[id]/vehicles — admin-only, returns all vehicles for resident's units */
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const admin = await getFullAccessAdmin();
    if (!admin) return forbiddenError("Admin access required");

    const { id } = await context.params;

    const resident = await prisma.user.findUnique({
      where: { id },
      select: { id: true, societyId: true, role: true },
    });
    if (!resident || resident.role !== "RESIDENT") return notFoundError("Resident not found");
    if (resident.societyId !== admin.societyId)
      return forbiddenError("Access denied to this resident");

    // All units linked to this resident
    const userUnits = await prisma.userUnit.findMany({
      where: { userId: id },
      select: { unitId: true },
    });
    const unitIds = userUnits.map((u) => u.unitId);

    const vehicles = await prisma.vehicle.findMany({
      where: { unitId: { in: unitIds } },
      include: {
        owner: { select: { id: true, name: true } },
        dependentOwner: { select: { id: true, name: true } },
        unit: { select: { displayLabel: true } },
      },
      orderBy: [{ isActive: "desc" }, { createdAt: "asc" }],
    });

    const formatted = await Promise.all(
      vehicles.map(async (v) => ({
        id: v.id,
        unitId: v.unitId,
        unit: v.unit,
        societyId: v.societyId,
        vehicleType: v.vehicleType,
        registrationNumber: v.registrationNumber,
        make: v.make,
        model: v.model,
        colour: v.colour,
        parkingSlot: v.parkingSlot,
        stickerNumber: v.stickerNumber,
        evSlot: v.evSlot,
        validFrom: v.validFrom?.toISOString().split("T")[0] ?? null,
        validTo: v.validTo?.toISOString().split("T")[0] ?? null,
        fastagId: v.fastagId,
        notes: v.notes,
        ownerId: v.ownerId,
        owner: v.owner,
        dependentOwnerId: v.dependentOwnerId,
        dependentOwner: v.dependentOwner,
        vehiclePhotoUrl: v.vehiclePhotoUrl,
        rcDocUrl: null, // raw path never exposed
        rcDocSignedUrl: await generateSignedUrl(v.rcDocUrl),
        rcExpiry: v.rcExpiry?.toISOString().split("T")[0] ?? null,
        rcStatus: getExpiryStatus(v.rcExpiry),
        insuranceUrl: null,
        insuranceSignedUrl: await generateSignedUrl(v.insuranceUrl),
        insuranceExpiry: v.insuranceExpiry?.toISOString().split("T")[0] ?? null,
        insuranceStatus: getExpiryStatus(v.insuranceExpiry),
        pucExpiry: v.pucExpiry?.toISOString().split("T")[0] ?? null,
        pucStatus: getExpiryStatus(v.pucExpiry),
        isActive: v.isActive,
        createdAt: v.createdAt.toISOString(),
        updatedAt: v.updatedAt.toISOString(),
      })),
    );

    return NextResponse.json({ vehicles: formatted });
  } catch (err) {
    console.error("Admin vehicles GET error:", err);
    return internalError("Failed to fetch vehicles");
  }
}
