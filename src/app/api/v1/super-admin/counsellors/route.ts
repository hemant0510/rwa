import { NextRequest } from "next/server";

import { errorResponse, internalError, parseBody, successResponse } from "@/lib/api-helpers";
import { logAudit } from "@/lib/audit";
import { requireSuperAdmin } from "@/lib/auth-guard";
import { resolveCounsellorAuthUserId } from "@/lib/counsellor/resolve-auth-user";
import { generateCounsellorSetupLink } from "@/lib/counsellor/setup-link";
import { sendEmail } from "@/lib/email";
import { getCounsellorInviteEmailHtml } from "@/lib/email-templates/counsellor-invite";
import { prisma } from "@/lib/prisma";
import { createAdminClient } from "@/lib/supabase/admin";
import { createCounsellorSchema } from "@/lib/validations/counsellor";

export async function GET(request: NextRequest) {
  const auth = await requireSuperAdmin();
  if (auth.error) return auth.error;

  try {
    const { searchParams } = new URL(request.url);
    const page = Math.max(1, Number(searchParams.get("page") ?? 1));
    const pageSize = Math.min(100, Math.max(1, Number(searchParams.get("pageSize") ?? 20)));
    const search = searchParams.get("search")?.trim() ?? "";
    const status = searchParams.get("status"); // "active" | "inactive" | null

    const where: Record<string, unknown> = {};
    if (status === "active") where.isActive = true;
    if (status === "inactive") where.isActive = false;
    if (search) {
      where.OR = [
        { name: { contains: search, mode: "insensitive" } },
        { email: { contains: search, mode: "insensitive" } },
        { mobile: { contains: search } },
      ];
    }

    const [counsellors, total] = await Promise.all([
      prisma.counsellor.findMany({
        where,
        orderBy: { createdAt: "desc" },
        skip: (page - 1) * pageSize,
        take: pageSize,
        select: {
          id: true,
          name: true,
          email: true,
          mobile: true,
          photoUrl: true,
          isActive: true,
          mfaEnrolledAt: true,
          passwordSetAt: true,
          lastLoginAt: true,
          createdAt: true,
          _count: { select: { assignments: { where: { isActive: true } } } },
        },
      }),
      prisma.counsellor.count({ where }),
    ]);

    return successResponse({ counsellors, total, page, pageSize });
  } catch {
    return internalError("Failed to fetch counsellors");
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireSuperAdmin();
  if (auth.error) return auth.error;

  const { data, error } = await parseBody(request, createCounsellorSchema);
  if (error) return error;
  /* v8 ignore next */
  if (!data) return internalError();

  const existing = await prisma.counsellor.findUnique({ where: { email: data.email } });
  if (existing) {
    return errorResponse({
      code: "DUPLICATE_EMAIL",
      message: "A counsellor with this email already exists.",
      status: 409,
    });
  }

  const supabaseAdmin = createAdminClient();

  const resolved = await resolveCounsellorAuthUserId(supabaseAdmin, data.email);
  if (!resolved.ok) {
    return errorResponse({
      code: resolved.code,
      message: resolved.message,
      status: resolved.code === "EMAIL_CLAIMED_BY_OTHER_ROLE" ? 409 : 400,
    });
  }

  const { authUserId, adopted } = resolved;

  try {
    const counsellor = await prisma.counsellor.create({
      data: {
        authUserId,
        email: data.email,
        name: data.name,
        mobile: data.mobile ?? null,
        nationalId: data.nationalId ?? null,
        bio: data.bio ?? null,
        publicBlurb: data.publicBlurb ?? null,
        isActive: true,
        mfaRequired: false,
      },
    });

    const linkResult = await generateCounsellorSetupLink(supabaseAdmin, data.email);

    let inviteSent = false;
    if (linkResult.actionLink) {
      const html = getCounsellorInviteEmailHtml(counsellor.name, linkResult.actionLink);
      await sendEmail(data.email, `Welcome to RWA Connect — Set Up Your Counsellor Account`, html);
      inviteSent = true;
    } else {
      console.error("Counsellor setup link generation failed:", linkResult.errorMessage);
    }

    void logAudit({
      actionType: "SA_COUNSELLOR_CREATED",
      userId: auth.data.superAdminId,
      entityType: "Counsellor",
      entityId: counsellor.id,
      newValue: { name: counsellor.name, email: counsellor.email },
    });

    return successResponse(
      {
        id: counsellor.id,
        email: counsellor.email,
        name: counsellor.name,
        inviteSent,
      },
      201,
    );
  } catch (err) {
    if (!adopted) {
      await supabaseAdmin.auth.admin.deleteUser(authUserId).catch(() => undefined);
    }
    console.error("Counsellor creation error:", err);
    return internalError("Failed to create counsellor");
  }
}
