import { NextResponse } from "next/server";

import { errorResponse, internalError, successResponse } from "@/lib/api-helpers";
import { requireSuperAdmin } from "@/lib/auth-guard";

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireSuperAdmin();
  if (auth.error) return auth.error as NextResponse;

  try {
    const { id } = await params;
    const formData = await request.formData();
    const file = formData.get("file");

    const fileEntry = file as File | null;
    if (!fileEntry || typeof fileEntry.name !== "string") {
      return errorResponse({ code: "BAD_REQUEST", message: "File is required", status: 400 });
    }

    const MAX_SIZE = 5 * 1024 * 1024; // 5MB
    if (fileEntry.size > MAX_SIZE) {
      return errorResponse({
        code: "BAD_REQUEST",
        message: "File size exceeds 5MB limit",
        status: 400,
      });
    }

    // In production, this would upload to Supabase Storage
    // For now, return the path placeholder
    const path = `support-attachments/${id}/${fileEntry.name}`;

    return successResponse({ path }, 201);
  } catch (err) {
    console.error("[SA Support Attachment POST]", err);
    return internalError();
  }
}
