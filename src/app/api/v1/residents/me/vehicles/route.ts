import { NextRequest, NextResponse } from "next/server";

import { getActiveSocietyId } from "@/lib/active-society-server";
import { internalError, parseBody, unauthorizedError } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { getExpiryStatus } from "@/lib/utils/vehicle-utils";
import { normalizeRegNumber } from "@/lib/utils/vehicle-utils";
import { vehicleSchema } from "@/lib/validations/vehicle";

const VEHICLE_DOCS_BUCKET = "vehicle-docs";
const SIGNED_URL_TTL = 60 * 60; // 1 hour

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

async function generateSignedUrl(path: string | null): Promise<string | null> {
  if (!path) return null;
  const supabaseAdmin = createAdminClient();
  const { data, error } = await supabaseAdmin.storage
    .from(VEHICLE_DOCS_BUCKET)
    .createSignedUrl(path, SIGNED_URL_TTL);
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}

function formatVehicle(v: {
  id: string;
  unitId: string;
  societyId: string;
  vehicleType: string;
  registrationNumber: string;
  make: string | null;
  model: string | null;
  colour: string | null;
  parkingSlot: string | null;
  fastagId: string | null;
  notes: string | null;
  ownerId: string;
  dependentOwnerId: string | null;
  vehiclePhotoUrl: string | null;
  rcDocUrl: string | null;
  rcDocSignedUrl: string | null;
  rcExpiry: Date | null;
  rcStatus: string;
  insuranceUrl: string | null;
  insuranceSignedUrl: string | null;
  insuranceExpiry: Date | null;
  insuranceStatus: string;
  pucExpiry: Date | null;
  pucStatus: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
  owner: { name: string } | null;
  dependentOwner: { name: string } | null;
}) {
  return {
    id: v.id,
    unitId: v.unitId,
    societyId: v.societyId,
    vehicleType: v.vehicleType,
    registrationNumber: v.registrationNumber,
    make: v.make,
    model: v.model,
    colour: v.colour,
    parkingSlot: v.parkingSlot,
    fastagId: v.fastagId,
    notes: v.notes,
    ownerId: v.ownerId,
    dependentOwnerId: v.dependentOwnerId,
    vehiclePhotoUrl: v.vehiclePhotoUrl,
    rcDocUrl: null, // raw path never exposed
    rcDocSignedUrl: v.rcDocSignedUrl,
    rcExpiry: v.rcExpiry?.toISOString().split("T")[0] ?? null,
    rcStatus: v.rcStatus,
    insuranceUrl: null, // raw path never exposed
    insuranceSignedUrl: v.insuranceSignedUrl,
    insuranceExpiry: v.insuranceExpiry?.toISOString().split("T")[0] ?? null,
    insuranceStatus: v.insuranceStatus,
    pucExpiry: v.pucExpiry?.toISOString().split("T")[0] ?? null,
    pucStatus: v.pucStatus,
    isActive: v.isActive,
    createdAt: v.createdAt.toISOString(),
    updatedAt: v.updatedAt.toISOString(),
    owner: v.owner,
    dependentOwner: v.dependentOwner,
  };
}

/** GET /api/v1/residents/me/vehicles — list active vehicles with signed URLs */
export async function GET(request: NextRequest) {
  try {
    const resident = await getResidentUser();
    if (!resident) return unauthorizedError();

    const { searchParams } = new URL(request.url);
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10));
    const limit = Math.min(50, Math.max(1, parseInt(searchParams.get("limit") ?? "20", 10)));
    const skip = (page - 1) * limit;

    // Get all units for this resident
    const userUnits = await prisma.userUnit.findMany({
      where: { userId: resident.id },
      select: { unitId: true },
    });
    const unitIds = userUnits.map((u) => u.unitId);

    const [vehicles, total] = await Promise.all([
      prisma.vehicle.findMany({
        where: { ownerId: resident.id, isActive: true },
        include: {
          owner: { select: { name: true } },
          dependentOwner: { select: { name: true } },
        },
        orderBy: { createdAt: "asc" },
        skip,
        take: limit,
      }),
      prisma.vehicle.count({ where: { ownerId: resident.id, isActive: true } }),
    ]);

    // Suppress unused variable warning — unitIds used in POST ownership check
    void unitIds;

    const formattedVehicles = await Promise.all(
      vehicles.map(async (v) => {
        const rcDocSignedUrl = await generateSignedUrl(v.rcDocUrl);
        const insuranceSignedUrl = await generateSignedUrl(v.insuranceUrl);
        return formatVehicle({
          ...v,
          rcDocSignedUrl,
          rcStatus: getExpiryStatus(v.rcExpiry),
          insuranceSignedUrl,
          insuranceStatus: getExpiryStatus(v.insuranceExpiry),
          pucStatus: getExpiryStatus(v.pucExpiry),
          owner: v.owner,
          dependentOwner: v.dependentOwner,
        });
      }),
    );

    return NextResponse.json({ vehicles: formattedVehicles, total, page, limit });
  } catch (err) {
    console.error("Vehicles GET error:", err);
    return internalError("Failed to fetch vehicles");
  }
}

