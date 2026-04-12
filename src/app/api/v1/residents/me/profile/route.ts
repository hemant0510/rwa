import { NextResponse } from "next/server";

import { z } from "zod";

import { getActiveSocietyId } from "@/lib/active-society-server";
import { errorResponse, internalError, parseBody, unauthorizedError } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { computeCompleteness } from "@/lib/utils/profile-completeness";

const BLOOD_GROUPS = [
  "A_POS",
  "A_NEG",
  "B_POS",
  "B_NEG",
  "AB_POS",
  "AB_NEG",
  "O_POS",
  "O_NEG",
  "UNKNOWN",
] as const;

const DECLARATION_VALUES = ["NOT_SET", "DECLARED_NONE"] as const;

const profilePatchSchema = z
  .object({
    bloodGroup: z.enum(BLOOD_GROUPS).optional(),
    householdStatus: z.enum(DECLARATION_VALUES).optional(),
    vehicleStatus: z.enum(DECLARATION_VALUES).optional(),
  })
  .strict();

async function getResidentUser() {
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();
  if (!authUser) return null;

  const activeSocietyId = await getActiveSocietyId();
  const where: Record<string, unknown> = { authUserId: authUser.id, role: "RESIDENT" };
  if (activeSocietyId) where.societyId = activeSocietyId;

  return prisma.user.findFirst({ where, select: { id: true } });
}

/** PATCH /api/v1/residents/me/profile — update blood group + household/vehicle declarations */
export async function PATCH(request: Request) {
  try {
    const resident = await getResidentUser();
    if (!resident) return unauthorizedError();

    const { data, error } = await parseBody(request, profilePatchSchema);
    if (error) return error;

    const updates: Record<string, string> = {};
    if (data!.bloodGroup !== undefined) updates.bloodGroup = data!.bloodGroup;
    if (data!.householdStatus !== undefined) updates.householdStatus = data!.householdStatus;
    if (data!.vehicleStatus !== undefined) updates.vehicleStatus = data!.vehicleStatus;

    if (Object.keys(updates).length === 0) {
      return errorResponse({
        code: "NO_UPDATES",
        message: "No updatable fields provided",
        status: 400,
      });
    }

    const updated = await prisma.user.update({
      where: { id: resident.id },
      data: updates,
      select: {
        id: true,
        photoUrl: true,
        mobile: true,
        isEmailVerified: true,
        bloodGroup: true,
        idProofUrl: true,
        ownershipProofUrl: true,
        ownershipType: true,
        householdStatus: true,
        vehicleStatus: true,
        consentWhatsapp: true,
        showInDirectory: true,
      },
    });

    const [hasEmergencyContact, emergencyContactHasBloodGroup] = await prisma.$transaction([
      prisma.dependent.count({
        where: { userId: updated.id, isEmergencyContact: true, isActive: true },
      }),
      prisma.dependent.count({
        where: {
          userId: updated.id,
          isEmergencyContact: true,
          isActive: true,
          bloodGroup: { not: null },
        },
      }),
    ]);

    const completeness = computeCompleteness({
      photoUrl: updated.photoUrl,
      mobile: updated.mobile,
      isEmailVerified: updated.isEmailVerified,
      bloodGroup: updated.bloodGroup,
      idProofUrl: updated.idProofUrl,
      ownershipProofUrl: updated.ownershipProofUrl,
      ownershipType: updated.ownershipType,
      hasEmergencyContact: (hasEmergencyContact as number) > 0,
      householdStatus: updated.householdStatus,
      vehicleStatus: updated.vehicleStatus,
      consentWhatsapp: updated.consentWhatsapp,
      showInDirectory: updated.showInDirectory,
      emergencyContactHasBloodGroup: (emergencyContactHasBloodGroup as number) > 0,
    });

    return NextResponse.json({
      bloodGroup: updated.bloodGroup,
      householdStatus: updated.householdStatus,
      vehicleStatus: updated.vehicleStatus,
      completeness,
    });
  } catch (err) {
    console.error("Profile PATCH error:", err);
    return internalError("Failed to update profile");
  }
}
