import { type NextRequest, NextResponse } from "next/server";

import { errorResponse, internalError, successResponse, validationError } from "@/lib/api-helpers";
import { logAudit } from "@/lib/audit";
import { requireSuperAdmin } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import { ReactivateSocietySchema } from "@/lib/validations/society-lifecycle";
import { sendSocietyReactivated } from "@/lib/whatsapp";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireSuperAdmin();
  if (auth.error) return auth.error as NextResponse;

  const { id } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    body = {};
  }

  const parsed = ReactivateSocietySchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error);

  const { note, notifyAdmin } = parsed.data;

  try {
    const society = await prisma.society.findUnique({
      where: { id },
      include: {
        users: {
          where: { adminPermission: "FULL_ACCESS" },
          select: { id: true, name: true, mobile: true },
          take: 1,
        },
      },
    });

    if (!society) {
      return errorResponse({ code: "NOT_FOUND", message: "Society not found", status: 404 });
    }

    if (society.status !== "SUSPENDED") {
      return errorResponse({
        code: "INVALID_STATE",
        message: "Only suspended societies can be reactivated",
        status: 400,
      });
    }

    await prisma.society.update({
      where: { id },
      data: { status: "ACTIVE" },
    });

    await prisma.societyStatusChange.create({
      data: {
        societyId: id,
        fromStatus: "SUSPENDED",
        toStatus: "ACTIVE",
        reason: note ?? "Reactivated by super admin",
        note,
        notifiedAdmin: false,
        performedBy: auth.data!.superAdminId,
      },
    });

    const primaryAdmin = society.users[0];
    let notified = false;
    if (notifyAdmin && primaryAdmin?.mobile) {
      await sendSocietyReactivated(primaryAdmin.mobile, primaryAdmin.name, society.name);
      notified = true;
    }

    await logAudit({
      actionType: "SA_SOCIETY_REACTIVATED",
      userId: auth.data!.superAdminId,
      societyId: id,
      entityType: "Society",
      entityId: id,
      oldValue: { status: "SUSPENDED" },
      newValue: { status: "ACTIVE", note, notifiedAdmin: notified },
    });

    return successResponse({ success: true, notifiedAdmin: notified });
  } catch (err) {
    console.error("[SA Reactivate Society]", err);
    return internalError();
  }
}