/** POST /api/v1/residents/me/vehicles — register a new vehicle */
export async function POST(request: NextRequest) {
  try {
    const resident = await getResidentUser();
    if (!resident) return unauthorizedError();

    const { data, error } = await parseBody(request, vehicleSchema);
    if (error) return error;

    // Validate unitId belongs to resident's units
    const userUnit = await prisma.userUnit.findMany({
      where: { userId: resident.id, unitId: data!.unitId },
    });
    if (userUnit.length === 0) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "Unit does not belong to you" } },
        { status: 403 },
      );
    }

    // Check society vehicle limit
    const society = await prisma.society.findUnique({
      where: { id: resident.societyId! },
      select: { maxVehiclesPerUnit: true },
    });
    if (society && society.maxVehiclesPerUnit > 0) {
      const activeCount = await prisma.vehicle.count({
        where: { unitId: data!.unitId, isActive: true },
      });
      if (activeCount >= society.maxVehiclesPerUnit) {
        return NextResponse.json(
          {
            error: {
              code: "LIMIT_EXCEEDED",
              message: `This unit has reached its vehicle limit (${society.maxVehiclesPerUnit}). Contact admin to increase.`,
            },
          },
          { status: 422 },
        );
      }
    }

    const normalised = normalizeRegNumber(data!.registrationNumber);

    // Check for duplicate active registration in society
    const duplicate = await prisma.vehicle.findFirst({
      where: { registrationNumber: normalised, societyId: resident.societyId!, isActive: true },
      include: { unit: { select: { displayLabel: true } } },
    });
    if (duplicate) {
      return NextResponse.json(
        {
          error: {
            code: "DUPLICATE_REG",
            message: `Registration ${normalised} is already registered to unit ${duplicate.unit?.displayLabel ?? "unknown"}.`,
          },
        },
        { status: 409 },
      );
    }

    const newVehicle = await prisma.$transaction(async (tx) => {
      const vehicle = await tx.vehicle.create({
        data: {
          unitId: data!.unitId,
          societyId: resident.societyId!,
          vehicleType: data!.vehicleType,
          registrationNumber: normalised,
          make: data!.make ?? null,
          model: data!.model ?? null,
          colour: data!.colour ?? null,
          parkingSlot: data!.parkingSlot ?? null,
          dependentOwnerId: data!.dependentOwnerId ?? null,
          insuranceExpiry: data!.insuranceExpiry ? new Date(data!.insuranceExpiry) : null,
          pucExpiry: data!.pucExpiry ? new Date(data!.pucExpiry) : null,
          rcExpiry: data!.rcExpiry ? new Date(data!.rcExpiry) : null,
          fastagId: data!.fastagId ?? null,
          notes: data!.notes ?? null,
          ownerId: resident.id,
        },
        include: {
          owner: { select: { name: true } },
          dependentOwner: { select: { name: true } },
        },
      });

      // Set vehicleStatus = HAS_ENTRIES on the owner
      await tx.user.update({
        where: { id: resident.id },
        data: { vehicleStatus: "HAS_ENTRIES" },
      });

      // Audit log
      await tx.auditLog.create({
        data: {
          societyId: resident.societyId!,
          userId: resident.id,
          actionType: "VEHICLE_ADDED",
          entityType: "VEHICLE",
          entityId: vehicle.id,
        },
      });

      return vehicle;
    });

    return NextResponse.json(
      {
        vehicle: formatVehicle({
          ...newVehicle,
          rcDocSignedUrl: null,
          rcStatus: getExpiryStatus(newVehicle.rcExpiry),
          insuranceSignedUrl: null,
          insuranceStatus: getExpiryStatus(newVehicle.insuranceExpiry),
          pucStatus: getExpiryStatus(newVehicle.pucExpiry),
          owner: newVehicle.owner,
          dependentOwner: newVehicle.dependentOwner,
        }),
      },
      { status: 201 },
    );
  } catch (err) {
    console.error("Vehicles POST error:", err);
    return internalError("Failed to create vehicle");
  }
}
