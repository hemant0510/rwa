import { NextRequest, NextResponse } from "next/server";

import { errorResponse, internalError, successResponse } from "@/lib/api-helpers";
import { requireSuperAdmin } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import { createAdminClient } from "@/lib/supabase/admin";
import { ensureBucket } from "@/lib/supabase/ensure-bucket";

const BUCKET = "platform-assets";
const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2 MB
const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

/** POST /api/v1/super-admin/platform-payment-setup/upload-qr — upload platform QR image */
export async function POST(request: NextRequest) {
  const auth = await requireSuperAdmin();
  if (auth.error) return auth.error as NextResponse;

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

  try {
    const storagePath = "platform/upi-qr.png";
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

    // Persist the URL in platform settings
    await prisma.platformSetting.upsert({
      where: { settingKey: "platform_upi_qr_url" },
      update: { settingValue: url },
      create: { settingKey: "platform_upi_qr_url", settingValue: url },
    });

    return successResponse({ url });
  } catch (err) {
    console.error("[Platform QR Upload]", err);
    return internalError();
  }
}
