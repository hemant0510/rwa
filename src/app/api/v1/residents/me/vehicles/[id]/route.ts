import { NextRequest, NextResponse } from "next/server";

import { getActiveSocietyId } from "@/lib/active-society-server";
import { internalError, parseBody, unauthorizedError } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { getExpiryStatus, normalizeRegNumber } from "@/lib/utils/vehicle-utils";
import { vehicleUpdateSchema } from "@/lib/validations/vehicle";

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

type RouteContext = { params: Promise<{ id: string }> };

/** PATCH /api/v1/residents/me/vehicles/[id] — update a vehicle */
export async function PATCH(request: NextRequest, { params }: RouteContext) {
  try {
    const resident = await getResidentUser();
    if (!resident) return unauthorizedError();

    const { id } = await params;

    const vehicle = await prisma.vehicle.findUnique({ where: { id } });
    if (!vehicle || vehicle.ownerId !== resident.id) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Vehicle not found" } },
        { status: 404 },
      );
    }

    const { data, error } = await parseBody(request, vehicleUpdateSchema);
    if (error) return error;

    const updateData: Record<string, unknown> = { ...data };

    // Re-normalise registration number if provided
    if (data!.registrationNumber !== undefined) {
      updateData.registrationNumber = normalizeRegNumber(data!.registrationNumber);
    }

    // Convert date strings to Date objects (schema guarantees valid date string when defined)
    if (data!.rcExpiry !== undefined) {
      updateData.rcExpiry = new Date(data!.rcExpiry);
    }
    if (data!.insuranceExpiry !== undefined) {
      updateData.insuranceExpiry = new Date(data!.insuranceExpiry);
    }
    if (data!.pucExpiry !== undefined) {
      updateData.pucExpiry = new Date(data!.pucExpiry);
    }

    const updated = await prisma.$transaction(async (tx) => {
      const v = await tx.vehicle.update({
        where: { id },
        data: updateData,
        include: {
          owner: { select: { name: true } },
          dependentOwner: { select: { name: true } },
        },
      });

      await tx.auditLog.create({
        data: {
          societyId: resident.societyId!,
          userId: resident.id,
          actionType: "VEHICLE_UPDATED",
          entityType: "VEHICLE",
          entityId: id,
        },
      });

      return v;
    });

    return NextResponse.json({
      vehicle: {
        id: updated.id,
        unitId: updated.unitId,
        societyId: updated.societyId,
        vehicleType: updated.vehicleType,
        registrationNumber: updated.registrationNumber,
        make: updated.make,
        model: updated.model,
        colour: updated.colour,
        parkingSlot: updated.parkingSlot,
        fastagId: updated.fastagId,
        notes: updated.notes,
        ownerId: updated.ownerId,
        dependentOwnerId: updated.dependentOwnerId,
        vehiclePhotoUrl: updated.vehiclePhotoUrl,
        rcDocUrl: null,
        rcDocSignedUrl: null,
        rcExpiry: updated.rcExpiry?.toISOString().split("T")[0] ?? null,
        rcStatus: getExpiryStatus(updated.rcExpiry),
        insuranceUrl: null,
        insuranceSignedUrl: null,
        insuranceExpiry: updated.insuranceExpiry?.toISOString().split("T")[0] ?? null,
        insuranceStatus: getExpiryStatus(updated.insuranceExpiry),
        pucExpiry: updated.pucExpiry?.toISOString().split("T")[0] ?? null,
        pucStatus: getExpiryStatus(updated.pucExpiry),
        isActive: updated.isActive,
        createdAt: updated.createdAt.toISOString(),
        updatedAt: updated.updatedAt.toISOString(),
        owner: updated.owner,
        dependentOwner: updated.dependentOwner,
      },
    });
  } catch (err) {
    console.error("Vehicle PATCH error:", err);
    return internalError("Failed to update vehicle");
  }
}

/** DELETE /api/v1/residents/me/vehicles/[id] — soft-delete a vehicle */
export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  try {
    const resident = await getResidentUser();
    if (!resident) return unauthorizedError();

    const { id } = await params;

    const vehicle = await prisma.vehicle.findUnique({ where: { id } });
    if (!vehicle || vehicle.ownerId !== resident.id) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Vehicle not found" } },
        { status: 404 },
      );
    }

    await prisma.$transaction(async (tx) => {
      await tx.vehicle.update({
        where: { id },
        data: { isActive: false },
      });

      await tx.auditLog.create({
        data: {
          societyId: resident.societyId!,
          userId: resident.id,
          actionType: "VEHICLE_DEACTIVATED",
          entityType: "VEHICLE",
          entityId: id,
        },
      });

      // Revert vehicleStatus if no more active vehicles for this user
      const remaining = await tx.vehicle.count({
        where: { ownerId: resident.id, isActive: true },
      });
      if (remaining === 0) {
        await tx.user.update({
          where: { id: resident.id },
          data: { vehicleStatus: "NOT_SET" },
        });
      }
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Vehicle DELETE error:", err);
    return internalError("Failed to delete vehicle");
  }
}
