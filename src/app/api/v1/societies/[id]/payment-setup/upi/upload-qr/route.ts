import { NextRequest } from "next/server";

import {
  errorResponse,
  notFoundError,
  successResponse,
  unauthorizedError,
} from "@/lib/api-helpers";
import { getFullAccessAdmin } from "@/lib/get-current-user";
import { prisma } from "@/lib/prisma";
import { createAdminClient } from "@/lib/supabase/admin";
import { ensureBucket } from "@/lib/supabase/ensure-bucket";

const BUCKET = "societies";
const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2 MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

type RouteParams = { params: Promise<{ id: string }> };

/** POST /api/v1/societies/[id]/payment-setup/upi/upload-qr — upload UPI QR image */
export async function POST(request: NextRequest, { params }: RouteParams) {
  const { id: societyId } = await params;

  const admin = await getFullAccessAdmin();
  if (!admin) return unauthorizedError("Admin authentication required");
  if (admin.societyId !== societyId) return notFoundError("Society not found");

  const formData = await request.formData();
  const file = formData.get("file") as File | null;

  if (!file) {
    return errorResponse({ code: "NO_FILE", message: "No file provided", status: 400 });
  }

  if (file.size > MAX_FILE_SIZE) {
    return errorResponse({
      code: "FILE_TOO_LARGE",
      message: "File must be under 2MB",
      status: 400,
    });
  }

  if (!ALLOWED_TYPES.includes(file.type)) {
    return errorResponse({
      code: "INVALID_FILE_TYPE",
      message: "Only JPG, PNG, or WebP images allowed",
      status: 400,
    });
  }

  const storagePath = `${societyId}/upi-qr.png`;
  const supabaseAdmin = createAdminClient();
  await ensureBucket(supabaseAdmin, BUCKET, true);

  const arrayBuffer = await file.arrayBuffer();
  const { error: uploadError } = await supabaseAdmin.storage
    .from(BUCKET)
    .upload(storagePath, arrayBuffer, { contentType: file.type, upsert: true });

  if (uploadError) {
    return errorResponse({
      code: "UPLOAD_FAILED",
      message: "Failed to upload QR image",
      status: 500,
    });
  }

  const { data: urlData } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(storagePath);
  const url = urlData.publicUrl;

  // Persist the URL on the society record
  await prisma.society.update({
    where: { id: societyId },
    data: { upiQrUrl: url },
  });

  return successResponse({ url });
}
