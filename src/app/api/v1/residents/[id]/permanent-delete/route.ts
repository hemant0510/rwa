import { NextRequest, NextResponse } from "next/server";

import { forbiddenError, internalError, notFoundError, unauthorizedError } from "@/lib/api-helpers";
import { getCurrentUser } from "@/lib/get-current-user";
import { prisma, type TransactionClient } from "@/lib/prisma";
import { createAdminClient } from "@/lib/supabase/admin";

export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await params;

    // Auth check
    const admin = await getCurrentUser("RWA_ADMIN");
    if (!admin) return unauthorizedError();

    // Find resident
    const resident = await prisma.user.findUnique({ where: { id } });
    if (!resident) return notFoundError("Resident not found");

    // Only deactivated residents can be permanently deleted
    if (resident.status !== "DEACTIVATED") {
      return NextResponse.json(
        {
          error: {
            code: "NOT_DEACTIVATED",
            message: "Only deactivated residents can be permanently deleted.",
          },
        },
        { status: 400 },
      );
    }

    // Authorization: admin must be of same society
    if (admin.societyId !== resident.societyId) {
      return forbiddenError("Not authorized to delete this resident");
    }

    const residentName = resident.name;
    const residentEmail = resident.email;
    const authUserId = resident.authUserId;

    // Delete all related records in a transaction
    await prisma.$transaction(async (tx: TransactionClient) => {
      // 1. Nullify nullable FK references on other records
      await tx.unit.updateMany({ where: { primaryOwnerId: id }, data: { primaryOwnerId: null } });
      await tx.unit.updateMany({ where: { currentTenantId: id }, data: { currentTenantId: null } });
      await tx.user.updateMany({ where: { approvedById: id }, data: { approvedById: null } });
      await tx.user.updateMany({ where: { rejectedById: id }, data: { rejectedById: null } });
      await tx.membershipFee.updateMany({ where: { exemptedBy: id }, data: { exemptedBy: null } });
      await tx.expense.updateMany({ where: { reversedBy: id }, data: { reversedBy: null } });
      await tx.adminTerm.updateMany({ where: { activatedBy: id }, data: { activatedBy: null } });
      await tx.adminTerm.updateMany({
        where: { deactivatedBy: id },
        data: { deactivatedBy: null },
      });
      await tx.expenseQuery.updateMany({ where: { respondedBy: id }, data: { respondedBy: null } });
      await tx.propertyTransfer.updateMany({
        where: { incomingUserId: id },
        data: { incomingUserId: null },
      });

      // 2. Delete owned records (order matters for FK constraints)
      await tx.emailVerificationToken.deleteMany({ where: { userId: id } });
      await tx.notificationPreference.deleteMany({ where: { userId: id } });
      await tx.notification.deleteMany({ where: { userId: id } });
      await tx.dependent.deleteMany({ where: { userId: id } });
      await tx.visitorLog.deleteMany({ where: { residentId: id } });
      await tx.blacklistedNumber.deleteMany({ where: { blacklistedBy: id } });
      await tx.expenseQuery.deleteMany({ where: { raisedBy: id } });
      await tx.festivalContribution.deleteMany({ where: { userId: id } });
      await tx.propertyTransfer.deleteMany({ where: { outgoingUserId: id } });
      await tx.propertyTransfer.deleteMany({ where: { initiatedBy: id } });
      await tx.broadcast.deleteMany({ where: { sentBy: id } });
      await tx.adminTerm.deleteMany({ where: { userId: id } });
      await tx.feePayment.deleteMany({ where: { userId: id } });
      await tx.membershipFee.deleteMany({ where: { userId: id } });
      await tx.userUnit.deleteMany({ where: { userId: id } });
      await tx.auditLog.deleteMany({ where: { userId: id } });

      // 3. Audit log (by caller, recording what was deleted)
      await tx.auditLog.create({
        data: {
          societyId: resident.societyId,
          userId: admin.userId,
          actionType: "DELETE",
          entityType: "USER",
          entityId: id,
          oldValue: { name: residentName, email: residentEmail, status: "DEACTIVATED" },
          newValue: { permanentlyDeleted: true },
        },
      });

      // 4. Delete the user record
      await tx.user.delete({ where: { id } });
    });

    // 5. Delete Supabase auth user
    if (authUserId) {
      try {
        const supabaseAdmin = createAdminClient();
        await supabaseAdmin.auth.admin.deleteUser(authUserId);
      } catch (err) {
        console.error("Failed to delete Supabase auth user:", err);
      }
    }

    return NextResponse.json({ message: "Resident permanently deleted" });
  } catch (err) {
    console.error("Permanent delete error:", err);
    return internalError("Failed to permanently delete resident");
  }
}
