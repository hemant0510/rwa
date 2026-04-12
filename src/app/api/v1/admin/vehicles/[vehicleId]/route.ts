import { NextResponse } from "next/server";

import { Prisma } from "@prisma/client";

import { forbiddenError, internalError, notFoundError, parseBody } from "@/lib/api-helpers";
import { getFullAccessAdmin } from "@/lib/get-current-user";
import { prisma } from "@/lib/prisma";
import { vehicleAdminUpdateSchema } from "@/lib/validations/vehicle";

/** PATCH /api/v1/admin/vehicles/[vehicleId] — admin can update slot/sticker/validity fields only */
export async function PATCH(request: Request, context: { params: Promise<{ vehicleId: string }> }) {
  try {
    const admin = await getFullAccessAdmin();
    if (!admin) return forbiddenError("Admin access required");

    const { vehicleId } = await context.params;

    const existing = await prisma.vehicle.findUnique({
      where: { id: vehicleId },
      select: {
        id: true,
        societyId: true,
        parkingSlot: true,
        stickerNumber: true,
        evSlot: true,
        validFrom: true,
        validTo: true,
      },
    });
    if (!existing) return notFoundError("Vehicle not found");
    if (existing.societyId !== admin.societyId) {
      return forbiddenError("Access denied to this vehicle");
    }

    const { data, error } = await parseBody(request, vehicleAdminUpdateSchema);
    if (error) return error;

    const updateData: Record<string, unknown> = {};
    if (data!.parkingSlot !== undefined) updateData.parkingSlot = data!.parkingSlot;
    if (data!.stickerNumber !== undefined) updateData.stickerNumber = data!.stickerNumber;
    if (data!.evSlot !== undefined) updateData.evSlot = data!.evSlot;
    if (data!.validFrom !== undefined) {
      updateData.validFrom = data!.validFrom === null ? null : new Date(data!.validFrom);
    }
    if (data!.validTo !== undefined) {
      updateData.validTo = data!.validTo === null ? null : new Date(data!.validTo);
    }

    const updated = await prisma.$transaction(async (tx) => {
      const v = await tx.vehicle.update({
        where: { id: vehicleId },
        data: updateData,
        include: {
          owner: { select: { id: true, name: true } },
          dependentOwner: { select: { id: true, name: true } },
          unit: { select: { displayLabel: true } },
        },
      });
      await tx.auditLog.create({
        data: {
          societyId: admin.societyId,
          userId: admin.userId,
          actionType: "VEHICLE_SLOT_ASSIGNED",
          entityType: "Vehicle",
          entityId: vehicleId,
          oldValue: {
            parkingSlot: existing.parkingSlot,
            stickerNumber: existing.stickerNumber,
            evSlot: existing.evSlot,
            validFrom: existing.validFrom?.toISOString() ?? null,
            validTo: existing.validTo?.toISOString() ?? null,
          },
          newValue: updateData as Prisma.InputJsonValue,
        },
      });
      return v;
    });

    return NextResponse.json({
      vehicle: {
        id: updated.id,
        registrationNumber: updated.registrationNumber,
        parkingSlot: updated.parkingSlot,
        stickerNumber: updated.stickerNumber,
        evSlot: updated.evSlot,
        validFrom: updated.validFrom?.toISOString().split("T")[0] ?? null,
        validTo: updated.validTo?.toISOString().split("T")[0] ?? null,
        unit: updated.unit,
        owner: updated.owner,
        dependentOwner: updated.dependentOwner,
      },
    });
  } catch (err) {
    console.error("Admin vehicle PATCH error:", err);
    return internalError("Failed to update vehicle");
  }
}
