import { NextRequest, NextResponse } from "next/server";

import { getActiveSocietyId } from "@/lib/active-society-server";
import { internalError, unauthorizedError } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const ID_PROOF_BUCKET = "dependent-docs";
const MAX_SIZE_BYTES = 10 * 1024 * 1024; // 10 MB

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

/** POST /api/v1/residents/me/family/[id]/id-proof — upload an ID proof document */
export async function POST(request: NextRequest, { params }: RouteContext) {
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

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    if (!file) {
      return NextResponse.json(
        { error: { code: "MISSING_FILE", message: "No file provided" } },
        { status: 400 },
      );
    }

    const allowed = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
    if (!allowed.includes(file.type)) {
      return NextResponse.json(
        { error: { code: "INVALID_TYPE", message: "Only images and PDF files are allowed" } },
        { status: 400 },
      );
    }

    if (file.size > MAX_SIZE_BYTES) {
      return NextResponse.json(
        { error: { code: "FILE_TOO_LARGE", message: "File size must not exceed 10 MB" } },
        { status: 400 },
      );
    }

    const path = `${resident.societyId}/${id}/id-proof`;
    const supabaseAdmin = createAdminClient();
    const { error: uploadError } = await supabaseAdmin.storage
      .from(ID_PROOF_BUCKET)
      .upload(path, file, { upsert: true, contentType: file.type });

    if (uploadError) {
      console.error("ID proof upload error:", uploadError);
      return internalError("Failed to upload ID proof");
    }

    await prisma.dependent.update({ where: { id }, data: { idProofUrl: path } });

    return NextResponse.json({ path });
  } catch (err) {
    console.error("Family id-proof POST error:", err);
    return internalError("Failed to upload ID proof");
  }
}
