import { NextRequest, NextResponse } from "next/server";

import { getActiveSocietyId } from "@/lib/active-society-server";
import { forbiddenError, internalError, unauthorizedError } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";
import { createAdminClient } from "@/lib/supabase/admin";
import { ensureBucket } from "@/lib/supabase/ensure-bucket";
import { createClient } from "@/lib/supabase/server";

const BUCKET = "resident-photos";
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

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
    select: { id: true, societyId: true, photoUrl: true },
  });
}

/** POST /api/v1/residents/me/photo — resident uploads their profile photo */
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
        { error: { message: "Invalid file type. Allowed: JPG, PNG, WebP." } },
        { status: 400 },
      );
    }

    const ext = file.name.split(".").pop() ?? "jpg";
    const storagePath = `${resident.societyId}/${resident.id}/photo.${ext}`;

    const supabaseAdmin = createAdminClient();
    await ensureBucket(supabaseAdmin, BUCKET);

    if (resident.photoUrl) {
      await supabaseAdmin.storage.from(BUCKET).remove([resident.photoUrl]);
    }

    const arrayBuffer = await file.arrayBuffer();
    const { error: uploadError } = await supabaseAdmin.storage
      .from(BUCKET)
      .upload(storagePath, arrayBuffer, { contentType: file.type, upsert: true });

    if (uploadError) {
      console.error("Photo upload error:", uploadError.message);
      return internalError(`Storage error: ${uploadError.message}`);
    }

    await prisma.user.update({ where: { id: resident.id }, data: { photoUrl: storagePath } });

    return NextResponse.json({ success: true, path: storagePath });
  } catch (err) {
    console.error("Resident photo POST error:", err);
    return internalError("Failed to upload photo");
  }
}

/** GET /api/v1/residents/me/photo — resident fetches signed URL for their photo */
export async function GET() {
  try {
    const resident = await getResidentUser();
    if (!resident) return unauthorizedError();

    if (!resident.photoUrl) return NextResponse.json({ url: null });

    const supabaseAdmin = createAdminClient();
    const { data, error } = await supabaseAdmin.storage
      .from(BUCKET)
      .createSignedUrl(resident.photoUrl, 60 * 60);

    if (error || !data?.signedUrl) return internalError("Failed to generate photo URL");

    return NextResponse.json({ url: data.signedUrl });
  } catch (err) {
    console.error("Resident photo GET error:", err);
    return internalError("Failed to get photo");
  }
}

/** DELETE /api/v1/residents/me/photo — resident removes their photo */
export async function DELETE() {
  try {
    const resident = await getResidentUser();
    if (!resident) return unauthorizedError();
    if (!resident.photoUrl) return forbiddenError("No photo on file");

    const supabaseAdmin = createAdminClient();
    await supabaseAdmin.storage.from(BUCKET).remove([resident.photoUrl]);
    await prisma.user.update({ where: { id: resident.id }, data: { photoUrl: null } });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Resident photo DELETE error:", err);
    return internalError("Failed to delete photo");
  }
}
