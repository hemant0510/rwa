import { type NextRequest, NextResponse } from "next/server";

import { errorResponse, internalError, successResponse, validationError } from "@/lib/api-helpers";
import { logAudit } from "@/lib/audit";
import { requireSuperAdmin } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import { OffboardSocietySchema } from "@/lib/validations/society-lifecycle";
import { sendSocietyOffboarded } from "@/lib/whatsapp";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireSuperAdmin();
  if (auth.error) return auth.error as NextResponse;

  const { id } = await params;

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return errorResponse({ code: "INVALID_JSON", message: "Invalid JSON body", status: 400 });
  }

  const parsed = OffboardSocietySchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error);

  const { reason, confirmationCode } = parsed.data;

  try {
    const society = await prisma.society.findUnique({
      where: { id },
      include: {
        users: {
          where: { adminPermission: "FULL_ACCESS" },
          select: { id: true, name: true, mobile: true },
          take: 1,
        },
        subscriptions: {
          where: { status: "ACTIVE" },
          select: { id: true },
          take: 1,
        },
      },
    });

    if (!society) {
      return errorResponse({ code: "NOT_FOUND", message: "Society not found", status: 404 });
    }

    if (confirmationCode !== society.societyCode) {
      return errorResponse({
        code: "INVALID_CONFIRMATION",
        message: "Confirmation code does not match society code",
        status: 400,
      });
    }

    await prisma.society.update({
      where: { id },
      data: { status: "OFFBOARDED" },
    });

    if (society.subscriptions[0]) {
      await prisma.societySubscription.update({
        where: { id: society.subscriptions[0].id },
        data: { status: "CANCELLED" },
      });
    }

    await prisma.societyStatusChange.create({
      data: {
        societyId: id,
        fromStatus: society.status,
        toStatus: "OFFBOARDED",
        reason,
        notifiedAdmin: false,
        performedBy: auth.data!.superAdminId,
      },
    });

    const primaryAdmin = society.users[0];
    let notified = false;
    if (primaryAdmin?.mobile) {
      await sendSocietyOffboarded(primaryAdmin.mobile, primaryAdmin.name, society.name);
      notified = true;
    }

    await logAudit({
      actionType: "SA_SOCIETY_OFFBOARDED",
      userId: auth.data!.superAdminId,
      societyId: id,
      entityType: "Society",
      entityId: id,
      oldValue: { status: society.status },
      newValue: { status: "OFFBOARDED", reason, notifiedAdmin: notified },
    });

    return successResponse({ success: true, notifiedAdmin: notified });
  } catch (err) {
    console.error("[SA Offboard Society]", err);
    return internalError();
  }
}
