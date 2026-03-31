import { NextResponse } from "next/server";

import { internalError, parseBody } from "@/lib/api-helpers";
import { requireSuperAdmin } from "@/lib/auth-guard";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { changePasswordSchema } from "@/lib/validations/settings";

// POST /api/v1/super-admin/settings/change-password
export async function POST(request: Request) {
  const auth = await requireSuperAdmin();
  if (auth.error) return auth.error;

  try {
    const { data, error } = await parseBody(request, changePasswordSchema);
    if (error) return error;
    if (!data) return internalError();

    // Verify current password by attempting sign-in
    const supabase = await createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: auth.data.email,
      password: data.currentPassword,
    });

    if (signInError) {
      return NextResponse.json(
        { error: { code: "INVALID_CREDENTIALS", message: "Current password is incorrect" } },
        { status: 400 },
      );
    }

    // Update password via admin client
    const supabaseAdmin = createAdminClient();
    const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(
      auth.data.authUserId,
      { password: data.newPassword },
    );

    if (updateError) {
      return internalError("Failed to update password");
    }

    return NextResponse.json({ success: true, message: "Password updated successfully" });
  } catch {
    return internalError("Failed to change password");
  }
}
