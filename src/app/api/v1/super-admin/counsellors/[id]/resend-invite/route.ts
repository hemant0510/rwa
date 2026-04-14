import { NextRequest } from "next/server";

import { errorResponse, internalError, notFoundError, successResponse } from "@/lib/api-helpers";
import { logAudit } from "@/lib/audit";
import { requireSuperAdmin } from "@/lib/auth-guard";
import { APP_URL } from "@/lib/constants";
import { sendEmail } from "@/lib/email";
import { getCounsellorInviteEmailHtml } from "@/lib/email-templates/counsellor-invite";
import { prisma } from "@/lib/prisma";
import { createAdminClient } from "@/lib/supabase/admin";

type RouteContext = { params: Promise<{ id: string }> };

export async function POST(_request: NextRequest, { params }: RouteContext) {
  const auth = await requireSuperAdmin();
  if (auth.error) return auth.error;

  const { id } = await params;

  try {
    const counsellor = await prisma.counsellor.findUnique({
      where: { id },
      select: { id: true, email: true, name: true, isActive: true, mfaEnrolledAt: true },
    });

    if (!counsellor) return notFoundError("Counsellor not found");

    if (!counsellor.isActive) {
      return errorResponse({
        code: "COUNSELLOR_SUSPENDED",
        message: "Cannot resend invite to a suspended counsellor",
        status: 400,
      });
    }

    if (counsellor.mfaEnrolledAt) {
      return errorResponse({
        code: "ALREADY_ONBOARDED",
        message: "Counsellor has already set up their account",
        status: 400,
      });
    }

    const supabaseAdmin = createAdminClient();
    const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
      type: "invite",
      email: counsellor.email,
      options: { redirectTo: `${APP_URL}/counsellor/set-password` },
    });

    if (linkError || !linkData?.properties?.action_link) {
      return errorResponse({
        code: "LINK_GENERATION_FAILED",
        message: linkError?.message ?? "Failed to generate invite link",
        status: 500,
      });
    }

    const setupUrl = linkData.properties.action_link;
    const html = getCounsellorInviteEmailHtml(counsellor.name, setupUrl);
    await sendEmail(
      counsellor.email,
      `Welcome to RWA Connect — Set Up Your Counsellor Account`,
      html,
    );

    void logAudit({
      actionType: "SA_COUNSELLOR_INVITE_RESENT",
      userId: auth.data.superAdminId,
      entityType: "Counsellor",
      entityId: id,
    });

    return successResponse({ id, sent: true });
  } catch {
    return internalError("Failed to resend invite");
  }
}
