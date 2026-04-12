import { NextRequest, NextResponse } from "next/server";

import { getActiveSocietyId } from "@/lib/active-society-server";
import { internalError, parseBody, unauthorizedError } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";
import { createClient } from "@/lib/supabase/server";
import { familyMemberUpdateSchema } from "@/lib/validations/family";

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

/** PATCH /api/v1/residents/me/family/[id] — update a family member */
export async function PATCH(request: NextRequest, { params }: RouteContext) {
  try {
    const resident = await getResidentUser();
    if (!resident) return unauthorizedError();

    const { id } = await params;

    const dependent = await prisma.dependent.findUnique({ where: { id } });
    if (!dependent || dependent.userId !== resident.id) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Family member not found" } },
        { status: 404 },
      );
    }

    const { data, error } = await parseBody(request, familyMemberUpdateSchema);
    if (error) return error;

    const updated = await prisma.$transaction(async (tx) => {
      const dep = await tx.dependent.update({
        where: { id },
        data: {
          ...(data!.name !== undefined && { name: data!.name }),
          ...(data!.relationship !== undefined && { relationship: data!.relationship }),
          ...(data!.otherRelationship !== undefined && {
            otherRelationship: data!.otherRelationship,
          }),
          ...(data!.dateOfBirth !== undefined && {
            dateOfBirth: data!.dateOfBirth ? new Date(data!.dateOfBirth) : null,
          }),
          ...(data!.bloodGroup !== undefined && { bloodGroup: data!.bloodGroup }),
          ...(data!.mobile !== undefined && { mobile: data!.mobile || null }),
          ...(data!.email !== undefined && { email: data!.email || null }),
          ...(data!.occupation !== undefined && { occupation: data!.occupation }),
          ...(data!.isEmergencyContact !== undefined && {
            isEmergencyContact: data!.isEmergencyContact,
          }),
          ...(data!.emergencyPriority !== undefined && {
            emergencyPriority: data!.emergencyPriority,
          }),
          ...(data!.medicalNotes !== undefined && { medicalNotes: data!.medicalNotes }),
        },
      });

      await tx.auditLog.create({
        data: {
          societyId: resident.societyId!,
          userId: resident.id,
          actionType: "FAMILY_MEMBER_UPDATED",
          entityType: "DEPENDENT",
          entityId: id,
        },
      });

      return dep;
    });

    return NextResponse.json({
      member: {
        id: updated.id,
        memberId: updated.memberId,
        memberSeq: updated.memberSeq,
        name: updated.name,
        relationship: updated.relationship,
        otherRelationship: updated.otherRelationship,
        dateOfBirth: updated.dateOfBirth?.toISOString().split("T")[0] ?? null,
        bloodGroup: updated.bloodGroup,
        mobile: updated.mobile,
        email: updated.email,
        occupation: updated.occupation,
        photoUrl: updated.photoUrl,
        isEmergencyContact: updated.isEmergencyContact,
        emergencyPriority: updated.emergencyPriority,
        medicalNotes: updated.medicalNotes,
        isActive: updated.isActive,
        createdAt: updated.createdAt.toISOString(),
        updatedAt: updated.updatedAt.toISOString(),
      },
    });
  } catch (err) {
    console.error("Family PATCH error:", err);
    return internalError("Failed to update family member");
  }
}

/** DELETE /api/v1/residents/me/family/[id] — soft delete a family member */
export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  try {
    const resident = await getResidentUser();
    if (!resident) return unauthorizedError();

    const { id } = await params;

    const dependent = await prisma.dependent.findUnique({ where: { id } });
    if (!dependent || dependent.userId !== resident.id) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Family member not found" } },
        { status: 404 },
      );
    }

    await prisma.$transaction(async (tx) => {
      await tx.dependent.update({
        where: { id },
        data: { isActive: false, deactivatedAt: new Date() },
      });

      await tx.auditLog.create({
        data: {
          societyId: resident.societyId!,
          userId: resident.id,
          actionType: "FAMILY_MEMBER_REMOVED",
          entityType: "DEPENDENT",
          entityId: id,
        },
      });

      // Revert householdStatus if no more active dependents
      const remaining = await tx.dependent.count({
        where: { userId: resident.id, isActive: true },
      });
      if (remaining === 0) {
        await tx.user.update({
          where: { id: resident.id },
          data: { householdStatus: "NOT_SET" },
        });
      }
    });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Family DELETE error:", err);
    return internalError("Failed to delete family member");
  }
}
