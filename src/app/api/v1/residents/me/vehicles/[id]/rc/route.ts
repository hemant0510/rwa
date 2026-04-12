import { NextRequest, NextResponse } from "next/server";

import { getActiveSocietyId } from "@/lib/active-society-server";
import { internalError, unauthorizedError } from "@/lib/api-helpers";
import { prisma } from "@/lib/prisma";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const DOCS_BUCKET = "vehicle-docs";
const SIGNED_URL_TTL = 60 * 60; // 1 hour
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

/** POST /api/v1/residents/me/vehicles/[id]/rc — upload an RC document */
export async function POST(request: NextRequest, { params }: RouteContext) {
  try {
    const resident = await getResidentUser();
    if (!resident) return unauthorizedError();

    const { id } = await params;

    const vehicle = await prisma.vehicle.findUnique({ where: { id } });
    if (!vehicle || vehicle.ownerId !== resident.id) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Vehicle not found" } },
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

    const path = `${resident.societyId}/${id}/rc`;
    const supabaseAdmin = createAdminClient();
    const { error: uploadError } = await supabaseAdmin.storage
      .from(DOCS_BUCKET)
      .upload(path, file, { upsert: true, contentType: file.type });

    if (uploadError) {
      console.error("RC upload error:", uploadError);
      return internalError("Failed to upload RC document");
    }

    // Store path in DB (not signed URL — signed URL is generated on GET)
    await prisma.vehicle.update({ where: { id }, data: { rcDocUrl: path } });

    // Return a signed URL for immediate use
    const { data: signedData, error: signedError } = await supabaseAdmin.storage
      .from(DOCS_BUCKET)
      .createSignedUrl(path, SIGNED_URL_TTL);

    const url = !signedError && signedData?.signedUrl ? signedData.signedUrl : path;

    return NextResponse.json({ url });
  } catch (err) {
    console.error("Vehicle RC POST error:", err);
    return internalError("Failed to upload RC document");
  }
}
