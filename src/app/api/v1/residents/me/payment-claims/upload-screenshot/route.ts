import { NextRequest } from "next/server";

import { errorResponse, successResponse, unauthorizedError } from "@/lib/api-helpers";
import { getCurrentUser } from "@/lib/get-current-user";
import { createAdminClient } from "@/lib/supabase/admin";
import { ensureBucket } from "@/lib/supabase/ensure-bucket";

const BUCKET = "societies";
const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2 MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

/** POST /api/v1/residents/me/payment-claims/upload-screenshot — upload payment screenshot */
export async function POST(request: NextRequest) {
  const resident = await getCurrentUser("RESIDENT");
  if (!resident) return unauthorizedError("Resident authentication required");

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

  const storagePath = `${resident.societyId}/payment-screenshots/${resident.userId}-${Date.now()}.png`;
  const supabaseAdmin = createAdminClient();
  await ensureBucket(supabaseAdmin, BUCKET, true);

  const arrayBuffer = await file.arrayBuffer();
  const { error: uploadError } = await supabaseAdmin.storage
    .from(BUCKET)
    .upload(storagePath, arrayBuffer, { contentType: file.type, upsert: false });

  if (uploadError) {
    return errorResponse({
      code: "UPLOAD_FAILED",
      message: "Failed to upload screenshot",
      status: 500,
    });
  }

  const { data: urlData } = supabaseAdmin.storage.from(BUCKET).getPublicUrl(storagePath);

  return successResponse({ url: urlData.publicUrl });
}
