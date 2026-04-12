import { NextResponse } from "next/server";

import { getActiveSocietyId } from "@/lib/active-society-server";
import { internalError } from "@/lib/api-helpers";
import { getSessionYear } from "@/lib/fee-calculator";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { computeCompleteness } from "@/lib/utils/profile-completeness";

export async function GET() {
  try {
    const supabase = await createClient();
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();

    if (!authUser) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const activeSocietyId = await getActiveSocietyId();

    const where: Record<string, unknown> = { authUserId: authUser.id, role: "RESIDENT" };
    if (activeSocietyId) where.societyId = activeSocietyId;

    const user = await prisma.user.findFirst({
      where,
      include: {
        society: {
          select: { name: true, societyCode: true },
        },
        userUnits: {
          include: {
            unit: {
              select: { displayLabel: true },
            },
          },
          take: 1,
        },
        governingBodyMembership: {
          select: {
            designation: {
              select: { name: true },
            },
          },
        },
      },
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const [hasEmergencyContact, emergencyContactHasBloodGroup, currentFee] =
      await prisma.$transaction([
        prisma.dependent.count({
          where: { userId: user.id, isEmergencyContact: true, isActive: true },
        }),
        prisma.dependent.count({
          where: {
            userId: user.id,
            isEmergencyContact: true,
            isActive: true,
            bloodGroup: { not: null },
          },
        }),
        prisma.membershipFee.findFirst({
          where: { userId: user.id, sessionYear: getSessionYear(new Date()) },
        }),
      ]);

    const completeness = computeCompleteness({
      photoUrl: user.photoUrl,
      mobile: user.mobile,
      isEmailVerified: user.isEmailVerified,
      bloodGroup: user.bloodGroup,
      idProofUrl: user.idProofUrl,
      ownershipProofUrl: user.ownershipProofUrl,
      ownershipType: user.ownershipType,
      hasEmergencyContact: (hasEmergencyContact as number) > 0,
      householdStatus: user.householdStatus,
      vehicleStatus: user.vehicleStatus,
      consentWhatsapp: user.consentWhatsapp,
      showInDirectory: user.showInDirectory,
      emergencyContactHasBloodGroup: (emergencyContactHasBloodGroup as number) > 0,
    });

    return NextResponse.json({
      id: user.id,
      name: user.name,
      email: user.email,
      mobile: user.mobile,
      rwaid: user.rwaid,
      status: user.status,
      ownershipType: user.ownershipType,
      bloodGroup: user.bloodGroup,
      householdStatus: user.householdStatus,
      vehicleStatus: user.vehicleStatus,
      showInDirectory: user.showInDirectory,
      societyName: user.society?.name ?? null,
      unit: user.userUnits[0]?.unit?.displayLabel ?? null,
      designation: user.governingBodyMembership?.designation?.name ?? null,
      currentFee: currentFee
        ? {
            sessionYear: currentFee.sessionYear,
            amountDue: Number(currentFee.amountDue),
            amountPaid: Number(currentFee.amountPaid),
            status: currentFee.status,
          }
        : null,
      completeness,
    });
  } catch (err) {
    console.error("Resident me error:", err);
    return internalError("Failed to fetch profile");
  }
}
