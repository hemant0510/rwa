import { NextRequest, NextResponse } from "next/server";

import { getActiveSocietyId } from "@/lib/active-society-server";
import { forbiddenError, internalError, unauthorizedError } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";
import { createAdminClient } from "@/lib/supabase/admin";
import { ensureBucket } from "@/lib/supabase/ensure-bucket";
import { createClient } from "@/lib/supabase/server";

const BUCKET = "id-proofs";
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"];

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
    select: { id: true, societyId: true, ownershipProofUrl: true },
  });
}

/** POST /api/v1/residents/me/ownership-proof — resident uploads ownership/tenancy doc */
export async function POST(request: NextRequest) {
  try {
    const resident = await getResidentUser();
    if (!resident) return unauthorizedError();
    if (!resident.societyId) return forbiddenError("No active society");

    const formData = await request.formData();
    const file = formData.get("file") as File | null;

    if (!file) {
      return NextResponse.json({ error: { message: "No file provided" } }, { status: 400 });
    }
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: { message: "File too large. Max 5 MB allowed." } },
        { status: 400 },
      );
    }
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: { message: "Invalid file type. Allowed: JPG, PNG, WebP, PDF." } },
        { status: 400 },
      );
    }

    const ext = file.name.split(".").pop() ?? "bin";
    const storagePath = `${resident.societyId}/${resident.id}/ownership-proof.${ext}`;

    const supabaseAdmin = createAdminClient();
    await ensureBucket(supabaseAdmin, BUCKET);

    if (resident.ownershipProofUrl) {
      await supabaseAdmin.storage.from(BUCKET).remove([resident.ownershipProofUrl]);
    }

    const arrayBuffer = await file.arrayBuffer();
    const { error: uploadError } = await supabaseAdmin.storage
      .from(BUCKET)
      .upload(storagePath, arrayBuffer, { contentType: file.type, upsert: true });

    if (uploadError) {
      console.error("Ownership proof upload error:", uploadError.message);
      return internalError(`Storage error: ${uploadError.message}`);
    }

    await prisma.user.update({
      where: { id: resident.id },
      data: { ownershipProofUrl: storagePath },
    });

    return NextResponse.json({ success: true, path: storagePath });
  } catch (err) {
    console.error("Resident ownership-proof POST error:", err);
    return internalError("Failed to upload ownership proof");
  }
}

/** GET /api/v1/residents/me/ownership-proof — resident fetches signed URL for ownership doc */
export async function GET() {
  try {
    const resident = await getResidentUser();
    if (!resident) return unauthorizedError();

    if (!resident.ownershipProofUrl) return NextResponse.json({ url: null });

    const supabaseAdmin = createAdminClient();
    const { data, error } = await supabaseAdmin.storage
      .from(BUCKET)
      .createSignedUrl(resident.ownershipProofUrl, 60 * 60);

    if (error || !data?.signedUrl) return internalError("Failed to generate view link");

    return NextResponse.json({ url: data.signedUrl });
  } catch (err) {
    console.error("Resident ownership-proof GET error:", err);
    return internalError("Failed to get ownership proof");
  }
}

/** DELETE /api/v1/residents/me/ownership-proof — resident removes their ownership doc */
export async function DELETE() {
  try {
    const resident = await getResidentUser();
    if (!resident) return unauthorizedError();
    if (!resident.ownershipProofUrl) return forbiddenError("No ownership proof on file");

    const supabaseAdmin = createAdminClient();
    await supabaseAdmin.storage.from(BUCKET).remove([resident.ownershipProofUrl]);
    await prisma.user.update({ where: { id: resident.id }, data: { ownershipProofUrl: null } });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Resident ownership-proof DELETE error:", err);
    return internalError("Failed to delete ownership proof");
  }
}
