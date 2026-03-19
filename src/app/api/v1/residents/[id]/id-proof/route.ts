import { NextRequest, NextResponse } from "next/server";

import { forbiddenError, internalError, notFoundError, unauthorizedError } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const BUCKET = "id-proofs";
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp", "application/pdf"];

type RouteParams = { params: Promise<{ id: string }> };

async function getAdminOrSuperAdmin() {
  const supabase = await createClient();
  const {
    data: { user: authUser },
  } = await supabase.auth.getUser();
  if (!authUser) return null;

  const user = await prisma.user.findFirst({
    where: { authUserId: authUser.id, role: { in: ["PRIMARY_ADMIN", "SUPPORTING_ADMIN"] } },
    select: { id: true, societyId: true },
  });
  return user;
}

/** POST /api/v1/residents/[id]/id-proof — upload ID proof (admin only) */
export async function POST(request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    const admin = await getAdminOrSuperAdmin();
    if (!admin) return unauthorizedError();

    const resident = await prisma.user.findFirst({
      where: { id, societyId: admin.societyId, role: "RESIDENT" },
      select: { id: true, idProofUrl: true },
    });
    if (!resident) return notFoundError("Resident not found");

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
    const storagePath = `${admin.societyId}/${id}/id-proof.${ext}`;

    const supabaseAdmin = createAdminClient();

    // Delete old file if exists
    if (resident.idProofUrl) {
      await supabaseAdmin.storage.from(BUCKET).remove([resident.idProofUrl]);
    }

    const arrayBuffer = await file.arrayBuffer();
    const { error: uploadError } = await supabaseAdmin.storage
      .from(BUCKET)
      .upload(storagePath, arrayBuffer, {
        contentType: file.type,
        upsert: true,
      });

    if (uploadError) {
      console.error("Storage upload error:", uploadError);
      return internalError("Failed to upload file");
    }

    await prisma.user.update({
      where: { id },
      data: { idProofUrl: storagePath },
    });

    return NextResponse.json({ success: true, path: storagePath });
  } catch (err) {
    console.error("ID proof upload error:", err);
    return internalError("Failed to upload ID proof");
  }
}

/** GET /api/v1/residents/[id]/id-proof — get signed URL (admin only) */
export async function GET(_request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    const admin = await getAdminOrSuperAdmin();
    if (!admin) return unauthorizedError();

    const resident = await prisma.user.findFirst({
      where: { id, societyId: admin.societyId, role: "RESIDENT" },
      select: { idProofUrl: true },
    });
    if (!resident) return notFoundError("Resident not found");
    if (!resident.idProofUrl) {
      return NextResponse.json({ url: null });
    }

    const supabaseAdmin = createAdminClient();
    const { data, error } = await supabaseAdmin.storage
      .from(BUCKET)
      .createSignedUrl(resident.idProofUrl, 60 * 60); // 1-hour expiry

    if (error || !data?.signedUrl) {
      return internalError("Failed to generate view link");
    }

    return NextResponse.json({ url: data.signedUrl });
  } catch (err) {
    console.error("ID proof get error:", err);
    return internalError("Failed to get ID proof");
  }
}

/** DELETE /api/v1/residents/[id]/id-proof — remove ID proof (admin only) */
export async function DELETE(_request: NextRequest, { params }: RouteParams) {
  try {
    const { id } = await params;

    const admin = await getAdminOrSuperAdmin();
    if (!admin) return unauthorizedError();

    const resident = await prisma.user.findFirst({
      where: { id, societyId: admin.societyId, role: "RESIDENT" },
      select: { idProofUrl: true },
    });
    if (!resident) return notFoundError("Resident not found");
    if (!resident.idProofUrl) return forbiddenError("No ID proof on file");

    const supabaseAdmin = createAdminClient();
    await supabaseAdmin.storage.from(BUCKET).remove([resident.idProofUrl]);

    await prisma.user.update({ where: { id }, data: { idProofUrl: null } });

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error("ID proof delete error:", err);
    return internalError("Failed to delete ID proof");
  }
}
