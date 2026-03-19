import { NextRequest, NextResponse } from "next/server";

import { forbiddenError, internalError, notFoundError, unauthorizedError } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";
import { createAdminClient } from "@/lib/supabase/admin";
import { ensureBucket } from "@/lib/supabase/ensure-bucket";
import { createClient } from "@/lib/supabase/server";

const BUCKET = "id-proofs";
const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"];

type RouteParams = { params: Promise<{ id: string }> };

async function getAdminUser() {
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();
  if (!authUser) return null;

  return prisma.user.findFirst({
    where: { authUserId: authUser.id, role: "RWA_ADMIN" },
    select: { id: true, societyId: true },
  });
}

/** POST /api/v1/residents/[id]/ownership-proof — admin uploads ownership proof */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const admin = await getAdminUser();
    if (!admin) return unauthorizedError();

    const resident = await prisma.user.findFirst({
      where: { id, societyId: admin.societyId, role: "RESIDENT" },
      select: { id: true, ownershipProofUrl: true },
    });
    if (!resident) return notFoundError("Resident not found");

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    if (!file)
      return NextResponse.json({ error: { message: "No file provided" } }, { status: 400 });
    if (file.size > MAX_FILE_SIZE)
      return NextResponse.json(
        { error: { message: "File too large. Max 5 MB." } },
        { status: 400 },
      );
    if (!ALLOWED_TYPES.includes(file.type))
      return NextResponse.json(
        { error: { message: "Invalid file type. Allowed: JPG, PNG, WebP, PDF." } },
        { status: 400 },
      );

    const ext = file.name.split(".").pop() ?? "bin";
    const storagePath = `${admin.societyId}/${id}/ownership-proof.${ext}`;
    const supabaseAdmin = createAdminClient();
    await ensureBucket(supabaseAdmin, BUCKET);

    if (resident.ownershipProofUrl) {
      await supabaseAdmin.storage.from(BUCKET).remove([resident.ownershipProofUrl]);
    }

    const { error: uploadError } = await supabaseAdmin.storage
      .from(BUCKET)
      .upload(storagePath, await file.arrayBuffer(), { contentType: file.type, upsert: true });

    if (uploadError) {
      console.error("Ownership proof upload error:", uploadError.message);
      return internalError(`Storage error: ${uploadError.message}`);
    }

    await prisma.user.update({ where: { id }, data: { ownershipProofUrl: storagePath } });
    return NextResponse.json({ success: true, path: storagePath });
  } catch (err) {
    console.error("Admin ownership-proof POST error:", err);
    return internalError("Failed to upload ownership proof");
  }
}

/** GET /api/v1/residents/[id]/ownership-proof — admin gets signed URL */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const admin = await getAdminUser();
    if (!admin) return unauthorizedError();

    const resident = await prisma.user.findFirst({
      where: { id, societyId: admin.societyId, role: "RESIDENT" },
      select: { ownershipProofUrl: true },
    });
    if (!resident) return notFoundError("Resident not found");
    if (!resident.ownershipProofUrl) return NextResponse.json({ url: null });

    const supabaseAdmin = createAdminClient();
    const { data, error } = await supabaseAdmin.storage
      .from(BUCKET)
      .createSignedUrl(resident.ownershipProofUrl, 60 * 60);

    if (error || !data?.signedUrl) return internalError("Failed to generate view link");
    return NextResponse.json({ url: data.signedUrl });
  } catch (err) {
    console.error("Admin ownership-proof GET error:", err);
    return internalError("Failed to get ownership proof");
  }
}

/** DELETE /api/v1/residents/[id]/ownership-proof — admin removes ownership proof */
export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;
    const admin = await getAdminUser();
    if (!admin) return unauthorizedError();

    const resident = await prisma.user.findFirst({
      where: { id, societyId: admin.societyId, role: "RESIDENT" },
      select: { ownershipProofUrl: true },
    });
    if (!resident) return notFoundError("Resident not found");
    if (!resident.ownershipProofUrl) return forbiddenError("No ownership proof on file");

    const supabaseAdmin = createAdminClient();
    await supabaseAdmin.storage.from(BUCKET).remove([resident.ownershipProofUrl]);
    await prisma.user.update({ where: { id }, data: { ownershipProofUrl: null } });
    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("Admin ownership-proof DELETE error:", err);
    return internalError("Failed to delete ownership proof");
  }
}
