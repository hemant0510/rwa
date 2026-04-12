import { NextRequest, NextResponse } from "next/server";

import { getActiveSocietyId } from "@/lib/active-society-server";
import { internalError, parseBody, unauthorizedError } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { generateMemberId } from "@/lib/utils/member-id";
import { familyMemberSchema } from "@/lib/validations/family";

const MEMBER_LIMIT = 15;
const ID_PROOF_BUCKET = "dependent-docs";
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
    select: { id: true, societyId: true, rwaid: true },
  });
}

function computeAge(dateOfBirth: Date | null): number | null {
  if (!dateOfBirth) return null;
  const today = new Date();
  const age = today.getFullYear() - dateOfBirth.getFullYear();
  const m = today.getMonth() - dateOfBirth.getMonth();
  return m < 0 || (m === 0 && today.getDate() < dateOfBirth.getDate()) ? age - 1 : age;
}

async function generateSignedUrl(path: string | null): Promise<string | null> {
  if (!path) return null;
  const supabaseAdmin = createAdminClient();
  const { data, error } = await supabaseAdmin.storage
    .from(ID_PROOF_BUCKET)
    .createSignedUrl(path, SIGNED_URL_TTL);
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}

/** GET /api/v1/residents/me/family — list active family members with signed URLs */
export async function GET() {
  try {
    const resident = await getResidentUser();
    if (!resident) return unauthorizedError();

    const dependents = await prisma.dependent.findMany({
      where: { userId: resident.id, isActive: true },
      orderBy: { memberSeq: "asc" },
    });

    const members = await Promise.all(
      dependents.map(async (dep) => ({
        id: dep.id,
        memberId: dep.memberId,
        memberSeq: dep.memberSeq,
        name: dep.name,
        relationship: dep.relationship,
        otherRelationship: dep.otherRelationship,
        dateOfBirth: dep.dateOfBirth?.toISOString().split("T")[0] ?? null,
        age: computeAge(dep.dateOfBirth),
        bloodGroup: dep.bloodGroup,
        mobile: dep.mobile,
        email: dep.email,
        occupation: dep.occupation,
        photoUrl: dep.photoUrl,
        idProofSignedUrl: await generateSignedUrl(dep.idProofUrl),
        isEmergencyContact: dep.isEmergencyContact,
        emergencyPriority: dep.emergencyPriority,
        medicalNotes: dep.medicalNotes,
        isActive: dep.isActive,
        createdAt: dep.createdAt.toISOString(),
        updatedAt: dep.updatedAt.toISOString(),
      })),
    );

    return NextResponse.json({ members });
  } catch (err) {
    console.error("Family GET error:", err);
    return internalError("Failed to fetch family members");
  }
}

/** POST /api/v1/residents/me/family — create a new family member */
export async function POST(request: NextRequest) {
  try {
    const resident = await getResidentUser();
    if (!resident) return unauthorizedError();

    const { data, error } = await parseBody(request, familyMemberSchema);
    if (error) return error;

    // Enforce member limit
    const activeCount = await prisma.dependent.count({
      where: { userId: resident.id, isActive: true },
    });
    if (activeCount >= MEMBER_LIMIT) {
      return NextResponse.json(
        {
          error: {
            code: "LIMIT_EXCEEDED",
            message: `Maximum ${MEMBER_LIMIT} family members allowed`,
          },
        },
        { status: 400 },
      );
    }

    // Concurrency-safe memberSeq assignment (retry up to 3 times on P2002)
    let newDependent = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      const max = await prisma.dependent.aggregate({
        _max: { memberSeq: true },
        where: { userId: resident.id },
      });
      const nextSeq = (max._max.memberSeq ?? 0) + 1;
      const memberId = resident.rwaid ? generateMemberId(resident.rwaid, nextSeq) : null;

      try {
        newDependent = await prisma.$transaction(async (tx) => {
          const dep = await tx.dependent.create({
            data: {
              userId: resident.id,
              societyId: resident.societyId!,
              memberSeq: nextSeq,
              memberId,
              name: data!.name,
              relationship: data!.relationship,
              otherRelationship: data!.otherRelationship ?? null,
              dateOfBirth: data!.dateOfBirth ? new Date(data!.dateOfBirth) : null,
              bloodGroup: data!.bloodGroup ?? null,
              mobile: data!.mobile || null,
              email: data!.email || null,
              occupation: data!.occupation ?? null,
              isEmergencyContact: data!.isEmergencyContact,
              emergencyPriority: data!.emergencyPriority ?? null,
              medicalNotes: data!.medicalNotes ?? null,
            },
          });

          // Set householdStatus to HAS_ENTRIES
          await tx.user.update({
            where: { id: resident.id },
            data: { householdStatus: "HAS_ENTRIES" },
          });

          // Audit log
          await tx.auditLog.create({
            data: {
              societyId: resident.societyId!,
              userId: resident.id,
              actionType: "FAMILY_MEMBER_ADDED",
              entityType: "DEPENDENT",
              entityId: dep.id,
            },
          });

          return dep;
        });
        break; // success — exit retry loop
      } catch (err: unknown) {
        const prismaErr = err as { code?: string };
        if (prismaErr?.code === "P2002" && attempt < 2) continue;
        throw err;
      }
    }

    return NextResponse.json(
      {
        member: {
          id: newDependent!.id,
          memberId: newDependent!.memberId,
          memberSeq: newDependent!.memberSeq,
          name: newDependent!.name,
          relationship: newDependent!.relationship,
          otherRelationship: newDependent!.otherRelationship,
          dateOfBirth: newDependent!.dateOfBirth?.toISOString().split("T")[0] ?? null,
          age: computeAge(newDependent!.dateOfBirth),
          bloodGroup: newDependent!.bloodGroup,
          mobile: newDependent!.mobile,
          email: newDependent!.email,
          occupation: newDependent!.occupation,
          photoUrl: newDependent!.photoUrl,
          idProofSignedUrl: null,
          isEmergencyContact: newDependent!.isEmergencyContact,
          emergencyPriority: newDependent!.emergencyPriority,
          medicalNotes: newDependent!.medicalNotes,
          isActive: newDependent!.isActive,
          createdAt: newDependent!.createdAt.toISOString(),
          updatedAt: newDependent!.updatedAt.toISOString(),
        },
      },
      { status: 201 },
    );
  } catch (err) {
    console.error("Family POST error:", err);
    return internalError("Failed to create family member");
  }
}
