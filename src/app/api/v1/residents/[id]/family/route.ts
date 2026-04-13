import { NextResponse } from "next/server";

import { forbiddenError, internalError, notFoundError } from "@/lib/api-helpers";
import { getCurrentUser } from "@/lib/get-current-user";
import { prisma } from "@/lib/prisma";
import { createAdminClient } from "@/lib/supabase/admin";

const ID_PROOF_BUCKET = "dependent-docs";
const SIGNED_URL_TTL = 60 * 60; // 1 hour

async function generateSignedUrl(path: string | null): Promise<string | null> {
  if (!path) return null;
  const supabaseAdmin = createAdminClient();
  const { data, error } = await supabaseAdmin.storage
    .from(ID_PROOF_BUCKET)
    .createSignedUrl(path, SIGNED_URL_TTL);
  if (error || !data?.signedUrl) return null;
  return data.signedUrl;
}

function computeAge(dateOfBirth: Date | null): number | null {
  if (!dateOfBirth) return null;
  const today = new Date();
  const age = today.getFullYear() - dateOfBirth.getFullYear();
  const m = today.getMonth() - dateOfBirth.getMonth();
  return m < 0 || (m === 0 && today.getDate() < dateOfBirth.getDate()) ? age - 1 : age;
}

/** GET /api/v1/residents/[id]/family — admin-only, returns ALL dependents (active + inactive) */
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const admin = await getCurrentUser("RWA_ADMIN");
    if (!admin) return forbiddenError("Admin access required");

    const { id } = await context.params;

    const resident = await prisma.user.findUnique({
      where: { id },
      select: { id: true, societyId: true, role: true },
    });
    if (!resident || resident.role !== "RESIDENT") return notFoundError("Resident not found");
    if (resident.societyId !== admin.societyId)
      return forbiddenError("Access denied to this resident");

    const dependents = await prisma.dependent.findMany({
      where: { userId: id },
      orderBy: [{ isActive: "desc" }, { memberSeq: "asc" }],
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
        deactivatedAt: dep.deactivatedAt?.toISOString() ?? null,
        createdAt: dep.createdAt.toISOString(),
        updatedAt: dep.updatedAt.toISOString(),
      })),
    );

    return NextResponse.json({ members });
  } catch (err) {
    console.error("Admin family GET error:", err);
    return internalError("Failed to fetch family members");
  }
}
