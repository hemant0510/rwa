import { prisma } from "@/lib/prisma";

import type { Prisma } from "@prisma/client";

type AuditAction =
  | "SOCIETY_CREATED"
  | "SOCIETY_UPDATED"
  | "RESIDENT_REGISTERED"
  | "RESIDENT_APPROVED"
  | "RESIDENT_REJECTED"
  | "PAYMENT_RECORDED"
  | "PAYMENT_REVERSED"
  | "EXEMPTION_GRANTED"
  | "EXPENSE_CREATED"
  | "EXPENSE_REVERSED"
  | "BROADCAST_SENT"
  | "ADMIN_LOGIN"
  | "ADMIN_LOGOUT"
  | "MIGRATION_STARTED"
  | "MIGRATION_COMPLETED"
  | "EVENT_CREATED"
  | "EVENT_UPDATED"
  | "EVENT_DELETED"
  | "EVENT_PUBLISHED"
  | "EVENT_PAYMENT_TRIGGERED"
  | "EVENT_CANCELLED"
  | "EVENT_COMPLETED"
  | "EVENT_REGISTRATION_CREATED"
  | "EVENT_REGISTRATION_CANCELLED"
  | "EVENT_PAYMENT_RECORDED"
  | "EVENT_EXPENSE_ADDED"
  | "EVENT_SETTLED"
  | "PETITION_CREATED"
  | "PETITION_UPDATED"
  | "PETITION_DELETED"
  | "PETITION_DOCUMENT_UPLOADED"
  | "PETITION_PUBLISHED"
  | "PETITION_SUBMITTED"
  | "PETITION_CLOSED"
  | "PETITION_SIGNED"
  | "PETITION_SIGNATURE_REVOKED"
  | "PETITION_SIGNATURE_REMOVED"
  // Super Admin actions
  | "SA_LOGIN"
  | "SA_LOGOUT"
  | "SA_SOCIETY_CREATED"
  | "SA_SOCIETY_UPDATED"
  | "SA_ADMIN_ACTIVATED"
  | "SA_SUBSCRIPTION_ASSIGNED"
  | "SA_PAYMENT_RECORDED"
  | "SA_PLAN_CREATED"
  | "SA_PLAN_UPDATED"
  | "SA_PLAN_ARCHIVED"
  | "SA_PLAN_REORDERED"
  | "SA_BILLING_OPTION_CREATED"
  | "SA_BILLING_OPTION_UPDATED"
  | "SA_BILLING_OPTION_DELETED"
  | "SA_DISCOUNT_CREATED"
  | "SA_DISCOUNT_UPDATED"
  | "SA_DISCOUNT_DEACTIVATED"
  | "SA_REMINDER_SENT"
  | "SA_BULK_REMINDERS_SENT"
  | "SA_SETTINGS_UPDATED"
  | "SA_SOCIETY_SUSPENDED"
  | "SA_SOCIETY_REACTIVATED"
  | "SA_SOCIETY_OFFBOARDED"
  // Support request actions
  | "SUPPORT_REQUEST_CREATED"
  | "SUPPORT_REQUEST_STATUS_CHANGED"
  | "SUPPORT_REQUEST_MESSAGE_SENT"
  | "SUPPORT_REQUEST_REOPENED"
  | "SUPPORT_REQUEST_AUTO_CLOSED"
  // UPI Payment actions
  | "PAYMENT_CLAIM_SUBMITTED"
  | "PAYMENT_CLAIM_VERIFIED"
  | "PAYMENT_CLAIM_REJECTED"
  | "UPI_SETUP_UPDATED"
  | "SUBSCRIPTION_CLAIM_SUBMITTED"
  | "SUBSCRIPTION_CLAIM_VERIFIED"
  | "SUBSCRIPTION_CLAIM_REJECTED"
  | "PLATFORM_PAYMENT_SETUP_UPDATED";

interface AuditLogInput {
  actionType: AuditAction;
  userId: string;
  societyId?: string;
  entityType: string;
  entityId: string;
  oldValue?: Prisma.InputJsonValue;
  newValue?: Prisma.InputJsonValue;
  ipAddress?: string;
  userAgent?: string;
}

export async function logAudit(input: AuditLogInput) {
  try {
    await prisma.auditLog.create({
      data: {
        actionType: input.actionType,
        userId: input.userId,
        societyId: input.societyId ?? null,
        entityType: input.entityType,
        entityId: input.entityId,
        oldValue: input.oldValue ?? undefined,
        newValue: input.newValue ?? undefined,
        ipAddress: input.ipAddress ?? null,
        userAgent: input.userAgent ?? null,
      },
    });
  } catch (err) {
    // Non-blocking: audit logging should never break the main flow
    console.error("[Audit] Failed to log:", err);
  }
}
