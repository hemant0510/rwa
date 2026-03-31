import { type NextRequest, NextResponse } from "next/server";

import { errorResponse, internalError, successResponse, validationError } from "@/lib/api-helpers";
import { logAudit } from "@/lib/audit";
import { requireSuperAdmin } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import { SuspendSocietySchema } from "@/lib/validations/society-lifecycle";
import { sendSocietySuspended } from "@/lib/whatsapp";

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

  const parsed = SuspendSocietySchema.safeParse(body);
  if (!parsed.success) return validationError(parsed.error);

  const { reason, gracePeriodDays, notifyAdmin } = parsed.data;

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

    if (society.status === "SUSPENDED") {
      return errorResponse({
        code: "INVALID_STATE",
        message: "Society is already suspended",
        status: 400,
      });
    }

    if (society.status === "OFFBOARDED") {
      return errorResponse({
        code: "INVALID_STATE",
        message: "Cannot suspend an offboarded society",
        status: 400,
      });
    }

    const gracePeriodEnd =
      gracePeriodDays > 0 ? new Date(Date.now() + gracePeriodDays * 24 * 60 * 60 * 1000) : null;

    await prisma.society.update({
      where: { id },
      data: { status: "SUSPENDED" },
    });

    await prisma.societyStatusChange.create({
      data: {
        societyId: id,
        fromStatus: society.status,
        toStatus: "SUSPENDED",
        reason,
        gracePeriodEnd,
        notifiedAdmin: false,
        performedBy: auth.data!.superAdminId,
      },
    });

    const primaryAdmin = society.users[0];
    let notified = false;
    if (notifyAdmin && primaryAdmin?.mobile) {
      await sendSocietySuspended(
        primaryAdmin.mobile,
        primaryAdmin.name,
        society.name,
        reason,
        gracePeriodEnd ? gracePeriodEnd.toISOString().split("T")[0] : null,
      );
      notified = true;
    }

    await logAudit({
      actionType: "SA_SOCIETY_SUSPENDED",
      userId: auth.data!.superAdminId,
      societyId: id,
      entityType: "Society",
      entityId: id,
      oldValue: { status: society.status },
      newValue: { status: "SUSPENDED", reason, gracePeriodDays, notifiedAdmin: notified },
    });

    return successResponse({ success: true, notifiedAdmin: notified });
  } catch (err) {
    console.error("[SA Suspend Society]", err);
    return internalError();
  }
}
